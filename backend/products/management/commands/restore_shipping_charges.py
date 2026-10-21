import json
from decimal import Decimal, InvalidOperation

from django.core.management.base import BaseCommand, CommandError

from products.models import Product


class Command(BaseCommand):
    help = "Restore each product's shipping_charge from a JSON file produced by backup_shipping_charges."

    def add_arguments(self, parser):
        parser.add_argument("backup_file", help="Path to the backup JSON file")
        parser.add_argument(
            "--yes",
            action="store_true",
            help="Skip the confirmation prompt (for non-interactive/scripted use).",
        )

    def handle(self, *args, **options):
        path = options["backup_file"]

        try:
            with open(path) as f:
                data = json.load(f)
        except FileNotFoundError:
            raise CommandError(f"Backup file not found: {path}")
        except json.JSONDecodeError as e:
            raise CommandError(f"Invalid JSON in {path}: {e}")

        if not options["yes"]:
            confirm = input(
                f"This will restore shipping_charge for {len(data)} products from {path}. "
                f"Type 'yes' to continue: "
            )
            if confirm.strip().lower() != "yes":
                self.stdout.write(self.style.WARNING("Aborted — no changes made."))
                return

        products_by_id = {
            p.id: p for p in Product.objects.filter(id__in=[row["id"] for row in data])
        }

        to_update = []
        missing = []
        bad = []
        for row in data:
            product = products_by_id.get(row["id"])
            if product is None:
                missing.append(row["id"])
                continue
            try:
                product.shipping_charge = Decimal(str(row["shipping_charge"]))
            except (InvalidOperation, TypeError):
                bad.append(row["id"])
                continue
            to_update.append(product)

        Product.objects.bulk_update(to_update, ["shipping_charge"], batch_size=500)

        self.stdout.write(self.style.SUCCESS(f"Restored shipping_charge for {len(to_update)} products."))
        if missing:
            self.stdout.write(self.style.WARNING(
                f"{len(missing)} products from the backup no longer exist in the DB and were skipped: {missing}"
            ))
        if bad:
            self.stdout.write(self.style.ERROR(
                f"{len(bad)} rows had an unreadable shipping_charge and were skipped: {bad}"
            ))
