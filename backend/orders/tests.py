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

from orders.models import Order
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
        self.api = APIClient()

    # ---------- helpers ----------
    def checkout(self, phone="6303570160", qty=1, previous=None):
        body = {
            "items": [{"variant": self.variant.id, "quantity": qty}],
            "name": "Test Customer", "phone": phone, "address": "1 Long Street Name",
            "city": "Vizag", "state": "Andhra Pradesh", "pincode": "530001",
        }
        if previous:
            body["previous_razorpay_order_id"] = previous
        return self.api.post("/api/create-order/", body, format="json")

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
        # Payable for 10 minutes on our side; Razorpay needs at least 15.
        minutes_left = (order.payment_link_expires_at - timezone.now()).total_seconds() / 60
        self.assertAlmostEqual(minutes_left, 10, delta=0.5)
        self.assertGreaterEqual(link["expire_by"] - timezone.now().timestamp(), 15 * 60)
        self.assertEqual(res["payment_link_valid_minutes"], 10)

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

    def test_retry_with_different_cart_leaves_link_alone(self):
        rid = self.checkout(qty=1).json()["razorpay_order_id"]
        self.rzp.payments[rid] = [{"id": "pay_1", "status": "failed"}]
        self.fail_report(rid)
        old = Order.objects.get(razorpay_order_id=rid)

        self.checkout(qty=3)

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
        for i in range(4):
            rid = self.checkout(qty=1 if i % 2 == 0 else 2).json()["razorpay_order_id"]
            self.rzp.payments[rid] = [{"id": f"pay_{i}", "status": "failed"}]
            res = self.fail_report(rid).json()
        self.assertFalse(res["payment_link_sent"])
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
        # Link sent at minute 5, expired at 15: closed before the 18-minute expiry pass.
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
