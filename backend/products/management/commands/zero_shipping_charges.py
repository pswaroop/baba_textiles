from django.core.management.base import BaseCommand

from products.models import Product


class Command(BaseCommand):
    help = "Set shipping_charge to 0 for every product. Take a backup first with backup_shipping_charges."

    def add_arguments(self, parser):
        parser.add_argument(
            "--yes",
            action="store_true",
            help="Skip the confirmation prompt (for non-interactive/scripted use).",
        )

    def handle(self, *args, **options):
        count = Product.objects.count()

        if not options["yes"]:
            confirm = input(
                f"This will set shipping_charge=0 for all {count} products. "
                f"Make sure you've already run backup_shipping_charges. "
                f"Type 'yes' to continue: "
            )
            if confirm.strip().lower() != "yes":
                self.stdout.write(self.style.WARNING("Aborted — no changes made."))
                return

        # .update() issues a single SQL UPDATE and bypasses Product.save(),
        # which is fine here — save() only recalculates discount_percentage
        # from original_price/price, neither of which this touches.
        updated = Product.objects.update(shipping_charge=0)
        self.stdout.write(self.style.SUCCESS(f"Set shipping_charge=0 for {updated} products."))
