from collections import defaultdict
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from orders.models import Order
from orders.views import client


class Command(BaseCommand):
    help = (
        "Compare Razorpay Checkout opened as a redirect vs a popup for "
        "Instagram-Android customers: paid rate, and how often UPI apps never "
        "opened (payment_timed_out with no VPA)."
    )

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=7)

    def handle(self, *args, **options):
        since = timezone.now() - timedelta(days=options["days"])
        orders = Order.objects.filter(
            created_at__gte=since,
            opened_in_instagram=True,
            opened_on_android=True,
            checkout_mode__in=["redirect", "popup"],
        ).exclude(razorpay_order_id__isnull=True)

        stats = defaultdict(lambda: defaultdict(int))
        customers = defaultdict(lambda: defaultdict(set))
        for order in orders.iterator():
            s = stats[order.checkout_mode]
            s["orders"] += 1
            s["paid"] += order.payment_status == "paid"
            customers[order.checkout_mode]["all"].add(order.phone)
            if order.payment_status == "paid":
                customers[order.checkout_mode]["paid"].add(order.phone)
            try:
                payments = client.order.payments(order.razorpay_order_id).get("items", [])
            except Exception:
                s["gateway errors"] += 1
                continue
            if not payments:
                s["no payment attempted"] += 1
            for p in payments:
                if p.get("method") != "upi":
                    continue
                s["upi attempts"] += 1
                if p.get("status") in ("captured", "authorized", "refunded"):
                    s["upi paid"] += 1
                elif p.get("error_reason") == "payment_timed_out" and not p.get("vpa"):
                    s["upi app never opened"] += 1

        self.stdout.write(f"Instagram on Android, last {options['days']} days")
        for mode in ("redirect", "popup"):
            s = stats[mode]
            pct = lambda a, b: f"{100 * a / b:.0f}%" if b else "-"
            c_all, c_paid = len(customers[mode]["all"]), len(customers[mode]["paid"])
            self.stdout.write(
                f"  {mode:8} orders {s['orders']:4} | paid {pct(s['paid'], s['orders']):>4} | "
                f"customers who paid {c_paid}/{c_all} ({pct(c_paid, c_all)}) | "
                f"UPI attempts {s['upi attempts']:4}: paid {pct(s['upi paid'], s['upi attempts']):>4}, "
                f"app never opened {pct(s['upi app never opened'], s['upi attempts']):>4} | "
                f"no attempt {pct(s['no payment attempted'], s['orders']):>4}"
            )
