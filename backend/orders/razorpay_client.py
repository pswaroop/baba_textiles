import razorpay
import requests
from django.conf import settings

# (connect, read) seconds. The Razorpay SDK sets no timeout, so a stalled
# connection hung the request until gunicorn killed the worker at 90s (it
# happened to a customer's create-order on 22 Oct). Now it fails fast and the
# caller's error handling takes over.
RAZORPAY_TIMEOUT = (5, 20)


class _TimeoutSession(requests.Session):
    def request(self, *args, **kwargs):
        kwargs.setdefault("timeout", RAZORPAY_TIMEOUT)
        return super().request(*args, **kwargs)


def make_client():
    return razorpay.Client(
        session=_TimeoutSession(),
        auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET),
    )
