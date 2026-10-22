from io import BytesIO

from django.contrib import admin
from django.contrib.admin import SimpleListFilter
from django.core.paginator import Paginator
from django.http import HttpResponse, HttpResponseRedirect
from django.urls import reverse
from django.utils import timezone
from django.utils.functional import cached_property
from django.utils.html import format_html

from .models import Order, OrderItem
from shipping.excel_export import build_shipment_export_workbook
from shipping.operations import ShipmentBookingError, book_shipment_for_order

class PaymentStatusFilter(SimpleListFilter):
    title = "payment status"
    parameter_name = "payment_status"

    def lookups(self, request, model_admin):
        return [
            ("pending", "Pending"),
            ("paid", "Paid"),
            ("expired", "Expired"),
            ("refund", "Refund"),
            ("failed", "Failed"),
        ]

    def queryset(self, request, queryset):
        if self.value():
            return queryset.filter(payment_status=self.value())
        return queryset


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    autocomplete_fields = ["variant"]
    fields = ["variant", "quantity", "product_name", "color_name", "size", "unit_price"]
    readonly_fields = ["product_name", "color_name", "size", "unit_price"]
    show_change_link = True


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = [
        "order_number",
        "customer_name",
        "phone",
        "created_at",
        "payment_status",
        "status",
        "shipment_status",
    ]
    list_editable = ["status"]
    list_filter = [PaymentStatusFilter, "status", "created_at"]
    search_fields = ["order_number", "customer_name", "phone", "razorpay_order_id", "razorpay_payment_id"]
    inlines = [OrderItemInline]

    actions = [
        "bulk_invoice_download",
        "book_with_indiapost",
        "export_shipment_excel",
        "mark_as_processed",
        "mark_as_confirmed",
        "mark_as_shipped",
        "mark_as_delivered",
        "mark_as_cancelled",
    ]

    readonly_fields = ["invoice_download_button", "shipment_details"]

    fields = [
        "customer_name",
        "user",
        "total_amount",
        "payment_status",
        "status",
        "invoice_download_button",
        "address",
        "city",
        "state",
        "pincode",
        "phone",
        "razorpay_order_id",
        "razorpay_payment_id",
        "razorpay_signature",
        "shipment_details",
    ]

    ordering = ["-created_at"]
    date_hierarchy = "created_at"
    list_per_page = 25
    list_select_related = ["user"]
    show_full_result_count = False

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related("user", "shipment").prefetch_related("items__variant")

    @admin.display(description="Shipment")
    def shipment_status(self, obj):
        shipment = getattr(obj, "shipment", None)
        if not shipment:
            return "—"
        return f"{shipment.get_status_display()} ({shipment.barcode_no or 'no barcode'})"

    @admin.display(description="India Post Shipment")
    def shipment_details(self, obj):
        shipment = getattr(obj, "shipment", None)
        if not shipment:
            return "Not booked yet. Use the 'Book with India Post' action from the order list."
        return format_html(
            'Status: <b>{}</b><br>Barcode: {}<br>Service: {}<br>'
            'Last event: {}<br>'
            '<a class="button" href="/admin/shipping/shipment/{}/change/">View shipment / tracking</a>',
            shipment.get_status_display(),
            shipment.barcode_no or "—",
            shipment.get_service_type_display(),
            shipment.last_tracking_event or "—",
            shipment.id,
        )

    @admin.action(description="Book with India Post")
    def book_with_indiapost(self, request, queryset):
        booked, failed = 0, []
        for order in queryset:
            try:
                book_shipment_for_order(order)
                booked += 1
            except ShipmentBookingError as exc:
                failed.append(f"{order.order_number}: {exc}")

        if booked:
            self.message_user(request, f"Booked {booked} shipment(s) with India Post.")
        if failed:
            self.message_user(request, "Some orders could not be booked: " + "; ".join(failed), level="ERROR")

    @admin.action(description="Export shipment orders to Excel (India Post upload sheet)")
    def export_shipment_excel(self, request, queryset):
        orders = list(
            queryset
            .select_related("user")
            .prefetch_related("items__variant__product")
        )

        workbook, exported_orders, skipped = build_shipment_export_workbook(orders)

        if not exported_orders:
            self.message_user(
                request,
                "Nothing to export — none of the selected orders are paid and unbooked. "
                + "; ".join(f"{num}: {reason}" for num, reason in skipped),
                level="ERROR",
            )
            return

        buffer = BytesIO()
        workbook.save(buffer)
        buffer.seek(0)

        filename = f"indiapost-shipment-export-{timezone.now():%Y%m%d-%H%M%S}.xlsx"
        response = HttpResponse(
            buffer.read(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'

        message = f"Exported {len(exported_orders)} order(s) to {filename}."
        if skipped:
            message += " Skipped: " + "; ".join(f"{num}: {reason}" for num, reason in skipped)
        self.message_user(request, message)

        return response

    @admin.action(description="Download Selected Invoices")
    def bulk_invoice_download(self, request, queryset):
        ids = ",".join([str(order.id) for order in queryset])
        return HttpResponseRedirect(f"/api/download-invoices/?orders={ids}")

    def invoice_download_button(self, obj):
        if obj.id:
            url = f"{reverse('download_invoices')}?orders={obj.id}"
            return format_html(
                '<a class="button" href="{}" target="_blank" '
                'style="background-color: #0f766e; color: white; padding: 10px 15px; '
                'font-weight: bold; border-radius: 4px; text-decoration: none;">'
                'Download PDF Invoice</a>',
                url,
            )
        return "Save order first"

    invoice_download_button.short_description = "Invoice Actions"

    @admin.action(description="Mark selected orders as Processed")
    def mark_as_processed(self, request, queryset):
        updated = queryset.update(status="processed")
        self.message_user(request, f"{updated} orders marked as Processed.")

    @admin.action(description="Mark selected orders as Confirmed")
    def mark_as_confirmed(self, request, queryset):
        updated = queryset.update(status="confirmed")
        self.message_user(request, f"{updated} orders marked as Confirmed.")

    @admin.action(description="Mark selected orders as Shipped")
    def mark_as_shipped(self, request, queryset):
        updated = queryset.update(status="shipped")
        self.message_user(request, f"{updated} orders marked as Shipped.")

    @admin.action(description="Mark selected orders as Delivered")
    def mark_as_delivered(self, request, queryset):
        updated = queryset.update(status="delivered")
        self.message_user(request, f"{updated} orders marked as Delivered.")

    @admin.action(description="Mark selected orders as Cancelled")
    def mark_as_cancelled(self, request, queryset):
        updated = queryset.update(status="cancelled")
        self.message_user(request, f"{updated} orders marked as Cancelled.")


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ["id", "order", "display_name", "quantity"]
    search_fields = ["order__order_number", "product_name", "product_code", "variant__product__name"]
    list_select_related = ["order", "variant", "variant__product"]
    list_per_page = 25
