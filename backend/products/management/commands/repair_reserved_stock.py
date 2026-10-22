from collections import defaultdict

from django.core.management.base import BaseCommand
from django.db import transaction

from orders.models import OrderItem
from products.models import ProductVariant


class Command(BaseCommand):
    help = (
        "Report sizes whose reserved_stock does not match what live pending "
        "orders actually hold. With --apply, set it to the held amount."
    )

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Write the corrected values.")

    def handle(self, *args, **options):
        apply = options["apply"]

        with transaction.atomic():
            # Locked so a checkout cannot reserve or release in between the
            # count and the correction.
            variants = list(
                ProductVariant.objects.select_for_update()
                .select_related("product")
                .order_by("id")
            )

            held = defaultdict(int)
            for item in OrderItem.objects.filter(
                order__payment_status="pending", order__stock_released=False
            ).values("variant_id", "quantity"):
                held[item["variant_id"]] += item["quantity"]

            mismatched = [v for v in variants if v.reserved_stock != held.get(v.id, 0)]

            for v in mismatched:
                correct = held.get(v.id, 0)
                self.stdout.write(
                    f"{v.id:6} {v.product.name[:40]:40} {v.size:4} stock={v.stock} "
                    f"reserved={v.reserved_stock} -> {correct} "
                    f"(available {max(0, v.stock - v.reserved_stock)} -> {max(0, v.stock - correct)})"
                )
                if apply:
                    v.reserved_stock = correct
                    v.save(update_fields=["reserved_stock"])

        verb = "Corrected" if apply else "Would correct (dry run; pass --apply)"
        self.stdout.write(self.style.SUCCESS(f"{verb}: {len(mismatched)} sizes."))
