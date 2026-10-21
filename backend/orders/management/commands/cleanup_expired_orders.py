from datetime import timedelta

import razorpay
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from orders.models import Order
from orders.views import (
    cancel_payment_link,
    ensure_payment_captured,
    finalize_paid_order,
    payment_link_is_live,
)
from products.models import ProductVariant


client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))


class Command(BaseCommand):
    help = "Release reserved stock for pending orders older than 18 minutes, after rechecking Razorpay"

    # Razorpay gives the customer ~12 minutes to complete a payment, and
    # Checkout is configured to time out at 12 (see Checkout.tsx), so an order
    # older than this has no live attempt against it. The 6 minute gap is the
    # safety margin — an order is never expired while Checkout is still open.
    # What actually protects in-flight payments is the gateway recheck below,
    # not the length of this window.
    EXPIRY_MINUTES = 18

    def handle(self, *args, **options):
        expiry_threshold = timezone.now() - timedelta(minutes=self.EXPIRY_MINUTES)

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

                    # The customer was texted a payment link: keep the stock for
                    # them until it expires, then make sure it was not paid.
                    if locked_order.payment_link_id:
                        if payment_link_is_live(locked_order):
                            skipped_count += 1
                            continue

                        link_status = cancel_payment_link(locked_order)
                        if link_status is None:
                            # Could not verify; never expire a possibly paid order.
                            skipped_count += 1
                            continue
                        if link_status == "paid":
                            recovered_count += 1
                            self.stdout.write(
                                self.style.WARNING(
                                    f"Recovered order paid by payment link: {locked_order.order_number}"
                                )
                            )
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

                            # An `authorized` payment is real money held against
                            # this order — capture it instead of expiring the
                            # order and letting the authorisation lapse.
                            authorized_payment = next(
                                (p for p in payment_items if p.get("status") == "authorized"),
                                None
                            )

                            if authorized_payment and not captured_payment:
                                ensure_payment_captured(
                                    authorized_payment.get("id"),
                                    authorized_payment.get("amount"),
                                )
                                captured_payment = authorized_payment

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

                            # A payment is still mid-flight (the customer is on
                            # the UPI app / bank page). Leave it for the next run.
                            if any(
                                p.get("status") in ("created", "pending")
                                for p in payment_items
                            ):
                                skipped_count += 1
                                continue

                        except Exception as gateway_error:
                            # Never expire an order we could not verify — a
                            # gateway blip would cancel a paid order.
                            self.stderr.write(
                                f"⚠️ Razorpay recheck failed for order {locked_order.order_number}: {str(gateway_error)}"
                            )
                            skipped_count += 1
                            continue

                    if not locked_order.stock_released:
                        items = sorted(order.items.all(), key=lambda i: i.variant.id)

                        for item in items:
                            variant = (
                                ProductVariant.objects
                                .select_for_update()
                                .get(id=item.variant.id)
                            )

                            variant.reserved_stock = max(0, variant.reserved_stock - item.quantity)
                            variant.save(update_fields=["reserved_stock"])

                        locked_order.stock_released = True

                    locked_order.payment_status = "expired"
                    locked_order.save(update_fields=["payment_status", "stock_released"])

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
