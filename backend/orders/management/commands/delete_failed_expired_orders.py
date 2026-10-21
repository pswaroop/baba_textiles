
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from orders.models import Order


class Command(BaseCommand):
    help = "Delete orders with failed or expired payment status."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show the orders that would be deleted without deleting them.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        statuses = ["failed", "expired"]

        # Never delete an order whose payment link can still be paid.
        orders = Order.objects.filter(payment_status__in=statuses).exclude(
            payment_link_expires_at__gt=timezone.now()
        )

        total_count = orders.count()

        if total_count == 0:
            self.stdout.write(
                self.style.SUCCESS(
                    "No failed or expired orders found."
                )
            )
            return

        self.stdout.write(
            f"Found {total_count} orders with failed or expired payments."
        )

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    "DRY RUN: No orders have been deleted."
                )
            )

            for order in orders.iterator():
                self.stdout.write(
                    f"Order #{order.order_number} | "
                    f"Payment: {order.payment_status} | "
                    f"Created: {order.created_at}"
                )

            return

        with transaction.atomic():
            deleted_count, deleted_details = orders.delete()

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully deleted {total_count} orders."
            )
        )

        for model_name, count in deleted_details.items():
            self.stdout.write(f"{model_name}: {count} records deleted.")
