import json
from decimal import Decimal, ROUND_HALF_UP

import razorpay
from django.conf import settings
from django.db import transaction
from django.http import HttpResponse
from django.template.loader import render_to_string
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Order, OrderItem
from products.models import ProductVariant


client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))


def finalize_paid_order(order, razorpay_payment_id=None, razorpay_signature=None):
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

        for item in sorted_items:
            variant = ProductVariant.objects.select_for_update().get(id=item.variant.id)

            if variant.stock < item.quantity:
                raise ValueError(
                    f"Stock became unavailable for {variant.product.name} - {variant.size}. "
                    f"Available: {variant.stock}, Required: {item.quantity}"
                )

            # ✅ Convert reserved stock into actual sold stock deduction
            variant.reserved_stock = max(0, variant.reserved_stock - item.quantity)
            variant.stock -= item.quantity
            variant.save(update_fields=["reserved_stock", "stock"])

        update_fields = ["payment_status"]

        order.payment_status = "paid"

        if razorpay_payment_id:
            order.razorpay_payment_id = razorpay_payment_id
            update_fields.append("razorpay_payment_id")

        if razorpay_signature:
            order.razorpay_signature = razorpay_signature
            update_fields.append("razorpay_signature")

        order.save(update_fields=update_fields)
        return order


@api_view(["POST"])
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
        # for Razorpay's network to respond. If Razorpay API fails here, the stock 
        # is safely reserved in DB and will just be auto-released by the 15-minute cron job.
        razorpay_order = client.order.create({
            "amount": amount_in_paise,
            "currency": "INR",
            "payment_capture": 1,
            "receipt": order.order_number,
        })

        order.razorpay_order_id = razorpay_order["id"]
        order.save(update_fields=["razorpay_order_id"])

        return Response({
            "order_number": order.order_number,
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

        order = Order.objects.get(razorpay_order_id=razorpay_order_id)

        finalized_order = finalize_paid_order(
            order=order,
            razorpay_payment_id=razorpay_payment_id,
            razorpay_signature=razorpay_signature
        )

        return Response({
            "status": "success",
            "order_number": finalized_order.order_number
        })

    except Order.DoesNotExist:
        return Response(
            {"status": "failed", "error": "Order not found in database"},
            status=400
        )

    except ValueError as e:
        return Response(
            {"status": "failed", "error": str(e)},
            status=400
        )

    except Exception as e:
        print("🔥 VERIFY PAYMENT ERROR:", str(e))
        return Response(
            {"status": "failed", "error": "Invalid payment signature or server error"},
            status=400
        )


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
            "payment.captured",
            "order.paid",
            "refund.created",
            "refund.processed",
        ]

        if event not in allowed_events:
            return HttpResponse(status=200)

        # -------------------------------
        # PAYMENT SUCCESS EVENTS
        # -------------------------------
        if event in ["payment.captured", "order.paid"]:
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

            finalize_paid_order(
                order=order,
                razorpay_payment_id=razorpay_payment_id
            )

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
        return HttpResponse("Order not found", status=404)

    except Exception as e:
        print("🔥 WEBHOOK ERROR:", str(e))
        return HttpResponse("Webhook processing failed", status=400)


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
    orders = Order.objects.filter(user=request.user).order_by("-created_at")

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
