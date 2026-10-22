import secrets
import string
from django.conf import settings
from django.db import models


def generate_order_number():
    """Generate random 8 character order id"""
    chars = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(chars) for _ in range(8))


class Order(models.Model):
    PAYMENT_STATUS = [
        ("pending", "Pending"),
        ("paid", "Paid"),
        ("expired", "Expired"),
        ("failed", "Failed"),
        ("refund", "Refund"),
    ]

    STATUS_CHOICES = [
        ("processed", "Processed"),
        ("confirmed", "Confirmed"),
        ("shipped", "Shipped"),
        ("delivered", "Delivered"),
        ("cancelled", "Cancelled"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="orders",
        db_index=True,
    )

    order_number = models.CharField(
        max_length=20,
        unique=True,
        default=generate_order_number,
        editable=False,
        db_index=True,
    )

    customer_name = models.CharField(max_length=100, default="Guest", db_index=True)
    phone = models.CharField(max_length=15, blank=True, null=True, db_index=True)
    address = models.TextField(blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    state = models.CharField(max_length=100, blank=True, null=True)
    pincode = models.CharField(max_length=10, blank=True, null=True)

    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    payment_status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS,
        default="pending",
        db_index=True,
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="processed",
        db_index=True,
    )

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    # True once the reserved stock for this order has been handed back to the
    # pool (expiry / failed payment). Guards against releasing or re-deducting
    # the same reservation twice when a late webhook arrives after cleanup.
    stock_released = models.BooleanField(default=False)

    # Last gateway error seen for this order, kept for support/debugging.
    payment_error = models.CharField(max_length=255, blank=True, null=True)

    razorpay_order_id = models.CharField(max_length=200, blank=True, null=True, db_index=True)
    razorpay_payment_id = models.CharField(max_length=200, blank=True, null=True, db_index=True)
    razorpay_signature = models.CharField(max_length=500, blank=True, null=True)

    # Razorpay Payment Link texted to the customer after a failed checkout
    # attempt. While it is live the order stays `pending` and keeps its stock.
    payment_link_id = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    payment_link_url = models.URLField(max_length=300, blank=True, null=True)
    payment_link_sent_at = models.DateTimeField(blank=True, null=True)
    payment_link_expires_at = models.DateTimeField(blank=True, null=True)

    # Checkout ran inside Instagram's in-app browser, where UPI apps often fail
    # to open.
    opened_in_instagram = models.BooleanField(default=False)
    # Checkout ran on an Android phone (any browser). These orders are texted a
    # payment link too.
    opened_on_android = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["-created_at"]),
            models.Index(fields=["payment_status", "-created_at"]),
            models.Index(fields=["status", "-created_at"]),
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["order_number"]),
            models.Index(fields=["phone"]),
        ]

    def __str__(self):
        return f"Order #{self.order_number}"


class OrderItem(models.Model):
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="items",
        db_index=True,
    )

    variant = models.ForeignKey(
        "products.ProductVariant",
        on_delete=models.CASCADE,
        db_index=True,
    )

    quantity = models.PositiveIntegerField()

    class Meta:
        indexes = [
            models.Index(fields=["order"]),
            models.Index(fields=["variant"]),
        ]

    def __str__(self):
        return f"{self.variant} x {self.quantity}"
