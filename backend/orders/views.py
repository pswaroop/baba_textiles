import razorpay
from django.conf import settings
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db import transaction

from .models import Order, OrderItem
from products.models import ProductVariant
from django.template.loader import render_to_string
# from weasyprint import HTML
from django.http import HttpResponse
from .models import Order
from decimal import Decimal, ROUND_HALF_UP

# Razorpay client
client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))



@api_view(["POST"])
def create_payment(request):
    try:
        amount = request.data.get("amount")

        if not amount:
            return Response({"error": "Amount is required"}, status=400)

        amount = int(float(amount) * 100)  # convert to paise safely

        payment = client.order.create({
            "amount": amount,
            "currency": "INR",
            "payment_capture": 1
        })

        return Response({
            "razorpay_order_id": payment["id"],
            "amount": payment["amount"],
            "key": settings.RAZORPAY_KEY_ID
        })

    except Exception as e:
        print("🔥 CREATE PAYMENT ERROR:", e)
        return Response({"error": str(e)}, status=500)


# VERIFY PAYMENT
@api_view(["POST"])
def verify_payment(request):

    data = request.data

    try:

        client.utility.verify_payment_signature({
            "razorpay_order_id": data["razorpay_order_id"],
            "razorpay_payment_id": data["razorpay_payment_id"],
            "razorpay_signature": data["razorpay_signature"]
        })

        return Response({
            "status": "success"
        })

    except:

        return Response({
            "status": "failed"
        })


# CREATE FINAL ORDER AFTER PAYMENT
@api_view(["POST"])
def create_order(request):
    data = request.data
    items = data.get("items", [])
    
    # ✅ FIX 1: Extract these from data first
    razorpay_payment_id = data.get("razorpay_payment_id")
    razorpay_signature = data.get("razorpay_signature")

    with transaction.atomic():
        order = Order.objects.create(
            user=request.user if request.user.is_authenticated else None,
            
            customer_name=data.get("name", "Guest"),
            phone=data.get("phone"),
            address=data.get("address"),
            city=data.get("city"),
            state=data.get("state"),
            pincode=data.get("pincode"),
            
            payment_status="paid",
            razorpay_order_id=data.get("razorpay_order_id"),
            razorpay_payment_id=razorpay_payment_id, # Now this works
            razorpay_signature=razorpay_signature    # Now this works
        )

        total = 0
        for item in items:
            variant = ProductVariant.objects.get(id=item["variant"])
            quantity = item["quantity"]

            OrderItem.objects.create(
                order=order,
                variant=variant,
                quantity=quantity
            )

            total += variant.product.price * quantity

        order.total_amount = total
        order.save()

    return Response({
        "order_number": order.order_number
    })
def download_invoices(request):
    try:
        from weasyprint import HTML
    except (ImportError, OSError):
        return HttpResponse("<h1>PDF Error</h1><p>GTK+ libraries missing.</p>", status=501)

    # 1. Get IDs from request
    order_param = request.GET.get("orders", "")
    if "," in order_param:
        order_ids = order_param.split(",")
    else:
        order_ids = request.GET.getlist("orders")

    # 2. Fetch orders
    orders = Order.objects.filter(id__in=order_ids)

    if not orders.exists():
        return HttpResponse("No orders found.", status=404)

    # 3. Process GST Calculations for each order
    processed_orders = []
    for order in orders:
        total = Decimal(str(order.total_amount))
        
        # Formula for Tax Inclusive: Taxable Value = Total / (1 + Tax Rate)
        # For 5% GST: Total / 1.05
        taxable_amount = (total / Decimal('1.05')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        total_gst = total - taxable_amount
        
        # Split GST 50/50 for CGST and SGST
        cgst = (total_gst / 2).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        sgst = (total_gst / 2).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        # Attach these calculated values back to the order object for the template
        order.taxable_amount = taxable_amount
        order.cgst = cgst
        order.sgst = sgst
        processed_orders.append(order)

    # 4. Render Template
    html_string = render_to_string("invoices/invoice.html", {"orders": processed_orders})

    try:
        pdf = HTML(string=html_string).write_pdf()
        response = HttpResponse(pdf, content_type="application/pdf")
        response["Content-Disposition"] = "attachment; filename=invoices.pdf"
        return response
    except Exception as e:
        return HttpResponse(f"Error: {e}", status=500)


from rest_framework.decorators import permission_classes
from rest_framework.permissions import IsAuthenticated

# ✅ This view fetches the logged-in user's order history
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_orders(request):
    # Filters orders belonging to the authenticated user
    orders = Order.objects.filter(user=request.user).order_by('-created_at')
    
    data = []
    for order in orders:
        data.append({
    "id": order.id,
    "order_number": order.order_number,
    "created_at": order.created_at,
    "status": order.status,  # ✅ ADD THIS
    "items": [
        {
            "variant_name": str(item.variant),
            "quantity": item.quantity
        } for item in order.items.all()
    ]
})
    return Response(data)