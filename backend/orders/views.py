import json
import logging
from decimal import Decimal, ROUND_HALF_UP

import razorpay
from django.conf import settings
from urllib.parse import urlencode

from django.contrib.admin.views.decorators import staff_member_required
from django.db import transaction
from django.http import HttpResponse, HttpResponseRedirect
from django.template.loader import render_to_string
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import Order, OrderItem
from products.models import ProductVariant


logger = logging.getLogger(__name__)

client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))


def ensure_payment_captured(razorpay_payment_id, expected_amount_paise=None):
    """Capture a payment that Razorpay left sitting in `authorized`.

    The order-level `payment_capture` flag is ignored by the Orders API — auto
    capture is an account-level Dashboard setting. When it is off (or when a
    method takes the authorize-then-capture path) Checkout keeps spinning its
    coin animation waiting for the capture that never comes, and the attempt
    finally times out and is auto-refunded. Capturing explicitly closes it.

    Returns the payment entity dict, or None when it could not be fetched.
    """
    if not razorpay_payment_id:
        return None

    try:
        payment = client.payment.fetch(razorpay_payment_id)
    except Exception as exc:
        logger.error("Razorpay payment fetch failed for %s: %s", razorpay_payment_id, exc)
        return None

    if payment.get("status") != "authorized":
        return payment

    amount = expected_amount_paise or payment.get("amount")

    try:
        return client.payment.capture(
            razorpay_payment_id,
            amount,
            {"currency": payment.get("currency", "INR")},
        )
    except Exception as exc:
        # Already captured elsewhere (webhook/cron racing us) is a benign error.
        logger.error("Razorpay capture failed for %s: %s", razorpay_payment_id, exc)
        return payment


def release_order_stock(order):
    """Hand this order's reserved stock back to the pool exactly once."""
    with transaction.atomic():
        order = Order.objects.select_for_update().get(id=order.id)

        if order.stock_released or order.payment_status == "paid":
            return order

        items = sorted(order.items.select_related("variant").all(), key=lambda i: i.variant.id)

        for item in items:
            variant = ProductVariant.objects.select_for_update().get(id=item.variant.id)
            variant.reserved_stock = max(0, variant.reserved_stock - item.quantity)
            variant.save(update_fields=["reserved_stock"])

        order.stock_released = True
        order.save(update_fields=["stock_released"])
        return order


def settle_abandoned_attempt(order, reason=""):
    """Close out a payment attempt the customer walked away from.

    Razorpay is asked first: if a payment did go through, the order is
    finalized instead. Only when the gateway confirms nothing was paid is the
    reservation released and the order marked failed. Gateway errors propagate
    so the caller can leave the order for the cleanup job to recheck.
    """
    if order.payment_status != "pending" or not order.razorpay_order_id:
        return order

    payments = client.order.payments(order.razorpay_order_id).get("items", [])
    settled = next(
        (p for p in payments if p.get("status") in ("captured", "authorized")),
        None,
    )
    if settled:
        ensure_payment_captured(settled.get("id"), settled.get("amount"))
        return finalize_paid_order(order=order, razorpay_payment_id=settled.get("id"))

    release_order_stock(order)
    order.refresh_from_db()

    # A webhook may have finalized it while the stock was being released.
    if order.payment_status == "pending":
        order.payment_status = "failed"
        order.payment_error = (reason or "")[:255]
        order.save(update_fields=["payment_status", "payment_error"])

    return order


def finalize_paid_order(
    order,
    razorpay_payment_id=None,
    razorpay_signature=None,
    money_already_collected=True,
):
    """Mark an order paid and convert its reservation into a real deduction.

    `money_already_collected` is True on every path that runs after Razorpay has
    actually captured the payment (verify, webhook, cron recovery). On those
    paths a stock shortfall must NOT abort: the customer has been charged, so we
    clamp the stock at zero, log it loudly for the admin to sort out, and still
    record the order as paid. Leaving it `pending` is what causes a captured
    payment to be swept up by the expiry job and shown to the customer as a
    failed order.
    """
    with transaction.atomic():
        # Lock the order row
        order = Order.objects.select_for_update().get(id=order.id)

        if order.payment_status == "paid":
            return order

        order_items = (
            order.items
            .select_related("variant", "variant__product")
            .all()
        )

        # Sort variants by ID to prevent database deadlocks when locking multiple rows
        sorted_items = sorted(order_items, key=lambda item: item.variant.id)

        # If cleanup already expired this order its reservation is gone, so only
        # the physical stock still has to move.
        reservation_is_live = not order.stock_released

        for item in sorted_items:
            variant = ProductVariant.objects.select_for_update().get(id=item.variant.id)

            if variant.stock < item.quantity:
                if not money_already_collected:
                    raise ValueError(
                        f"Stock became unavailable for {variant.product.name} - {variant.size}. "
                        f"Available: {variant.stock}, Required: {item.quantity}"
                    )
                logger.error(
                    "OVERSOLD: order %s charged but only %s left of %s - %s (needed %s)",
                    order.order_number, variant.stock, variant.product.name,
                    variant.size, item.quantity,
                )

            update_fields = ["stock"]

            if reservation_is_live:
                # ✅ Convert reserved stock into actual sold stock deduction
                variant.reserved_stock = max(0, variant.reserved_stock - item.quantity)
                update_fields.append("reserved_stock")

            variant.stock = max(0, variant.stock - item.quantity)
            variant.save(update_fields=update_fields)

        update_fields = ["payment_status", "stock_released"]

        order.payment_status = "paid"
        # The reservation no longer exists in either direction now.
        order.stock_released = True

        if razorpay_payment_id:
            order.razorpay_payment_id = razorpay_payment_id
            update_fields.append("razorpay_payment_id")

        if razorpay_signature:
            order.razorpay_signature = razorpay_signature
            update_fields.append("razorpay_signature")

        order.save(update_fields=update_fields)
        return order


@api_view(["POST"])
@permission_classes([AllowAny])
def create_order(request):
    data = request.data
    items = data.get("items", [])

    if not items:
        return Response({"error": "No items in the order."}, status=400)

    aggregated_items = {}
    for item in items:
        variant_id = item.get("variant")
        quantity = int(item.get("quantity", 1))
        if variant_id and quantity > 0:
            aggregated_items[variant_id] = aggregated_items.get(variant_id, 0) + quantity

    if not aggregated_items:
        return Response({"error": "No valid items in the order."}, status=400)

    # The customer's previous attempt (closed modal, page reloaded while they
    # were in their UPI app) still holds its stock. Settle it first, or a
    # retry fails the stock check against their own reservation.
    previous_razorpay_order_id = data.get("previous_razorpay_order_id")
    if previous_razorpay_order_id:
        try:
            previous_order = Order.objects.filter(
                razorpay_order_id=previous_razorpay_order_id,
                payment_status="pending",
            ).first()
            if previous_order:
                settle_abandoned_attempt(previous_order, "Superseded by a new checkout attempt")
        except Exception as e:
            # The cleanup job will release it; never block a new order on this.
            logger.warning("Could not settle previous attempt %s: %s", previous_razorpay_order_id, e)

    try:
        # 🛑 OPEN ATOMIC TRANSACTION FOR DB LOCKING
        with transaction.atomic():
            order = Order.objects.create(
                user=request.user if request.user.is_authenticated else None,
                customer_name=data.get("name", "Guest"),
                phone=data.get("phone"),
                address=data.get("address"),
                city=data.get("city"),
                state=data.get("state"),
                pincode=data.get("pincode"),
                payment_status="pending",
            )

            cart_total = Decimal("0.00")
            shipping_total = Decimal("0.00")

            # Sort by variant_id to avoid deadlocks across concurrent requests
            for variant_id in sorted(aggregated_items.keys()):
                quantity = aggregated_items[variant_id]

                # ✅ Lock variant row to safely check and reserve stock
                variant = (
                    ProductVariant.objects
                    .select_for_update()
                    .select_related("product")
                    .get(id=variant_id)
                )

                # ✅ Check against available stock (physical stock - currently reserved)
                available_stock = variant.stock - variant.reserved_stock

                if available_stock < quantity:
                    raise ValueError(
                        f"Insufficient stock for {variant.product.name} - {variant.size}. "
                        f"Available: {available_stock}, Required: {quantity}"
                    )

                # ✅ Reserve the stock
                variant.reserved_stock += quantity
                variant.save(update_fields=["reserved_stock"])

                OrderItem.objects.create(
                    order=order,
                    variant=variant,
                    quantity=quantity
                )

                price = Decimal(str(variant.product.price))
                shipping = Decimal(str(variant.product.shipping_charge or 0))

                cart_total += price * quantity
                shipping_total += shipping * quantity

            grand_total = (cart_total + shipping_total).quantize(
                Decimal("0.01"),
                rounding=ROUND_HALF_UP
            )

            order.total_amount = grand_total
            order.save(update_fields=["total_amount"])

            amount_in_paise = int(grand_total * 100)

        # 🛑 OUTSIDE ATOMIC TRANSACTION
        # We do this here so we don't hold database row locks open while waiting
        # for Razorpay's network to respond.
        try:
            razorpay_order = client.order.create({
                "amount": amount_in_paise,
                "currency": "INR",
                "payment_capture": 1,
                "receipt": order.order_number,
                "notes": {
                    "order_number": order.order_number,
                    "customer_name": order.customer_name or "",
                    "phone": order.phone or "",
                    # Lets the dashboard show which browser a stuck payment came
                    # from (e.g. Instagram's in-app browser).
                    "user_agent": request.META.get("HTTP_USER_AGENT", "")[:250],
                },
            })
        except Exception as e:
            # No Razorpay order means no payment can ever arrive for this one,
            # so hand the stock back now instead of holding it until cleanup.
            logger.error("Razorpay order creation failed for %s: %s", order.order_number, e)
            release_order_stock(order)
            order.refresh_from_db()
            order.payment_status = "failed"
            order.payment_error = "Payment gateway unavailable"
            order.save(update_fields=["payment_status", "payment_error"])
            return Response(
                {"error": "Payment gateway is not responding. Please try again in a moment."},
                status=502,
            )

        order.razorpay_order_id = razorpay_order["id"]
        order.save(update_fields=["razorpay_order_id"])

        return Response({
            "order_number": order.order_number,
            "order_id": order.id,
            "razorpay_order_id": razorpay_order["id"],
            "amount": amount_in_paise,
            "cart_total": int(cart_total * 100),
            "shipping_total": int(shipping_total * 100),
            "key": settings.RAZORPAY_KEY_ID,
        })

    except ValueError as e:
        return Response({"error": str(e)}, status=400)

    except ProductVariant.DoesNotExist:
        return Response({"error": "One or more products no longer exist."}, status=400)

    except Exception as e:
        print("🔥 CREATE ORDER FATAL ERROR:", str(e))
        return Response(
            {"error": "An unexpected error occurred while creating your order."},
            status=500
        )


@api_view(["POST"])
@permission_classes([AllowAny])
def verify_payment(request):
    data = request.data

    razorpay_order_id = data.get("razorpay_order_id")
    razorpay_payment_id = data.get("razorpay_payment_id")
    razorpay_signature = data.get("razorpay_signature")

    if not razorpay_order_id or not razorpay_payment_id or not razorpay_signature:
        return Response(
            {"status": "failed", "error": "Missing payment verification fields"},
            status=400
        )

    try:
        client.utility.verify_payment_signature({
            "razorpay_order_id": razorpay_order_id,
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_signature": razorpay_signature
        })
    except Exception as e:
        logger.error("Signature verification failed for %s: %s", razorpay_order_id, e)
        return Response(
            {"status": "failed", "error": "Invalid payment signature"},
            status=400
        )

    try:
        order = Order.objects.get(razorpay_order_id=razorpay_order_id)
    except Order.DoesNotExist:
        return Response(
            {"status": "failed", "error": "Order not found in database"},
            status=400
        )

    # The signature is valid, so this payment really happened. Make sure it is
    # captured rather than left `authorized` — an uncaptured payment is what
    # leaves Checkout spinning its coin animation until it times out.
    ensure_payment_captured(razorpay_payment_id, int(Decimal(str(order.total_amount)) * 100))

    try:
        finalized_order = finalize_paid_order(
            order=order,
            razorpay_payment_id=razorpay_payment_id,
            razorpay_signature=razorpay_signature,
        )
    except Exception as e:
        # Never tell a charged customer their payment failed. The webhook and
        # the cleanup job will retry; surface it for the admin instead.
        logger.exception("Finalize failed for paid order %s: %s", order.order_number, e)
        return Response({
            "status": "success",
            "order_number": order.order_number,
            "warning": "Payment received. Your order is being confirmed.",
        })

    return Response({
        "status": "success",
        "order_number": finalized_order.order_number
    })


@api_view(["GET"])
@permission_classes([AllowAny])
def payment_status(request):
    """Let the browser ask what actually happened to a payment.

    Checkout's handler does not always run — the tab is backgrounded, the UPI
    app takes over, the network drops on the way back. The browser polls this
    instead of assuming the order failed.
    """
    razorpay_order_id = request.GET.get("razorpay_order_id")
    order_number = request.GET.get("order_number")

    if not razorpay_order_id and not order_number:
        return Response({"error": "razorpay_order_id or order_number required"}, status=400)

    lookup = (
        {"razorpay_order_id": razorpay_order_id}
        if razorpay_order_id else {"order_number": order_number}
    )

    try:
        order = Order.objects.get(**lookup)
    except Order.DoesNotExist:
        return Response({"error": "Order not found"}, status=404)

    # A payment may have been captured without our handler ever running, so ask
    # Razorpay directly while the order still looks unpaid.
    if order.payment_status == "pending" and order.razorpay_order_id:
        try:
            payments = client.order.payments(order.razorpay_order_id).get("items", [])
            settled = next(
                (p for p in payments if p.get("status") in ("captured", "authorized")),
                None,
            )
            if settled:
                ensure_payment_captured(settled.get("id"), settled.get("amount"))
                order = finalize_paid_order(order=order, razorpay_payment_id=settled.get("id"))
        except Exception as e:
            logger.error("payment_status recheck failed for %s: %s", order.order_number, e)

    return Response({
        "order_number": order.order_number,
        "payment_status": order.payment_status,
        "status": order.status,
    })


@api_view(["POST"])
@permission_classes([AllowAny])
def report_payment_failure(request):
    """Checkout told the browser the payment failed — free the stock now.

    Without this the order sits `pending` holding its reservation until the
    cleanup job runs, which blocks other buyers and makes retries fail a
    stock check they should pass.
    """
    razorpay_order_id = request.data.get("razorpay_order_id")
    reason = (request.data.get("reason") or "")[:255]

    if not razorpay_order_id:
        return Response({"error": "razorpay_order_id required"}, status=400)

    try:
        order = Order.objects.get(razorpay_order_id=razorpay_order_id)
    except Order.DoesNotExist:
        return Response({"error": "Order not found"}, status=404)

    # Trust Razorpay, not the browser: only give up if the gateway agrees there
    # is no live payment on this order.
    try:
        order = settle_abandoned_attempt(order, reason)
    except Exception as e:
        logger.error("Failure report recheck failed for %s: %s", order.order_number, e)

    return Response({"payment_status": order.payment_status})


def _redirect_to_frontend(path, **params):
    query = f"?{urlencode(params)}" if params else ""
    return HttpResponseRedirect(f"{settings.FRONTEND_URL}{path}{query}")


@csrf_exempt
def razorpay_callback(request):
    """Razorpay posts the payment result here when Checkout runs with redirect: true.

    In-app browsers (Instagram, Facebook) block Checkout's popups and often
    reload or kill the page while the customer is in their UPI app, so the
    in-page handler cannot be relied on. In redirect mode the browser carries
    the result here instead; it is recorded server-side and the customer is
    sent back to the site.
    """
    if request.method != "POST":
        return _redirect_to_frontend("/checkout")

    razorpay_order_id = request.POST.get("razorpay_order_id")
    razorpay_payment_id = request.POST.get("razorpay_payment_id")
    razorpay_signature = request.POST.get("razorpay_signature")

    if razorpay_order_id and razorpay_payment_id and razorpay_signature:
        try:
            client.utility.verify_payment_signature({
                "razorpay_order_id": razorpay_order_id,
                "razorpay_payment_id": razorpay_payment_id,
                "razorpay_signature": razorpay_signature,
            })
        except Exception as e:
            logger.error("Callback signature verification failed for %s: %s", razorpay_order_id, e)
            return _redirect_to_frontend("/checkout", payment="failed")

        try:
            order = Order.objects.get(razorpay_order_id=razorpay_order_id)
        except Order.DoesNotExist:
            logger.error("Callback for unknown Razorpay order %s", razorpay_order_id)
            return _redirect_to_frontend("/checkout", payment="failed")

        ensure_payment_captured(razorpay_payment_id, int(Decimal(str(order.total_amount)) * 100))

        try:
            finalize_paid_order(
                order=order,
                razorpay_payment_id=razorpay_payment_id,
                razorpay_signature=razorpay_signature,
            )
        except Exception as e:
            # The signature proves the payment happened. The webhook and the
            # cleanup job will finish recording it; the customer sees success.
            logger.exception("Callback finalize failed for paid order %s: %s", order.order_number, e)

        return _redirect_to_frontend("/order-success", order=order.order_number)

    # Failed attempt: Razorpay sends error[...] fields, with the order id
    # inside error[metadata] as JSON.
    reason = request.POST.get("error[description]") or "Payment failed"
    failed_razorpay_order_id = None
    try:
        metadata = json.loads(request.POST.get("error[metadata]") or "{}")
        failed_razorpay_order_id = metadata.get("order_id")
    except (TypeError, ValueError):
        pass

    if failed_razorpay_order_id:
        order = Order.objects.filter(razorpay_order_id=failed_razorpay_order_id).first()
        if order:
            try:
                order = settle_abandoned_attempt(order, reason)
            except Exception as e:
                logger.error("Callback failure recheck failed for %s: %s", order.order_number, e)

            if order.payment_status == "paid":
                return _redirect_to_frontend("/order-success", order=order.order_number)

    return _redirect_to_frontend("/checkout", payment="failed")


@csrf_exempt
def razorpay_webhook(request):
    if request.method != "POST":
        return HttpResponse(status=405)

    webhook_secret = settings.RAZORPAY_WEBHOOK_SECRET
    signature = request.headers.get("X-Razorpay-Signature")

    if not signature:
        return HttpResponse("Missing signature", status=400)

    try:
        body = request.body.decode("utf-8")

        client.utility.verify_webhook_signature(
            body,
            signature,
            webhook_secret
        )

        payload = json.loads(body)
        event = payload.get("event", "")

        # Ignore events you do not care about
        allowed_events = [
            "payment.authorized",
            "payment.captured",
            "payment.failed",
            "order.paid",
            "refund.created",
            "refund.processed",
        ]

        if event not in allowed_events:
            return HttpResponse(status=200)

        # -------------------------------
        # PAYMENT SUCCESS EVENTS
        # -------------------------------
        if event in ["payment.authorized", "payment.captured", "order.paid"]:
            payment_entity = (
                payload.get("payload", {})
                .get("payment", {})
                .get("entity", {})
            )

            razorpay_order_id = payment_entity.get("order_id")
            razorpay_payment_id = payment_entity.get("id")

            if not razorpay_order_id:
                return HttpResponse("Missing order id", status=400)

            order = Order.objects.get(razorpay_order_id=razorpay_order_id)

            # `payment.authorized` means the money is held but not taken. Capture
            # it here so Checkout stops waiting and the payment is not
            # auto-refunded when the authorisation window closes.
            if payment_entity.get("status") == "authorized":
                ensure_payment_captured(razorpay_payment_id, payment_entity.get("amount"))

            finalize_paid_order(
                order=order,
                razorpay_payment_id=razorpay_payment_id
            )

            return HttpResponse(status=200)

        # -------------------------------
        # PAYMENT FAILURE
        # -------------------------------
        if event == "payment.failed":
            payment_entity = (
                payload.get("payload", {})
                .get("payment", {})
                .get("entity", {})
            )

            razorpay_order_id = payment_entity.get("order_id")

            if not razorpay_order_id:
                return HttpResponse(status=200)

            try:
                order = Order.objects.get(razorpay_order_id=razorpay_order_id)
            except Order.DoesNotExist:
                return HttpResponse(status=200)

            # A customer can retry inside the same Checkout session, so a failed
            # attempt is only final if nothing else succeeded on this order.
            if order.payment_status == "pending":
                live = [
                    p for p in client.order.payments(razorpay_order_id).get("items", [])
                    if p.get("status") in ("captured", "authorized")
                ]
                if live:
                    ensure_payment_captured(live[0].get("id"), live[0].get("amount"))
                    finalize_paid_order(order=order, razorpay_payment_id=live[0].get("id"))
                    return HttpResponse(status=200)

                release_order_stock(order)
                order.refresh_from_db()
                order.payment_status = "failed"
                order.payment_error = (payment_entity.get("description") or "")[:255]
                order.save(update_fields=["payment_status", "payment_error"])

            return HttpResponse(status=200)

        # -------------------------------
        # REFUND EVENTS
        # -------------------------------
        if event in ["refund.created", "refund.processed"]:
            refund_entity = (
                payload.get("payload", {})
                .get("refund", {})
                .get("entity", {})
            )

            razorpay_payment_id = refund_entity.get("payment_id")

            if not razorpay_payment_id:
                return HttpResponse("Missing payment id", status=400)

            order = Order.objects.get(razorpay_payment_id=razorpay_payment_id)

            order.payment_status = "refund"
            order.save(update_fields=["payment_status"])

            return HttpResponse(status=200)

        return HttpResponse(status=200)

    except Order.DoesNotExist:
        # Not our order (or created by another environment sharing the account).
        # 200 so Razorpay stops retrying something we can never resolve.
        logger.warning("Webhook received for an order that is not in this database.")
        return HttpResponse(status=200)

    except Exception as e:
        # Non-2xx makes Razorpay retry, which is what we want for transient errors.
        logger.exception("Webhook processing failed: %s", e)
        return HttpResponse("Webhook processing failed", status=500)


@staff_member_required
def download_invoices(request):
    try:
        from weasyprint import HTML
    except (ImportError, OSError):
        return HttpResponse(
            "<h1>PDF Error</h1><p>GTK+ libraries missing.</p>", status=501
        )

    order_param = request.GET.get("orders", "")
    if "," in order_param:
        order_ids = order_param.split(",")
    else:
        order_ids = request.GET.getlist("orders")

    orders = Order.objects.filter(id__in=order_ids)

    if not orders.exists():
        return HttpResponse("No orders found.", status=404)

    processed_orders = []
    for order in orders:
        total = Decimal(str(order.total_amount))
        taxable_amount = (total / Decimal("1.05")).quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP
        )
        total_gst = total - taxable_amount
        cgst = (total_gst / 2).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        sgst = (total_gst / 2).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        order.taxable_amount = taxable_amount
        order.cgst = cgst
        order.sgst = sgst
        processed_orders.append(order)

    html_string = render_to_string("invoices/invoice.html", {"orders": processed_orders})

    try:
        pdf = HTML(string=html_string).write_pdf()
        response = HttpResponse(pdf, content_type="application/pdf")
        response["Content-Disposition"] = "attachment; filename=invoices.pdf"
        return response
    except Exception as e:
        return HttpResponse(f"Error: {e}", status=500)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_orders(request):
    orders = (
        Order.objects
        .filter(user=request.user)
        .prefetch_related("items__variant__product", "items__variant__color")
        .order_by("-created_at")
    )

    data = []
    for order in orders:
        data.append({
            "id": order.id,
            "order_number": order.order_number,
            "created_at": order.created_at,
            "status": order.status,
            "payment_status": order.payment_status,
            "total_amount": str(order.total_amount),
            "items": [
                {
                    "variant_name": str(item.variant),
                    "quantity": item.quantity
                }
                for item in order.items.all()
            ]
        })

    return Response(data)
