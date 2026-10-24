"""Payment-link fallback and checkout settlement, against a fake Razorpay.

Run: python manage.py test orders
"""
import json
from datetime import timedelta
from io import StringIO
from unittest import mock

from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from orders.models import Order, OrderItem
from products.models import Category, Product, ProductColor, ProductVariant, SIZE_CHOICES


class FakeRazorpay:
    """Just enough of razorpay.Client for the checkout flows."""

    def __init__(self):
        self.payments = {}          # razorpay order id -> list of payment dicts
        self.links = {}             # plink id -> dict
        self.n = 0
        self.order = mock.Mock()
        self.order.create.side_effect = self._order_create
        self.order.payments.side_effect = lambda oid: {"items": self.payments.get(oid, [])}
        self.order.fetch.side_effect = lambda oid: {"id": oid, "status": "attempted"}
        self.payment = mock.Mock()
        self.payment.fetch.side_effect = lambda pid: {"id": pid, "status": "captured"}
        self.payment_link = mock.Mock()
        self.payment_link.create.side_effect = self._link_create
        self.payment_link.fetch.side_effect = lambda lid: self.links[lid]
        self.payment_link.cancel.side_effect = self._link_cancel
        self.utility = mock.Mock()

    def _order_create(self, data):
        self.n += 1
        return {"id": f"order_{self.n}", "amount": data["amount"]}

    def _link_create(self, data):
        if any(l["reference_id"] == data["reference_id"] for l in self.links.values()):
            raise Exception("reference_id already exists")
        lid = f"plink_{len(self.links) + 1}"
        self.links[lid] = {"id": lid, "status": "created", "payments": [], **data}
        return {"id": lid, "short_url": f"https://rzp.io/{lid}"}

    def _link_cancel(self, lid):
        if self.links[lid]["status"] != "created":
            raise Exception("cannot cancel")
        self.links[lid]["status"] = "cancelled"

    def pay_link(self, lid, pid="pay_link"):
        self.links[lid]["status"] = "paid"
        self.links[lid]["payments"] = [{"payment_id": pid, "status": "captured"}]


@override_settings(API_URL="https://api.example.com", FRONTEND_URL="https://shop.example.com")
class PaymentLinkFlowTests(TestCase):
    def setUp(self):
        self.rzp = FakeRazorpay()
        patches = [
            mock.patch("orders.views.client", self.rzp),
            mock.patch("orders.management.commands.cleanup_expired_orders.client", self.rzp),
        ]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)

        cat = Category.objects.create(name="Sarees", slug="sarees")
        product = Product.objects.create(
            name="Cotton Saree", code="CS1", category=cat, description="x",
            original_price=1000, price=1000, shipping_charge=30,
        )
        color = ProductColor.objects.create(name="Red", color="#FF0000")
        self.variant = ProductVariant.objects.create(
            product=product, color=color, size=SIZE_CHOICES[0][0], stock=5,
        )
        self.other_variant = ProductVariant.objects.create(
            product=product, color=color, size=SIZE_CHOICES[1][0], stock=5,
        )
        self.api = APIClient()

    # ---------- helpers ----------
    INSTAGRAM_UA = "Mozilla/5.0 (Linux; Android 16; RMX5111; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/156.0 Mobile Safari/537.36 Instagram 452.0.0.48.64 Android"
    CHROME_UA = "Mozilla/5.0 (Linux; Android 16; RMX5111) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0 Mobile Safari/537.36"
    DESKTOP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0 Safari/537.36"

    def checkout(self, phone="6303570160", qty=1, previous=None, user_agent=INSTAGRAM_UA, variant=None):
        body = {
            "items": [{"variant": (variant or self.variant).id, "quantity": qty}],
            "name": "Test Customer", "phone": phone, "address": "1 Long Street Name",
            "city": "Vizag", "state": "Andhra Pradesh", "pincode": "530001",
        }
        if previous:
            body["previous_razorpay_order_id"] = previous
        return self.api.post("/api/create-order/", body, format="json", HTTP_USER_AGENT=user_agent)

    def fail_report(self, rzp_order_id, reason="Payment was unsuccessful as you could not complete it in time."):
        return self.api.post("/api/payment-failed/", {"razorpay_order_id": rzp_order_id, "reason": reason}, format="json")

    def webhook(self, event, payload):
        return self.client.post(
            "/api/webhook/", data=json.dumps({"event": event, "payload": payload}),
            content_type="application/json", HTTP_X_RAZORPAY_SIGNATURE="sig",
        )

    def reserved(self):
        self.variant.refresh_from_db()
        return self.variant.reserved_stock

    # ---------- tests ----------
    def test_confirmed_failure_texts_link_and_keeps_stock(self):
        r = self.checkout()
        rid = r.json()["razorpay_order_id"]
        self.rzp.payments[rid] = [{"id": "pay_1", "status": "failed"}]

        res = self.fail_report(rid).json()

        order = Order.objects.get(razorpay_order_id=rid)
        self.assertEqual(order.payment_status, "pending")
        self.assertTrue(res["payment_link_sent"])
        self.assertEqual(res["payment_link_phone"], "+91 63•••••160")
        self.assertEqual(self.reserved(), 1)
        link = self.rzp.links[order.payment_link_id]
        self.assertEqual(link["customer"]["contact"], "+916303570160")
        self.assertEqual(link["notify"], {"sms": True, "email": False})
        self.assertEqual(link["amount"], 103000)
        self.assertEqual(link["callback_url"], "https://api.example.com/api/payment-link-callback/")
        # Payable for 15 minutes, Razorpay's minimum.
        minutes_left = (order.payment_link_expires_at - timezone.now()).total_seconds() / 60
        self.assertAlmostEqual(minutes_left, 15, delta=0.5)
        self.assertGreaterEqual(link["expire_by"] - timezone.now().timestamp(), 15 * 60)
        self.assertEqual(res["payment_link_valid_minutes"], 15)

    def test_android_browser_failure_gets_link(self):
        rid = self.checkout(user_agent=self.CHROME_UA).json()["razorpay_order_id"]
        order = Order.objects.get(razorpay_order_id=rid)
        self.assertEqual((order.opened_in_instagram, order.opened_on_android), (False, True))
        self.rzp.payments[rid] = [{"id": "pay_1", "status": "failed"}]

        res = self.fail_report(rid).json()

        self.assertTrue(res["payment_link_sent"])
        self.assertEqual(self.reserved(), 1)

    def test_desktop_failure_gets_no_link_and_releases_stock(self):
        rid = self.checkout(user_agent=self.DESKTOP_UA).json()["razorpay_order_id"]
        self.rzp.payments[rid] = [{"id": "pay_1", "status": "failed"}]

        res = self.fail_report(rid).json()

        self.assertFalse(res["payment_link_sent"])
        self.assertEqual(res["payment_status"], "failed")
        self.assertEqual(self.reserved(), 0)
        self.rzp.payment_link.create.assert_not_called()

    def test_desktop_stalled_checkout_gets_no_link(self):
        rid = self.checkout(user_agent=self.DESKTOP_UA).json()["razorpay_order_id"]
        self.rzp.payments[rid] = [{"id": "pay_1", "status": "created"}]
        self.age(rid, 6)
        call_command("cleanup_expired_orders", stdout=StringIO(), stderr=StringIO())
        self.rzp.payment_link.create.assert_not_called()
        self.assertEqual(self.reserved(), 1)  # still in flight; released at expiry as before

    def test_link_page_shows_the_whole_order(self):
        rid = self.checkout(qty=2).json()["razorpay_order_id"]
        self.rzp.payments[rid] = [{"id": "pay_1", "status": "failed"}]
        self.fail_report(rid)
        order = Order.objects.get(razorpay_order_id=rid)

        desc = self.rzp.links[order.payment_link_id]["description"]

        self.assertEqual(
            desc,
            f"Baba Textiles - Order #{order.order_number} | Cotton Saree — Red — {self.variant.size} x 2 | "
            "Items ₹2,000 + Shipping ₹60 = Total ₹2,060 | Delivering to: Vizag, Andhra Pradesh - 530001",
        )

    def test_checkout_mode_is_recorded_and_whitelisted(self):
        def create(mode):
            body = {"items": [{"variant": self.variant.id, "quantity": 1}], "phone": "6303570160", "checkout_mode": mode}
            r = self.api.post("/api/create-order/", body, format="json", HTTP_USER_AGENT=self.INSTAGRAM_UA)
            return Order.objects.get(razorpay_order_id=r.json()["razorpay_order_id"])
        self.assertEqual(create("popup").checkout_mode, "popup")
        self.assertEqual(self.rzp.order.create.call_args[0][0]["notes"]["checkout_mode"], "popup")
        self.assertEqual(create("redirect").checkout_mode, "redirect")
        self.assertEqual(create("<script>").checkout_mode, "")

    def test_checkout_mode_report(self):
        for i, (mode, outcome) in enumerate([("redirect", "timeout"), ("redirect", "paid"), ("popup", "paid"), ("popup", "paid")]):
            body = {"items": [{"variant": self.variant.id, "quantity": 1}], "phone": f"630357016{i}", "checkout_mode": mode}
            rid = self.api.post("/api/create-order/", body, format="json", HTTP_USER_AGENT=self.INSTAGRAM_UA).json()["razorpay_order_id"]
            if outcome == "paid":
                self.rzp.payments[rid] = [{"id": f"p{i}", "status": "captured", "method": "upi"}]
                Order.objects.filter(razorpay_order_id=rid).update(payment_status="paid")
            else:
                self.rzp.payments[rid] = [{"id": f"p{i}", "status": "failed", "method": "upi", "error_reason": "payment_timed_out", "vpa": None}]
        out = StringIO()
        call_command("checkout_mode_report", stdout=out)
        lines = out.getvalue().splitlines()
        redirect = next(l for l in lines if l.strip().startswith("redirect"))
        popup = next(l for l in lines if l.strip().startswith("popup"))
        self.assertIn("paid  50%", redirect); self.assertIn("app never opened  50%", redirect)
        self.assertIn("paid 100%", popup); self.assertIn("app never opened   0%", popup)

    def test_no_link_while_payment_still_in_progress(self):
        rid = self.checkout().json()["razorpay_order_id"]
        self.rzp.payments[rid] = [{"id": "pay_1", "status": "created"}]

        res = self.fail_report(rid, "Customer closed the payment window").json()

        self.assertFalse(res["payment_link_sent"])
        self.assertEqual(res["payment_status"], "pending")
        self.rzp.payment_link.create.assert_not_called()
        self.assertEqual(self.reserved(), 1)

    def test_webhook_and_browser_reporting_together_send_one_sms(self):
        rid = self.checkout().json()["razorpay_order_id"]
        self.rzp.payments[rid] = [{"id": "pay_1", "status": "failed"}]

        self.webhook("payment.failed", {"payment": {"entity": {
            "order_id": rid, "description": "Wholesale Order Payment",
            "error_description": "Payment was unsuccessful as you could not complete it in time.",
        }}})
        self.fail_report(rid)

        self.assertEqual(self.rzp.payment_link.create.call_count, 1)
        order = Order.objects.get(razorpay_order_id=rid)
        # The real gateway error, not our checkout description.
        self.assertEqual(order.payment_error, "Payment was unsuccessful as you could not complete it in time.")

    def test_paying_the_link_marks_order_paid_and_deducts_stock(self):
        rid = self.checkout(qty=2).json()["razorpay_order_id"]
        self.rzp.payments[rid] = [{"id": "pay_1", "status": "failed"}]
        self.fail_report(rid)
        order = Order.objects.get(razorpay_order_id=rid)

        self.rzp.pay_link(order.payment_link_id, "pay_link_1")
        self.webhook("payment_link.paid", {
            "payment_link": {"entity": {"id": order.payment_link_id, "status": "paid"}},
            "payment": {"entity": {"id": "pay_link_1", "status": "captured"}},
        })

        order.refresh_from_db()
        self.variant.refresh_from_db()
        self.assertEqual(order.payment_status, "paid")
        self.assertEqual(order.razorpay_payment_id, "pay_link_1")
        self.assertEqual((self.variant.stock, self.variant.reserved_stock), (3, 0))

    def test_link_payment_events_for_razorpays_own_order_are_ignored(self):
        # Razorpay also sends payment.captured for the link's internal order.
        res = self.webhook("payment.captured", {"payment": {"entity": {"order_id": "order_plink_internal", "id": "pay_x", "status": "captured"}}})
        self.assertEqual(res.status_code, 200)

    def test_status_poll_picks_up_link_payment_without_webhook(self):
        rid = self.checkout().json()["razorpay_order_id"]
        self.rzp.payments[rid] = [{"id": "pay_1", "status": "failed"}]
        self.fail_report(rid)
        order = Order.objects.get(razorpay_order_id=rid)
        self.rzp.pay_link(order.payment_link_id)

        res = self.api.get(f"/api/payment-status/?razorpay_order_id={rid}").json()

        self.assertEqual(res["payment_status"], "paid")

    def test_retry_with_same_cart_cancels_link_and_releases_old_stock(self):
        rid = self.checkout().json()["razorpay_order_id"]
        self.rzp.payments[rid] = [{"id": "pay_1", "status": "failed"}]
        self.fail_report(rid)
        old = Order.objects.get(razorpay_order_id=rid)

        # New browser (no previous id) but same phone and cart.
        r = self.checkout()

        self.assertEqual(r.status_code, 200)
        old.refresh_from_db()
        self.assertEqual(old.payment_status, "failed")
        self.assertEqual(self.rzp.links[old.payment_link_id]["status"], "cancelled")
        self.assertEqual(self.reserved(), 1)  # only the new attempt holds stock

    def test_retry_with_changed_quantity_is_not_blocked_by_own_hold(self):
        # The last pieces are held by the customer's own failed attempt.
        ProductVariant.objects.filter(id=self.variant.id).update(stock=2)
        rid = self.checkout(qty=2).json()["razorpay_order_id"]
        self.rzp.payments[rid] = [{"id": "pay_1", "status": "failed"}]
        self.fail_report(rid)
        old = Order.objects.get(razorpay_order_id=rid)

        r = self.checkout(qty=1)  # new browser, quantity changed

        self.assertEqual(r.status_code, 200)
        old.refresh_from_db()
        self.assertEqual(old.payment_status, "failed")
        self.assertEqual(self.rzp.links[old.payment_link_id]["status"], "cancelled")
        self.assertEqual(self.reserved(), 1)

    def test_retry_without_payment_link_is_not_blocked_by_own_hold(self):
        ProductVariant.objects.filter(id=self.variant.id).update(stock=1)
        self.checkout(qty=1, user_agent=self.DESKTOP_UA)  # abandoned, no link

        r = self.checkout(qty=1, user_agent=self.DESKTOP_UA)

        self.assertEqual(r.status_code, 200)

    def test_retry_with_different_item_leaves_link_alone(self):
        rid = self.checkout(qty=1).json()["razorpay_order_id"]
        self.rzp.payments[rid] = [{"id": "pay_1", "status": "failed"}]
        self.fail_report(rid)
        old = Order.objects.get(razorpay_order_id=rid)

        self.checkout(qty=1, variant=self.other_variant)

        old.refresh_from_db()
        self.assertEqual(old.payment_status, "pending")
        self.assertEqual(self.rzp.links[old.payment_link_id]["status"], "created")

    def test_retry_after_link_was_paid_returns_already_paid(self):
        rid = self.checkout().json()["razorpay_order_id"]
        self.rzp.payments[rid] = [{"id": "pay_1", "status": "failed"}]
        self.fail_report(rid)
        old = Order.objects.get(razorpay_order_id=rid)
        self.rzp.pay_link(old.payment_link_id)  # webhook not arrived yet

        r = self.checkout(previous=rid)

        self.assertEqual(r.status_code, 409)
        self.assertTrue(r.json()["already_paid"])
        self.assertEqual(r.json()["order_number"], old.order_number)
        self.assertEqual(Order.objects.count(), 1)

    def test_checkout_payment_arriving_late_cancels_the_link(self):
        rid = self.checkout().json()["razorpay_order_id"]
        self.rzp.payments[rid] = [{"id": "pay_1", "status": "failed"}]
        self.fail_report(rid)
        order = Order.objects.get(razorpay_order_id=rid)

        with self.captureOnCommitCallbacks(execute=True):
            self.webhook("payment.captured", {"payment": {"entity": {"order_id": rid, "id": "pay_2", "status": "captured"}}})

        order.refresh_from_db()
        self.assertEqual(order.payment_status, "paid")
        self.assertEqual(self.rzp.links[order.payment_link_id]["status"], "cancelled")

    def test_both_paid_is_flagged_for_refund(self):
        rid = self.checkout().json()["razorpay_order_id"]
        self.rzp.payments[rid] = [{"id": "pay_1", "status": "failed"}]
        self.fail_report(rid)
        order = Order.objects.get(razorpay_order_id=rid)
        self.rzp.pay_link(order.payment_link_id, "pay_link_1")

        with self.captureOnCommitCallbacks(execute=True):
            self.webhook("payment.captured", {"payment": {"entity": {"order_id": rid, "id": "pay_2", "status": "captured"}}})

        order.refresh_from_db()
        self.assertEqual(order.payment_status, "paid")
        self.assertIn("DUPLICATE", order.payment_error)
        self.assertIn("pay_link_1", order.payment_error)

    def test_daily_limit_per_phone(self):
        # Five links a day per phone; the sixth failure that day gets none.
        sent = []
        for i in range(6):
            rid = self.checkout(qty=1 if i % 2 == 0 else 2).json()["razorpay_order_id"]
            self.rzp.payments[rid] = [{"id": f"pay_{i}", "status": "failed"}]
            res = self.fail_report(rid).json()
            sent.append(res["payment_link_sent"])
        self.assertEqual(sent, [True, True, True, True, True, False])
        self.assertEqual(res["payment_status"], "failed")

    def test_invalid_phone_gets_no_link(self):
        rid = self.checkout(phone="12345").json()["razorpay_order_id"]
        self.rzp.payments[rid] = [{"id": "pay_1", "status": "failed"}]
        res = self.fail_report(rid).json()
        self.assertFalse(res["payment_link_sent"])
        self.assertEqual(self.reserved(), 0)

    def test_cleanup_keeps_live_link_then_expires_it(self):
        rid = self.checkout().json()["razorpay_order_id"]
        self.rzp.payments[rid] = [{"id": "pay_1", "status": "failed"}]
        self.fail_report(rid)
        order = Order.objects.get(razorpay_order_id=rid)
        Order.objects.filter(id=order.id).update(created_at=timezone.now() - timedelta(minutes=25))

        call_command("cleanup_expired_orders", stdout=StringIO(), stderr=StringIO())
        order.refresh_from_db()
        self.assertEqual(order.payment_status, "pending")
        self.assertEqual(self.reserved(), 1)

        Order.objects.filter(id=order.id).update(payment_link_expires_at=timezone.now() - timedelta(minutes=1))
        call_command("cleanup_expired_orders", stdout=StringIO(), stderr=StringIO())
        order.refresh_from_db()
        self.assertEqual(order.payment_status, "failed")
        self.assertEqual(self.rzp.links[order.payment_link_id]["status"], "cancelled")
        self.assertEqual(self.reserved(), 0)
        # The original gateway error is kept.
        self.assertEqual(order.payment_error, "Payment was unsuccessful as you could not complete it in time.")

    def test_link_expired_on_a_young_order_is_closed_too(self):
        # Link sent at minute 5, expired at 20: closed even though the order is young.
        rid = self.checkout().json()["razorpay_order_id"]
        self.rzp.payments[rid] = [{"id": "pay_1", "status": "failed"}]
        self.fail_report(rid)
        order = Order.objects.get(razorpay_order_id=rid)
        Order.objects.filter(id=order.id).update(
            created_at=timezone.now() - timedelta(minutes=15),
            payment_link_expires_at=timezone.now() - timedelta(seconds=30),
        )

        call_command("cleanup_expired_orders", stdout=StringIO(), stderr=StringIO())

        order.refresh_from_db()
        self.assertEqual(order.payment_status, "failed")
        self.assertEqual(self.reserved(), 0)

    def age(self, rid, minutes):
        Order.objects.filter(razorpay_order_id=rid).update(created_at=timezone.now() - timedelta(minutes=minutes))

    def test_stuck_upi_payment_gets_link_after_5_minutes(self):
        rid = self.checkout().json()["razorpay_order_id"]
        self.rzp.payments[rid] = [{"id": "pay_1", "status": "created"}]  # PhonePe never opened

        self.age(rid, 4)
        call_command("cleanup_expired_orders", stdout=StringIO(), stderr=StringIO())
        self.rzp.payment_link.create.assert_not_called()

        self.age(rid, 5.5)
        call_command("cleanup_expired_orders", stdout=StringIO(), stderr=StringIO())
        order = Order.objects.get(razorpay_order_id=rid)
        self.assertIsNotNone(order.payment_link_id)
        self.assertEqual(order.payment_status, "pending")
        self.assertEqual(order.payment_error, "Payment not completed within 5 minutes")
        self.assertEqual(self.reserved(), 1)

        # Razorpay later times the UPI attempt out: still one SMS, link kept.
        self.rzp.payments[rid] = [{"id": "pay_1", "status": "failed"}]
        self.webhook("payment.failed", {"payment": {"entity": {"order_id": rid, "error_description": "timed out"}}})
        order.refresh_from_db()
        self.assertEqual(self.rzp.payment_link.create.call_count, 1)
        self.assertEqual(self.rzp.links[order.payment_link_id]["status"], "created")
        self.assertEqual(order.payment_status, "pending")

    def test_stuck_upi_payment_completing_late_cancels_link(self):
        rid = self.checkout().json()["razorpay_order_id"]
        self.rzp.payments[rid] = [{"id": "pay_1", "status": "created"}]
        self.age(rid, 6)
        call_command("cleanup_expired_orders", stdout=StringIO(), stderr=StringIO())
        order = Order.objects.get(razorpay_order_id=rid)

        self.rzp.payments[rid] = [{"id": "pay_1", "status": "captured"}]
        with self.captureOnCommitCallbacks(execute=True):
            self.api.get(f"/api/payment-status/?razorpay_order_id={rid}")

        order.refresh_from_db()
        self.assertEqual(order.payment_status, "paid")
        self.assertEqual(self.rzp.links[order.payment_link_id]["status"], "cancelled")

    def test_checkout_never_started_gets_link_after_5_minutes(self):
        rid = self.checkout().json()["razorpay_order_id"]  # no payments at all
        self.age(rid, 6)
        call_command("cleanup_expired_orders", stdout=StringIO(), stderr=StringIO())
        order = Order.objects.get(razorpay_order_id=rid)
        self.assertIsNotNone(order.payment_link_id)
        self.assertEqual(order.payment_error, "Payment not started within 5 minutes")

    def test_stalled_check_records_payment_instead_of_texting(self):
        rid = self.checkout().json()["razorpay_order_id"]
        self.rzp.payments[rid] = [{"id": "pay_1", "status": "captured"}]
        self.age(rid, 6)
        call_command("cleanup_expired_orders", stdout=StringIO(), stderr=StringIO())
        order = Order.objects.get(razorpay_order_id=rid)
        self.assertEqual(order.payment_status, "paid")
        self.rzp.payment_link.create.assert_not_called()

    def test_cleanup_recovers_link_paid_without_webhook(self):
        rid = self.checkout().json()["razorpay_order_id"]
        self.rzp.payments[rid] = [{"id": "pay_1", "status": "failed"}]
        self.fail_report(rid)
        order = Order.objects.get(razorpay_order_id=rid)
        self.rzp.pay_link(order.payment_link_id)
        Order.objects.filter(id=order.id).update(
            created_at=timezone.now() - timedelta(minutes=50),
            payment_link_expires_at=timezone.now() - timedelta(minutes=1),
        )

        call_command("cleanup_expired_orders", stdout=StringIO(), stderr=StringIO())

        order.refresh_from_db()
        self.assertEqual(order.payment_status, "paid")

    def test_delete_job_skips_orders_with_live_link(self):
        rid = self.checkout().json()["razorpay_order_id"]
        Order.objects.filter(razorpay_order_id=rid).update(
            payment_status="failed", payment_link_expires_at=timezone.now() + timedelta(minutes=5),
        )
        call_command("delete_failed_expired_orders", stdout=StringIO())
        self.assertTrue(Order.objects.filter(razorpay_order_id=rid).exists())

    def test_link_callback_paid_redirects_to_success(self):
        rid = self.checkout().json()["razorpay_order_id"]
        self.rzp.payments[rid] = [{"id": "pay_1", "status": "failed"}]
        self.fail_report(rid)
        order = Order.objects.get(razorpay_order_id=rid)
        self.rzp.pay_link(order.payment_link_id, "pay_link_1")
        self.rzp.utility.verify_payment_link_signature.return_value = True

        r = self.client.get("/api/payment-link-callback/", {
            "razorpay_payment_id": "pay_link_1",
            "razorpay_payment_link_id": order.payment_link_id,
            "razorpay_payment_link_reference_id": order.order_number,
            "razorpay_payment_link_status": "paid",
            "razorpay_signature": "sig",
        })

        self.assertEqual(r.status_code, 302)
        self.assertEqual(r["Location"], f"https://shop.example.com/order-success?order={order.order_number}")
        order.refresh_from_db()
        self.assertEqual(order.payment_status, "paid")

    def test_link_callback_bad_signature_trusts_only_razorpay(self):
        rid = self.checkout().json()["razorpay_order_id"]
        self.rzp.payments[rid] = [{"id": "pay_1", "status": "failed"}]
        self.fail_report(rid)
        order = Order.objects.get(razorpay_order_id=rid)
        self.rzp.utility.verify_payment_link_signature.side_effect = Exception("bad sig")

        r = self.client.get("/api/payment-link-callback/", {
            "razorpay_payment_link_id": order.payment_link_id,
            "razorpay_payment_link_status": "paid", "razorpay_signature": "forged",
        })

        self.assertEqual(r["Location"], "https://shop.example.com/cart?payment=failed")
        order.refresh_from_db()
        self.assertEqual(order.payment_status, "pending")

    def test_redirect_mode_failure_tells_checkout_link_was_sent(self):
        rid = self.checkout().json()["razorpay_order_id"]
        self.rzp.payments[rid] = [{"id": "pay_1", "status": "failed"}]

        r = self.client.post("/api/payment-callback/", {
            "error[description]": "Payment was unsuccessful as you could not complete it in time.",
            "error[metadata]": json.dumps({"order_id": rid, "payment_id": "pay_1"}),
        })

        self.assertEqual(r["Location"], "https://shop.example.com/checkout?payment=failed&link=sent")

    def test_rejections_are_logged_with_reason(self):
        ProductVariant.objects.filter(id=self.variant.id).update(stock=0)
        with self.assertLogs("orders", level="WARNING") as logs:
            r = self.checkout()
        self.assertEqual(r.status_code, 400)
        self.assertIn("Insufficient stock", logs.output[0])
        self.assertIn("+91 63•••••160", logs.output[0])

    def test_deleted_product_rejection_is_logged(self):
        with self.assertLogs("orders", level="WARNING") as logs:
            r = self.api.post("/api/create-order/", {"items": [{"variant": 999999, "quantity": 1}], "phone": "6303570160"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("no longer exist", logs.output[0])

    def test_repair_reserved_stock(self):
        rid = self.checkout(qty=2).json()["razorpay_order_id"]  # live hold of 2
        ProductVariant.objects.filter(id=self.variant.id).update(reserved_stock=3)  # 1 phantom
        ProductVariant.objects.filter(id=self.other_variant.id).update(reserved_stock=1)  # all phantom

        out = StringIO()
        call_command("repair_reserved_stock", stdout=out)
        self.assertIn("Would correct", out.getvalue())
        self.assertEqual(self.reserved(), 3)  # dry run changes nothing

        call_command("repair_reserved_stock", "--apply", stdout=StringIO())
        self.variant.refresh_from_db(); self.other_variant.refresh_from_db()
        self.assertEqual((self.variant.reserved_stock, self.other_variant.reserved_stock), (2, 0))


class ProductDeletionSafetyTests(TestCase):
    """Deleting or hiding products must never damage past orders."""

    def setUp(self):
        from django.contrib.auth import get_user_model
        self.cat = Category.objects.create(name="Kurtis", slug="kurtis")
        self.product = Product.objects.create(
            name="Feeding Cordset", code="FC1", category=self.cat, description="x",
            original_price=600, price=520, shipping_charge=30,
        )
        self.color = ProductColor.objects.create(name="Blue", color="#0000FF")
        self.variant = ProductVariant.objects.create(product=self.product, color=self.color, size="XL", stock=4)
        self.order = Order.objects.create(customer_name="A", phone="6303570160", payment_status="paid", total_amount=550)
        self.item = OrderItem.objects.create(order=self.order, variant=self.variant, quantity=2)
        User = get_user_model()
        self.staff = User.objects.create_user(username="staff", password="x", is_staff=True)
        self.superuser = User.objects.create_superuser(username="boss", password="x", email="b@x.com")

    def test_item_keeps_product_details(self):
        self.item.refresh_from_db()
        self.assertEqual(
            (self.item.product_name, self.item.product_code, self.item.color_name, self.item.size, self.item.unit_price),
            ("Feeding Cordset", "FC1", "Blue", "XL", 520),
        )

    def test_deleting_product_keeps_order_items(self):
        self.product.delete()
        self.item.refresh_from_db()
        self.assertIsNone(self.item.variant)
        self.assertEqual(self.order.items.count(), 1)
        self.assertEqual(self.item.display_name, "Feeding Cordset — Blue — XL")
        self.assertEqual(self.item.invoice_unit_price, 520)

    def test_orders_with_deleted_products_still_work(self):
        from orders.views import release_order_stock, finalize_paid_order
        pending = Order.objects.create(customer_name="B", phone="6303570161", payment_status="pending", total_amount=550)
        OrderItem.objects.create(order=pending, variant=self.variant, quantity=1)
        self.product.delete()
        release_order_stock(pending)  # must not crash on an item with no size
        pending.refresh_from_db()
        self.assertTrue(pending.stock_released)
        from shipping.operations import _package_dimensions_for_order
        weight, *_ = _package_dimensions_for_order(self.order)  # India Post booking
        self.assertGreater(weight, 0)

    def test_invoice_renders_for_deleted_product(self):
        from django.template.loader import render_to_string
        self.product.delete()
        self.order.taxable_amount = self.order.cgst = self.order.sgst = 0
        html = render_to_string("invoices/invoice.html", {"orders": [self.order]})
        self.assertIn("FEEDING CORDSET", html)
        self.assertIn("SZ: XL", html)

    def test_hidden_product_leaves_shop_but_not_orders(self):
        self.product.is_active = False
        self.product.save()
        api = APIClient()
        self.assertEqual(api.get(f"/api/products/{self.product.id}/").status_code, 404)
        r = api.post("/api/create-order/", {"items": [{"variant": self.variant.id, "quantity": 1}], "phone": "6303570160"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.order.items.count(), 1)

    def test_only_superuser_can_delete_and_never_an_ordered_product(self):
        from django.contrib.admin.sites import site
        from django.test import RequestFactory
        admin_obj = site._registry[Product]
        rf = RequestFactory()
        staff_req = rf.get("/"); staff_req.user = self.staff
        boss_req = rf.get("/"); boss_req.user = self.superuser
        unordered = Product.objects.create(name="New", code="N1", category=self.cat, description="x", original_price=1, price=1)
        self.assertFalse(admin_obj.has_delete_permission(staff_req, unordered))
        self.assertTrue(admin_obj.has_delete_permission(boss_req, unordered))
        self.assertFalse(admin_obj.has_delete_permission(boss_req, self.product))
        self.assertNotIn("delete_selected", admin_obj.get_actions(staff_req))

    def test_category_with_products_cannot_be_deleted(self):
        from django.db.models import ProtectedError
        with self.assertRaises(ProtectedError):
            self.cat.delete()


class AdminStockSafetyTests(TestCase):
    """An admin save must never undo a sale or re-hold released stock."""

    def setUp(self):
        from django.contrib.auth import get_user_model
        self.boss = get_user_model().objects.create_superuser(username="boss", password="x", email="b@x.com")
        self.client.force_login(self.boss)
        cat = Category.objects.create(name="Sets", slug="sets")
        self.product = Product.objects.create(name="Chanderi Set", code="CH1", category=cat, description="x", original_price=900, price=800)
        color = ProductColor.objects.create(name="Pink", color="#FFC0CB")
        self.variant = ProductVariant.objects.create(product=self.product, color=color, size="XL", stock=4, reserved_stock=1)

    def form_data(self, url):
        """Everything a browser would submit for the form on `url`, as rendered."""
        from html.parser import HTMLParser
        html = self.client.get(url).content.decode()

        class Form(HTMLParser):
            def __init__(self):
                super().__init__(); self.data = {}; self.select = None; self.textarea = None
            def handle_starttag(self, tag, a):
                a = dict(a)
                if tag == "input" and a.get("name") and a.get("type") not in ("submit", "file", "button"):
                    if a.get("type") in ("checkbox", "radio") and "checked" not in a:
                        return
                    self.data[a["name"]] = a.get("value", "on" if a.get("type") == "checkbox" else "")
                elif tag == "select" and a.get("name"):
                    self.select = a["name"]
                    if "multiple" not in a:  # an empty multi-select sends nothing
                        self.data.setdefault(self.select, "")
                elif tag == "option" and self.select and "selected" in a:
                    self.data[self.select] = a.get("value", "")
                elif tag == "textarea" and a.get("name"):
                    self.textarea = a["name"]; self.data[self.textarea] = ""
            def handle_endtag(self, tag):
                if tag == "select": self.select = None
                if tag == "textarea": self.textarea = None
            def handle_data(self, d):
                if self.textarea: self.data[self.textarea] += d

        f = Form(); f.feed(html)
        return html, f.data

    def sale_happens(self):
        # Checkout completes while the admin page is open: 1 sold, hold released.
        ProductVariant.objects.filter(id=self.variant.id).update(stock=3, reserved_stock=0)

    def test_product_page_renders_page_open_stock_and_readonly_reserved(self):
        html, data = self.form_data(f"/admin/products/product/{self.product.id}/change/")
        self.assertIn("initial-variants-0-stock", data)
        self.assertNotIn("variants-0-reserved_stock", data)  # read-only now

    def test_product_page_save_without_touching_stock_keeps_live_numbers(self):
        url = f"/admin/products/product/{self.product.id}/change/"
        _, data = self.form_data(url)
        self.sale_happens()
        data["name"] = "Chanderi Set (renamed)"
        r = self.client.post(url, data)
        self.assertEqual(r.status_code, 302, r.content[:3000])
        self.variant.refresh_from_db()
        self.assertEqual((self.variant.stock, self.variant.reserved_stock), (3, 0))

    def test_product_page_stock_edit_is_applied_as_a_change(self):
        url = f"/admin/products/product/{self.product.id}/change/"
        _, data = self.form_data(url)
        self.sale_happens()
        data["variants-0-stock"] = "6"  # admin adds 2 to the 4 they saw
        r = self.client.post(url, data, follow=True)
        self.variant.refresh_from_db()
        self.assertEqual((self.variant.stock, self.variant.reserved_stock), (5, 0))
        self.assertIn("Your change of +2 was applied, so it is now 5", r.content.decode())

    def test_variant_page_and_list_column_are_safe_too(self):
        url = f"/admin/products/productvariant/{self.variant.id}/change/"
        _, data = self.form_data(url)
        self.sale_happens()
        self.assertEqual(self.client.post(url, data).status_code, 302)
        self.variant.refresh_from_db()
        self.assertEqual((self.variant.stock, self.variant.reserved_stock), (3, 0))

        _, data = self.form_data("/admin/products/productvariant/")
        ProductVariant.objects.filter(id=self.variant.id).update(stock=2)  # another sale
        stock_key = next(k for k in data if k.endswith("-stock") and not k.startswith("initial-"))
        data[stock_key] = str(int(data[stock_key]) + 10)
        data["_save"] = "Save"
        self.client.post("/admin/products/productvariant/", data)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock, 12)

    def test_new_size_added_in_admin_starts_unreserved(self):
        url = f"/admin/products/product/{self.product.id}/change/"
        _, data = self.form_data(url)
        data["variants-1-color"] = data["variants-0-color"]
        data["variants-1-size"] = "XXL"
        data["variants-1-stock"] = "7"
        data["variants-1-product"] = str(self.product.id)
        r = self.client.post(url, data)
        self.assertEqual(r.status_code, 302, r.content[:3000])
        new = ProductVariant.objects.get(product=self.product, size="XXL")
        self.assertEqual((new.stock, new.reserved_stock), (7, 0))


class PerformanceTests(TestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        self.cat = Category.objects.create(name="Sets", slug="sets")
        self.product = Product.objects.create(name="Set A", code="SA", category=self.cat, description="x", original_price=900, price=800)
        from products.models import ProductTag
        self.product.tags.add(ProductTag.objects.create(name="latest"))
        self.variant = ProductVariant.objects.create(product=self.product, color=ProductColor.objects.create(name="Red", color="#f00"), size="XL", stock=5)

    def test_product_list_is_cached_and_dropped_on_product_edit(self):
        from django.test.utils import CaptureQueriesContext
        from django.db import connection
        api = APIClient()
        self.assertEqual(len(api.get("/api/products/all-tagged/").json()["latest"]), 1)
        with CaptureQueriesContext(connection) as q:
            api.get("/api/products/all-tagged/")
        self.assertEqual(len(q.captured_queries), 0)  # served from cache

        self.product.name = "Set A (new)"; self.product.save()
        self.assertEqual(api.get("/api/products/all-tagged/").json()["latest"][0]["name"], "Set A (new)")

        self.product.is_active = False; self.product.save()
        self.assertEqual(api.get("/api/products/all-tagged/").json()["latest"], [])

    def test_checkout_stock_updates_do_not_rebuild_the_list(self):
        from django.core.cache import cache
        from products.views import ALL_TAGGED_CACHE_KEY
        APIClient().get("/api/products/all-tagged/")
        self.variant.reserved_stock = 1
        self.variant.save(update_fields=["reserved_stock"])
        self.assertIsNotNone(cache.get(ALL_TAGGED_CACHE_KEY))
        self.variant.size = "XXL"; self.variant.save()  # a real edit does
        self.assertIsNone(cache.get(ALL_TAGGED_CACHE_KEY))

    def test_oversized_webp_is_resized_and_raw_upload_converted(self):
        from io import BytesIO
        from PIL import Image
        from django.core.files.uploadedfile import SimpleUploadedFile
        from products.models import HeroImage, CATEGORY_MAX_WIDTH, HERO_MAX_WIDTH

        def upload(name, fmt, size):
            buf = BytesIO(); Image.new("RGB", size, "red").save(buf, format=fmt)
            return SimpleUploadedFile(name, buf.getvalue())

        cat = Category.objects.create(name="Nighty", slug="nighty", image=upload("big.webp", "WEBP", (3000, 4500)))
        with Image.open(cat.image.path) as im:
            self.assertEqual(im.width, CATEGORY_MAX_WIDTH)
        hero = HeroImage.objects.create(image=upload("banner.png", "PNG", (1122, 1402)))
        self.assertTrue(hero.image.name.endswith(".webp"))
        with Image.open(hero.image.path) as im:
            self.assertEqual(im.width, HERO_MAX_WIDTH)

    def test_backfill_command_dry_run_then_fix(self):
        from io import BytesIO, StringIO
        from PIL import Image
        from django.core.files.base import ContentFile
        from products.models import HeroImage
        buf = BytesIO(); Image.new("RGB", (2268, 4032), "blue").save(buf, format="JPEG")
        hero = HeroImage(); hero.image.save("old.jpeg", ContentFile(buf.getvalue()), save=False)
        HeroImage.objects.bulk_create([hero])  # as if uploaded before compression existed
        out = StringIO(); call_command("compress_images", "--dry-run", stdout=out)
        self.assertIn("Would change 2 files", out.getvalue())  # resize + small copy
        call_command("compress_images", stdout=StringIO())
        h = HeroImage.objects.get()
        self.assertTrue(h.image.name.endswith(".webp"))
        with Image.open(h.image.path) as im:
            self.assertEqual(im.width, 640)
        with Image.open(h.image_small.path) as im:
            self.assertEqual(im.width, 320)


class ResponsiveImageTests(TestCase):
    """Every image is stored in the widths the storefront lists in srcset."""

    def setUp(self):
        from django.core.cache import cache
        cache.clear()

    def upload(self, name, fmt, size):
        from io import BytesIO
        from PIL import Image
        from django.core.files.uploadedfile import SimpleUploadedFile
        buf = BytesIO(); Image.new("RGB", size, "green").save(buf, format=fmt)
        return SimpleUploadedFile(name, buf.getvalue())

    def width(self, field):
        from PIL import Image
        with Image.open(field.path) as im:
            return im.width

    def test_product_image_gets_three_widths_and_api_lists_them(self):
        from products.models import ProductImage, ProductTag
        cat = Category.objects.create(name="Sets", slug="sets")
        p = Product.objects.create(name="Set", code="S1", category=cat, description="x", original_price=1, price=1)
        p.tags.add(ProductTag.objects.create(name="latest"))
        img = ProductImage.objects.create(product=p, image=self.upload("photo.jpg", "JPEG", (3024, 4032)))
        self.assertEqual(
            (self.width(img.image), self.width(img.thumbnail), self.width(img.medium), self.width(img.small)),
            (1000, 600, 400, 300),
        )
        api_img = APIClient().get(f"/api/products/{p.id}/").json()["images"][0]
        self.assertTrue(api_img["small"].endswith("_w300.webp"))
        self.assertTrue(api_img["medium"].endswith("_w400.webp"))
        self.assertTrue(api_img["thumbnail"] and api_img["image"])
        listed = APIClient().get("/api/products/all-tagged/").json()["latest"][0]["images"][0]
        self.assertEqual(listed["small"], api_img["small"])

    def test_category_and_hero_get_small_copies(self):
        from products.models import HeroImage
        cat = Category.objects.create(name="Nighty", slug="nighty", image=self.upload("n.png", "PNG", (1200, 1600)))
        self.assertEqual((self.width(cat.image), self.width(cat.image_small)), (450, 240))
        hero = HeroImage.objects.create(image=self.upload("h.jpg", "JPEG", (2268, 4032)))
        self.assertEqual((self.width(hero.image), self.width(hero.image_small)), (640, 320))
        self.assertIn("image_small", APIClient().get("/api/products/categories/").json()[0])
        self.assertTrue(APIClient().get("/api/products/hero/").json()[0]["image_small"].endswith("_w320.webp"))

    def test_resaving_without_new_image_does_not_rebuild_small(self):
        cat = Category.objects.create(name="Tops", slug="tops", image=self.upload("t.png", "PNG", (800, 800)))
        first = cat.image_small.name
        cat.name = "Tops & Tunics"; cat.save()
        self.assertEqual(cat.image_small.name, first)

    def test_backfill_creates_missing_small_copies(self):
        from io import StringIO
        from products.models import ProductImage
        cat = Category.objects.create(name="Sets", slug="sets")
        p = Product.objects.create(name="Set", code="S1", category=cat, description="x", original_price=1, price=1)
        img = ProductImage.objects.create(product=p, image=self.upload("photo.jpg", "JPEG", (1200, 1600)))
        ProductImage.objects.filter(pk=img.pk).update(small=None, medium=None)  # as for images uploaded before this
        out = StringIO(); call_command("compress_images", "--dry-run", stdout=out)
        self.assertIn("small 300px copy", out.getvalue())
        call_command("compress_images", stdout=StringIO())
        img.refresh_from_db()
        self.assertEqual((self.width(img.small), self.width(img.medium)), (300, 400))


class SitemapAndSecurityTests(TestCase):
    def test_sitemap_lists_pages_categories_and_visible_products(self):
        from django.core.cache import cache
        cache.clear()
        cat = Category.objects.create(name="Sarees", slug="sarees")
        shown = Product.objects.create(name="A", code="A1", category=cat, description="x", original_price=1, price=1)
        hidden = Product.objects.create(name="B", code="B1", category=cat, description="x", original_price=1, price=1, is_active=False)
        r = self.client.get("/sitemap.xml")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r["Content-Type"], "application/xml")
        body = r.content.decode()
        self.assertIn("<loc>https://babatextiles.com/</loc>", body)
        self.assertIn("<loc>https://babatextiles.com/shop?category=sarees</loc>", body)
        self.assertIn(f"<loc>https://babatextiles.com/product/{shown.id}</loc>", body)
        self.assertNotIn(f"/product/{hidden.id}<", body)
        # a new product appears straight away (cache dropped on save)
        new = Product.objects.create(name="C", code="C1", category=cat, description="x", original_price=1, price=1)
        self.assertIn(f"/product/{new.id}<", self.client.get("/sitemap.xml").content.decode())

    @override_settings(SECURE_SSL_REDIRECT=True)
    def test_https_headers(self):
        r = self.client.get("/api/products/categories/", secure=True)
        self.assertEqual(r.status_code, 200)
        self.assertIn("max-age=", r["Strict-Transport-Security"])
        self.assertEqual(r["X-Content-Type-Options"], "nosniff")
        self.assertEqual(self.client.get("/api/products/categories/").status_code, 301)  # plain HTTP redirected


class RazorpayTimeoutTests(TestCase):
    def test_razorpay_calls_have_a_timeout(self):
        from unittest import mock
        from orders.razorpay_client import RAZORPAY_TIMEOUT, make_client
        client = make_client()
        with mock.patch("requests.Session.request") as req:
            req.return_value = mock.Mock(status_code=200, json=lambda: {"id": "order_x"})
            client.order.fetch("order_x")
        self.assertEqual(req.call_args.kwargs["timeout"], RAZORPAY_TIMEOUT)

    def test_hung_razorpay_fails_fast_and_releases_stock(self):
        import requests
        from unittest import mock
        cat = Category.objects.create(name="S", slug="s")
        p = Product.objects.create(name="P", code="P1", category=cat, description="x", original_price=150, price=100)
        v = ProductVariant.objects.create(product=p, color=ProductColor.objects.create(name="R", color="#f00"), size="XL", stock=3)
        with mock.patch("orders.views.client.order.create", side_effect=requests.exceptions.Timeout("read timed out")):
            r = APIClient().post("/api/create-order/", {"items": [{"variant": v.id, "quantity": 1}], "phone": "6303570160"}, format="json")
        self.assertEqual(r.status_code, 502)
        v.refresh_from_db()
        self.assertEqual(v.reserved_stock, 0)
