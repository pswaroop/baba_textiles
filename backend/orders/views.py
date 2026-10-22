import json
import logging
import re
from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP

import razorpay
from django.conf import settings
from urllib.parse import urlencode

from django.contrib.admin.views.decorators import staff_member_required
from django.db import transaction
from django.http import HttpResponse, HttpResponseRedirect
from django.template.loader import render_to_string
from django.utils import timezone
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

        # Items whose size was deleted have no stock left to hand back.
        items = sorted(
            order.items.select_related("variant").filter(variant__isnull=False),
            key=lambda i: i.variant_id,
        )

        for item in items:
            variant = ProductVariant.objects.select_for_update().get(id=item.variant.id)
            variant.reserved_stock = max(0, variant.reserved_stock - item.quantity)
            variant.save(update_fields=["reserved_stock"])

        order.stock_released = True
        order.save(update_fields=["stock_released"])
        return order


# How long a texted link stays payable: Razorpay's minimum expiry. Enforced
# by the cleanup job, which cancels the link at Razorpay after this. Razorpay's
# own expiry is a minute later, as a backstop that still clears its 15 minute
# minimum by the time the request reaches it.
PAYMENT_LINK_VALID_MINUTES = 15
PAYMENT_LINK_RAZORPAY_EXPIRY_MINUTES = 16
# An attempt still unpaid this long after checkout started gets a link even if
# Razorpay has not given up on it yet (a UPI app that never opened stays
# "in progress" for ~12 minutes).
PAYMENT_LINK_AFTER_MINUTES = 5
# Links are texted for checkouts on phones where UPI apps hand-offs fail most:
# Instagram's in-app browser (Android or iPhone) and Android browsers. Set
# False to text every failed checkout, desktop and iPhone browsers included.
PAYMENT_LINK_MOBILE_ONLY = True


def payment_link_eligible(order):
    if not PAYMENT_LINK_MOBILE_ONLY:
        return True
    return order.opened_in_instagram or order.opened_on_android
# Caps how many links one phone number can be texted, so a customer retrying
# over and over is not flooded with SMS.
PAYMENT_LINK_MAX_PER_PHONE_PER_DAY = 3


def payment_link_is_live(order):
    return bool(
        order.payment_link_id
        and order.payment_link_expires_at
        and order.payment_link_expires_at > timezone.now()
    )


def mask_phone(phone):
    digits = re.sub(r"\D", "", phone or "")[-10:]
    if len(digits) != 10:
        return ""
    return f"+91 {digits[:2]}•••••{digits[-3:]}"


def payment_link_summary(order):
    """What the browser needs to tell the customer a link is on its way."""
    if order.payment_status != "pending" or not payment_link_is_live(order):
        return {"payment_link_sent": False}
    return {
        "payment_link_sent": True,
        "payment_link_phone": mask_phone(order.phone),
        "payment_link_valid_minutes": PAYMENT_LINK_VALID_MINUTES,
    }


def send_payment_link(order, reason=""):
    """Text the customer a Razorpay Payment Link for this order.

    Used when checkout failed in a way the customer could not get past (most
    often a UPI app that never opened from Instagram's in-app browser). SMS
    links open in the phone's normal browser, where UPI apps work. The order
    stays `pending` and keeps its stock reserved while the link is live.

    Returns True when a link is live for the order after the call.
    """
    if not payment_link_eligible(order):
        return False

    phone = re.sub(r"\D", "", order.phone or "")[-10:]
    if not re.fullmatch(r"[6-9]\d{9}", phone):
        return False

    recent_links = Order.objects.filter(
        phone=order.phone,
        payment_link_sent_at__gte=timezone.now() - timedelta(days=1),
    ).exclude(id=order.id).count()
    if recent_links >= PAYMENT_LINK_MAX_PER_PHONE_PER_DAY:
        logger.info("Payment link not sent for %s: daily limit reached", order.order_number)
        return False

    amount_in_paise = int(Decimal(str(order.total_amount)) * 100)
    if amount_in_paise <= 0:
        return False

    # Locked so the webhook and the browser reporting the same failure at the
    # same moment cannot text the customer twice.
    with transaction.atomic():
        locked = Order.objects.select_for_update().get(id=order.id)
        if locked.payment_status != "pending" or locked.stock_released:
            return False
        if locked.payment_link_id:
            return payment_link_is_live(locked)

        expires_at = timezone.now() + timedelta(minutes=PAYMENT_LINK_VALID_MINUTES)
        razorpay_expires_at = timezone.now() + timedelta(minutes=PAYMENT_LINK_RAZORPAY_EXPIRY_MINUTES)
        try:
            link = client.payment_link.create({
                "amount": amount_in_paise,
                "currency": "INR",
                "accept_partial": False,
                # One link per order: Razorpay rejects a second link with the
                # same reference_id, which backs up the lock above.
                "reference_id": locked.order_number,
                "description": f"Baba Textiles order #{locked.order_number}",
                "customer": {
                    "name": (locked.customer_name or "Customer")[:100],
                    "contact": f"+91{phone}",
                },
                "notify": {"sms": True, "email": False},
                "reminder_enable": False,
                "expire_by": int(razorpay_expires_at.timestamp()),
                "notes": {"order_number": locked.order_number},
                "callback_url": f"{settings.API_URL}/api/payment-link-callback/",
                "callback_method": "get",
            })
        except Exception as exc:
            logger.error("Payment link creation failed for %s: %s", locked.order_number, exc)
            return False

        locked.payment_link_id = link["id"]
        locked.payment_link_url = link.get("short_url")
        locked.payment_link_sent_at = timezone.now()
        locked.payment_link_expires_at = expires_at
        locked.payment_error = (reason or "")[:255]
        locked.save(update_fields=[
            "payment_link_id", "payment_link_url", "payment_link_sent_at",
            "payment_link_expires_at", "payment_error",
        ])

    logger.info("Payment link %s texted for order %s", link["id"], order.order_number)
    return True


def sync_payment_link(order):
    """Record a payment made through this order's link, if there is one.

    Backs up the `payment_link.paid` webhook. Returns the link's status
    ("paid", "created", "expired", "cancelled"), or None when there is no link
    or Razorpay could not be reached.
    """
    if not order.payment_link_id:
        return None

    try:
        link = client.payment_link.fetch(order.payment_link_id)
    except Exception as exc:
        logger.error("Payment link fetch failed for %s: %s", order.order_number, exc)
        return None

    status = link.get("status")
    if status == "paid":
        payment = next(
            (p for p in link.get("payments") or [] if p.get("status") == "captured"),
            None,
        )
        record_payment_link_payment(order, (payment or {}).get("payment_id"))
    return status


def cancel_payment_link(order):
    """Stop the order's link from being paid. Returns its final status."""
    if not order.payment_link_id:
        return None

    try:
        client.payment_link.cancel(order.payment_link_id)
    except Exception as exc:
        # Already paid, expired or cancelled; sync_payment_link sorts out which.
        logger.info("Payment link cancel for %s: %s", order.order_number, exc)
    return sync_payment_link(order)


def record_payment_link_payment(order, razorpay_payment_id):
    order.refresh_from_db()

    if order.payment_status == "paid":
        if razorpay_payment_id and order.razorpay_payment_id != razorpay_payment_id:
            # Paid twice: once in checkout and once through the link.
            logger.error(
                "DUPLICATE PAYMENT: order %s already paid by %s, link paid by %s",
                order.order_number, order.razorpay_payment_id, razorpay_payment_id,
            )
            Order.objects.filter(id=order.id).update(
                payment_error=f"DUPLICATE: also paid via link {razorpay_payment_id} - refund it"[:255]
            )
        return order

    return finalize_paid_order(order=order, razorpay_payment_id=razorpay_payment_id)


def offer_link_for_stalled_attempt(order):
    """Text a link for an attempt that is going nowhere, without waiting for
    Razorpay to time it out.

    Called by the cleanup job once checkout has been open for
    PAYMENT_LINK_AFTER_MINUTES. If a payment did go through it is recorded
    instead. The attempt itself is left open: if its UPI payment completes
    after all, finalizing the order cancels the link.
    """
    if order.payment_status != "pending" or order.payment_link_id or not order.razorpay_order_id:
        return order

    payments = client.order.payments(order.razorpay_order_id).get("items", [])
    settled = next(
        (p for p in payments if p.get("status") in ("captured", "authorized")),
        None,
    )
    if settled:
        ensure_payment_captured(settled.get("id"), settled.get("amount"))
        return finalize_paid_order(order=order, razorpay_payment_id=settled.get("id"))

    reason = (
        "Payment not completed within 5 minutes"
        if payments else "Payment not started within 5 minutes"
    )
    send_payment_link(order, reason)
    order.refresh_from_db()
    return order


def settle_abandoned_attempt(order, reason="", offer_payment_link=False):
    """Close out a payment attempt the customer walked away from.

    Razorpay is asked first: if a payment did go through, the order is
    finalized instead, and if one is still in progress (customer in their UPI
    app) the order is left alone. Only when the gateway confirms nothing was
    paid does the order move on: with `offer_payment_link` the customer is
    texted a payment link and the stock stays reserved for it; otherwise any
    link is cancelled, the reservation released and the order marked failed.
    Gateway errors propagate so the caller can leave the order for the cleanup
    job to recheck.
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

    if any(p.get("status") == "created" for p in payments):
        # Still in flight. Its webhook (or the cleanup job) settles it.
        return order

    order.refresh_from_db()
    if order.payment_link_id:
        if offer_payment_link and payment_link_is_live(order):
            return order
        if cancel_payment_link(order) == "paid":
            order.refresh_from_db()
            return order
    elif offer_payment_link and send_payment_link(order, reason):
        order.refresh_from_db()
        return order

    release_order_stock(order)
    order.refresh_from_db()

    # A webhook may have finalized it while the stock was being released.
    if order.payment_status == "pending":
        order.payment_status = "failed"
        order.payment_error = (reason or order.payment_error or "")[:255]
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
        sorted_items = sorted(
            (item for item in order_items if item.variant_id),
            key=lambda item: item.variant_id,
        )

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

        if order.payment_link_id:
            # Paid some other way while its link was live: close the link so it
            # cannot be paid a second time. Also flags it if it already was.
            transaction.on_commit(lambda: cancel_payment_link(order))

        return order


@api_view(["POST"])
@permission_classes([AllowAny])
def create_order(request):
    data = request.data
    items = data.get("items", [])

    def reject(message, status=400, **details):
        # Logged so a rejected checkout can be explained afterwards.
        logger.warning(
            "create_order rejected (%s): %s | phone=%s items=%s %s",
            status, message, mask_phone(data.get("phone")), items, details or "",
        )
        return Response({"error": message}, status=status)

    if not items:
        return reject("No items in the order.")

    aggregated_items = {}
    for item in items:
        variant_id = item.get("variant")
        quantity = int(item.get("quantity", 1))
        if variant_id and quantity > 0:
            aggregated_items[variant_id] = aggregated_items.get(variant_id, 0) + quantity

    if not aggregated_items:
        return reject("No valid items in the order.")

    # The customer's previous attempt (closed modal, page reloaded while they
    # were in their UPI app) still holds its stock. Settle it first, or a
    # retry fails the stock check against their own reservation.
    previous_attempts = []
    previous_razorpay_order_id = data.get("previous_razorpay_order_id")
    if previous_razorpay_order_id:
        previous_attempts += Order.objects.filter(
            razorpay_order_id=previous_razorpay_order_id,
            payment_status="pending",
        )

    # The same customer retrying from another browser (e.g. after switching
    # from Instagram to Chrome), or with the cart slightly changed, while an
    # earlier attempt still holds some of these items (often with a payment
    # link out). Settle it, so the retry is not blocked by the customer's own
    # reservation and the old link cannot be paid as well.
    phone = data.get("phone")
    if phone:
        wanted = {int(v) for v in aggregated_items}
        for candidate in Order.objects.filter(
            phone=phone,
            payment_status="pending",
            stock_released=False,
        ).prefetch_related("items"):
            overlaps = wanted & {i.variant_id for i in candidate.items.all()}
            if overlaps and candidate not in previous_attempts:
                previous_attempts.append(candidate)

    for previous_order in previous_attempts:
        try:
            previous_order = settle_abandoned_attempt(
                previous_order, "Superseded by a new checkout attempt"
            )
        except Exception as e:
            # The cleanup job will release it; never block a new order on this.
            logger.warning("Could not settle previous attempt %s: %s", previous_order.order_number, e)
            continue

        if previous_order.payment_status == "paid":
            # That attempt (or its payment link) was paid after all.
            logger.info("create_order: earlier attempt %s already paid", previous_order.order_number)
            return Response({
                "error": "Your earlier payment for this order went through.",
                "already_paid": True,
                "order_number": previous_order.order_number,
            }, status=409)

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
                opened_in_instagram="Instagram" in request.META.get("HTTP_USER_AGENT", ""),
                opened_on_android="Android" in request.META.get("HTTP_USER_AGENT", ""),
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
                    .select_related("product", "color")
                    # A hidden product can no longer be bought.
                    .get(id=variant_id, product__is_active=True)
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

                order_item = OrderItem(order=order, variant=variant, quantity=quantity)
                order_item.fill_snapshot()
                order_item.save()

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
        return reject(str(e))

    except ProductVariant.DoesNotExist:
        return reject("One or more products no longer exist.")

    except Exception as e:
        logger.exception("create_order failed: %s", e)
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
            elif order.payment_link_id:
                sync_payment_link(order)
                order.refresh_from_db()
        except Exception as e:
            logger.error("payment_status recheck failed for %s: %s", order.order_number, e)

    return Response({
        "order_number": order.order_number,
        "payment_status": order.payment_status,
        "status": order.status,
        **payment_link_summary(order),
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
    # is no live payment on this order. If it agrees, text a payment link.
    try:
        order = settle_abandoned_attempt(order, reason, offer_payment_link=True)
    except Exception as e:
        logger.error("Failure report recheck failed for %s: %s", order.order_number, e)

    return Response({"payment_status": order.payment_status, **payment_link_summary(order)})


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
                order = settle_abandoned_attempt(order, reason, offer_payment_link=True)
            except Exception as e:
                logger.error("Callback failure recheck failed for %s: %s", order.order_number, e)

            if order.payment_status == "paid":
                return _redirect_to_frontend("/order-success", order=order.order_number)

            if payment_link_summary(order)["payment_link_sent"]:
                return _redirect_to_frontend("/checkout", payment="failed", link="sent")

    return _redirect_to_frontend("/checkout", payment="failed")


def payment_link_callback(request):
    """Razorpay sends the customer here after they pay a texted payment link."""
    params = {
        "razorpay_payment_id": request.GET.get("razorpay_payment_id", ""),
        "payment_link_id": request.GET.get("razorpay_payment_link_id", ""),
        "payment_link_reference_id": request.GET.get("razorpay_payment_link_reference_id", ""),
        "payment_link_status": request.GET.get("razorpay_payment_link_status", ""),
        "razorpay_signature": request.GET.get("razorpay_signature", ""),
    }

    order = Order.objects.filter(payment_link_id=params["payment_link_id"]).first()
    if not order:
        return _redirect_to_frontend("/")

    try:
        verified = client.utility.verify_payment_link_signature(params) is not False
    except Exception:
        verified = False

    if verified and params["payment_link_status"] == "paid":
        try:
            record_payment_link_payment(order, params["razorpay_payment_id"])
        except Exception as e:
            # The signature proves the payment happened; the webhook and the
            # cleanup job will finish recording it.
            logger.exception("Payment link callback finalize failed for %s: %s", order.order_number, e)
        return _redirect_to_frontend("/order-success", order=order.order_number)

    # Unsigned or unpaid: trust only what Razorpay itself reports.
    sync_payment_link(order)
    order.refresh_from_db()
    if order.payment_status == "paid":
        return _redirect_to_frontend("/order-success", order=order.order_number)
    return _redirect_to_frontend("/cart", payment="failed")


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
            "payment_link.paid",
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

            # Final only if nothing else succeeded on this order. If it really
            # failed, the customer is texted a payment link. `description` on
            # the payment is our own checkout text, not the error.
            settle_abandoned_attempt(
                order,
                payment_entity.get("error_description") or payment_entity.get("error_reason") or "Payment failed",
                offer_payment_link=True,
            )

            return HttpResponse(status=200)

        # -------------------------------
        # PAYMENT LINK PAID
        # -------------------------------
        if event == "payment_link.paid":
            event_payload = payload.get("payload", {})
            link_entity = event_payload.get("payment_link", {}).get("entity", {})
            payment_entity = event_payload.get("payment", {}).get("entity", {})

            order = Order.objects.get(payment_link_id=link_entity.get("id"))
            record_payment_link_payment(order, payment_entity.get("id"))

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
                    "variant_name": item.display_name,
                    "quantity": item.quantity
                }
                for item in order.items.all()
            ]
        })

    return Response(data)
