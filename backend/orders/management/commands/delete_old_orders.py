
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from orders.models import Order


class Command(BaseCommand):
    help = "Delete orders older than the past 3 months."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Preview orders without deleting them.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        # Keep orders created within the last 3 months.
        cutoff_date = timezone.now() - timedelta(days=90)

        old_orders = Order.objects.filter(
            created_at__lt=cutoff_date
        )

        total_count = old_orders.count()

        self.stdout.write(
            f"Cutoff date: {cutoff_date:%Y-%m-%d %H:%M:%S}"
        )
        self.stdout.write(
            f"Orders older than cutoff: {total_count}"
        )

        if total_count == 0:
            self.stdout.write(
                self.style.SUCCESS("No old orders found.")
            )
            return

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    "DRY RUN: No orders have been deleted."
                )
            )

            for order in old_orders.iterator():
                self.stdout.write(
                    f"Order #{order.order_number} | "
                    f"Payment: {order.payment_status} | "
                    f"Created: {order.created_at}"
                )
            return

        with transaction.atomic():
            deleted_count, deleted_details = old_orders.delete()

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully deleted {total_count} old orders."
            )
        )

        for model_name, count in deleted_details.items():
            self.stdout.write(
                f"{model_name}: {count} records deleted."
            )

