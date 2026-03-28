# from django.contrib import admin
# from .models import Order, OrderItem


# class OrderItemInline(admin.TabularInline):
#     model = OrderItem
#     extra = 0


# class OrderAdmin(admin.ModelAdmin):
#     list_display = ["order_number", "customer_name", "created_at", "payment_status"]
#     inlines = [OrderItemInline]


# admin.site.register(Order, OrderAdmin)
# admin.site.register(OrderItem)
# from django.contrib import admin
# from django.utils.html import format_html
# from django.urls import reverse
# from .models import Order, OrderItem
# from django.http import HttpResponseRedirect

# class OrderItemInline(admin.TabularInline):
#     model = OrderItem
#     extra = 0

# class OrderAdmin(admin.ModelAdmin):
#     list_display = ["order_number", "customer_name", "created_at", "payment_status"]
#     inlines = [OrderItemInline]
    
#     # ✅ 1. Add the custom field to the readonly_fields list
#     readonly_fields = ["invoice_download_button"]
    
#     # ✅ 2. Define how the button looks and where it links
#     def invoice_download_button(self, obj):
#         if obj.id:
#             # This generates the URL: /api/download-invoices/?orders=<ID>
#             url = f"{reverse('download_invoices')}?orders={obj.id}"
#             return format_html(
#                 '<a class="button" href="{}" target="_blank" '
#                 'style="background-color: #417690; color: white; padding: 10px 15px; font-weight: bold; border-radius: 4px;">'
#                 'Download PDF Invoice</a>', 
#                 url
#             )
#         return "Save order first"

#     invoice_download_button.short_description = "Invoice Actions"

#     # ✅ 3. Optional: Control where the button appears in the form
#     # If you want it at the top, define 'fields' explicitly:
#     # fields = ["customer_name", "total_amount", "payment_status", "invoice_download_button", ...]

# admin.site.register(Order, OrderAdmin)
# admin.site.register(OrderItem)
from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.http import HttpResponseRedirect
from .models import Order, OrderItem

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0

class OrderAdmin(admin.ModelAdmin):

    # ✅ Columns in list view
    list_display = ["order_number", "customer_name", "created_at", "payment_status", "status"]

    # ✅ THIS IS THE KEY LINE
    list_editable = ["status"]

    inlines = [OrderItemInline]

    actions = ["bulk_invoice_download"]

    readonly_fields = ["invoice_download_button"]

    fields = [
        "customer_name", "user", "total_amount", "payment_status",
        "status",
        "invoice_download_button",
        "address", "city", "state", "pincode", "phone",
        "razorpay_order_id", "razorpay_payment_id", "razorpay_signature"
    ]

    # ✅ Fix 3: Logic for Bulk Download (Dropdown)
    @admin.action(description="Download Selected Invoices")
    def bulk_invoice_download(self, request, queryset):
        # Collects selected IDs into a string like "1,2,5"
        ids = ",".join([str(order.id) for order in queryset])
        return HttpResponseRedirect(f"/api/download-invoices/?orders={ids}")

    # ✅ Fix 3: Logic for Single Download Button (Inside form)
    def invoice_download_button(self, obj):
        if obj.id:
            url = f"{reverse('download_invoices')}?orders={obj.id}"
            return format_html(
                '<a class="button" href="{}" target="_blank" '
                'style="background-color: #0f766e; color: white; padding: 10px 15px; '
                'font-weight: bold; border-radius: 4px; text-decoration: none;">'
                'Download PDF Invoice</a>', 
                url
            )
        return "Save order first"

    invoice_download_button.short_description = "Invoice Actions"

admin.site.register(Order, OrderAdmin)
admin.site.register(OrderItem)