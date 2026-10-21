import json
from datetime import datetime
from pathlib import Path

from django.core.management.base import BaseCommand

from products.models import Product


class Command(BaseCommand):
    help = "Back up the current shipping_charge of every product to a timestamped JSON file."

    def add_arguments(self, parser):
        parser.add_argument(
            "--output-dir",
            default="backups",
            help="Directory (relative to manage.py, or absolute) to write the backup file into. Default: backups/",
        )

    def handle(self, *args, **options):
        products = Product.objects.all().order_by("id").values(
            "id", "code", "name", "shipping_charge"
        )

        # shipping_charge is a Decimal — store as a string so JSON round-trips
        # it exactly instead of drifting through float parsing.
        data = [
            {
                "id": p["id"],
                "code": p["code"],
                "name": p["name"],
                "shipping_charge": str(p["shipping_charge"]),
            }
            for p in products
        ]

        out_dir = Path(options["output_dir"])
        out_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        out_path = out_dir / f"shipping_charges_backup_{timestamp}.json"

        with open(out_path, "w") as f:
            json.dump(data, f, indent=2)

        self.stdout.write(
            self.style.SUCCESS(f"Backed up {len(data)} products' shipping_charge to {out_path}")
        )
