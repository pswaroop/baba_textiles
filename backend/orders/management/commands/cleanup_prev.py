from datetime import timedelta

import razorpay
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from orders.models import Order
from orders.views import finalize_paid_order
from products.models import ProductVariant


client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))


class Command(BaseCommand):
    help = "Release reserved stock for pending orders older than 18 minutes, after rechecking Razorpay"

    def handle(self, *args, **options):
        expiry_threshold = timezone.now() - timedelta(minutes=18)

        expired_orders = (
            Order.objects
            .filter(
                payment_status="pending",
                created_at__lt=expiry_threshold,
            )
            .prefetch_related("items", "items__variant")
        )

        released_count = 0
        recovered_count = 0
        skipped_count = 0

        for order in expired_orders:
            try:
                with transaction.atomic():
                    locked_order = Order.objects.select_for_update().get(id=order.id)

                    if locked_order.payment_status != "pending":
                        skipped_count += 1
                        continue

                    if locked_order.razorpay_order_id:
                        try:
                            razorpay_order = client.order.fetch(locked_order.razorpay_order_id)
                            razorpay_payments = client.order.payments(locked_order.razorpay_order_id)
                            payment_items = razorpay_payments.get("items", [])

                            captured_payment = next(
                                (
                                    p for p in payment_items
                                    if p.get("status") == "captured" or p.get("captured") is True
                                ),
                                None
                            )

                            if razorpay_order.get("status") == "paid" or captured_payment:
                                finalized_order = finalize_paid_order(
                                    order=locked_order,
                                    razorpay_payment_id=(captured_payment or {}).get("id")
                                )
                                recovered_count += 1
                                self.stdout.write(
                                    self.style.WARNING(
                                        f"Recovered paid Razorpay order before expiry: {finalized_order.order_number}"
                                    )
                                )
                                continue

                        except Exception as gateway_error:
                            self.stderr.write(
                                f"⚠️ Razorpay recheck failed for order {locked_order.order_number}: {str(gateway_error)}"
                            )

                    items = sorted(order.items.all(), key=lambda i: i.variant.id)

                    for item in items:
                        variant = (
                            ProductVariant.objects
                            .select_for_update()
                            .get(id=item.variant.id)
                        )

                        variant.reserved_stock = max(0, variant.reserved_stock - item.quantity)
                        variant.save(update_fields=["reserved_stock"])

                    locked_order.payment_status = "expired"
                    locked_order.save(update_fields=["payment_status"])

                    released_count += 1
                    self.stdout.write(
                        f"✅ Released stock for order {locked_order.order_number}"
                    )

            except Exception as e:
                self.stderr.write(
                    f"🔥 Error releasing stock for order {order.id}: {str(e)}"
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. Released: {released_count} orders. "
                f"Recovered paid: {recovered_count} orders. "
                f"Skipped: {skipped_count} orders."
            )
        )
