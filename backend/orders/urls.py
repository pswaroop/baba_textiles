# from django.urls import path
# from .views import create_payment, verify_payment, create_order
# from .views import download_invoices
# urlpatterns = [
#     path("create-payment/", create_payment),
#     path("verify-payment/", verify_payment),
#     path("create-order/", create_order),
#     path("download-invoices/", download_invoices),
# ]
from django.urls import path
from .views import verify_payment, create_order
from .views import download_invoices, razorpay_webhook
from .views import payment_status, report_payment_failure, razorpay_callback

urlpatterns = [
    #path("create-payment/", create_payment),
    path("webhook/",razorpay_webhook, name="razorpay_webhook"),
    path("verify-payment/", verify_payment),
    path("create-order/", create_order),
    # Checkout polls these when it loses track of a payment, and reports
    # abandoned attempts so their stock is released straight away.
    path("payment-status/", payment_status),
    path("payment-failed/", report_payment_failure),
    # Razorpay posts here in redirect mode (needed for in-app browsers).
    path("payment-callback/", razorpay_callback),
    # ✅ Added name="download_invoices" for use in admin.py reverse()
    path("download-invoices/", download_invoices, name="download_invoices"),
]
