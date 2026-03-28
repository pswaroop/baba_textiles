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
from .views import create_payment, verify_payment, create_order
from .views import download_invoices

urlpatterns = [
    path("create-payment/", create_payment),
    path("verify-payment/", verify_payment),
    path("create-order/", create_order),
    # ✅ Added name="download_invoices" for use in admin.py reverse()
    path("download-invoices/", download_invoices, name="download_invoices"),
]