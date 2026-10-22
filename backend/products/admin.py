from django.contrib import admin
from django.utils.html import format_html
from django import forms
from django.db import models
from .models import (
    Category,
    Product,
    ProductImage,
    ProductVariant,
    ProductTag,
    HeroImage,
    ProductColor,
)
from django.db.models import F
from django.db.models.functions import Greatest

from orders.models import OrderItem


class VariantStockForm(forms.ModelForm):
    """Admin form that never overwrites live stock numbers.

    Checkout changes stock and reserved stock while an admin page is open. A
    plain save would write the numbers from when the page was opened back over
    them, undoing sales and leaving held units stuck. Instead:
    - reserved stock is never written from admin (it is read-only there);
    - stock is applied as the change the admin made (new value minus the value
      shown when the page opened) on top of the live count.
    """

    class Meta:
        model = ProductVariant
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.stock_note = ""
        if "stock" in self.fields:
            # Posts the value shown at page-open time alongside the edited one.
            self.fields["stock"].show_hidden_initial = True

    def _stock_when_opened(self):
        raw = self.data.get(self.add_initial_prefix("stock"))
        try:
            return int(raw)
        except (TypeError, ValueError):
            return None

    def save_safely(self, obj):
        is_new = obj.pk is None or not ProductVariant.objects.filter(pk=obj.pk).exists()
        if is_new:
            obj.reserved_stock = 0
            obj.save()
            return obj

        other_fields = [
            f.attname for f in obj._meta.concrete_fields
            if not f.primary_key and f.attname not in ("stock", "reserved_stock")
        ]
        obj.save(update_fields=other_fields)

        opened = self._stock_when_opened()
        if "stock" in self.cleaned_data and opened is not None:
            delta = self.cleaned_data["stock"] - opened
            if delta:
                live_before = ProductVariant.objects.values_list("stock", flat=True).get(pk=obj.pk)
                ProductVariant.objects.filter(pk=obj.pk).update(stock=Greatest(F("stock") + delta, 0))
                if live_before != opened:
                    obj.refresh_from_db(fields=["stock"])
                    self.stock_note = (
                        f"{obj}: stock went from {opened} to {live_before} online while you were "
                        f"editing (e.g. a sale). Your change of {delta:+d} was applied, so it is now {obj.stock}."
                    )
        obj.refresh_from_db(fields=["stock", "reserved_stock"])
        return obj

    def save(self, commit=True):
        obj = super().save(commit=False)
        if commit:
            self.save_safely(obj)
        return obj


def image_preview_tag(image_field, width=70, height=70):
    if image_field and getattr(image_field, "url", None):
        return format_html(
            '<img src="{}" style="width:{}px;height:{}px;object-fit:cover;border-radius:8px;border:1px solid #ddd;" />',
            image_field.url,
            width,
            height,
        )
    return "—"


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "order", "slug", "category_image_preview")
    list_display_links = ("id",)
    search_fields = ("name", "slug")
    list_editable = ("name", "order")
    prepopulated_fields = {"slug": ("name",)}
    ordering = ("order", "id")

    class Media:
        js = ("products/admin/compress_before_upload.js",)

    @admin.display(description="Image")
    def category_image_preview(self, obj):
        return image_preview_tag(obj.image, 60, 60)


@admin.register(ProductTag)
class ProductTagAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name",)
    ordering = ("name",)


@admin.register(ProductColor)
class ColorAdmin(admin.ModelAdmin):
    list_display = ("name", "color_swatch")
    search_fields = ("name",)
    ordering = ("name",)

    @admin.display(description="Color")
    def color_swatch(self, obj):
        return format_html(
            '<span style="display:inline-block;width:24px;height:24px;border-radius:50%;background:{};border:1px solid #ccc;"></span> {}',
            obj.color,
            obj.color,
        )


@admin.register(HeroImage)
class HeroImageAdmin(admin.ModelAdmin):
    list_display = ("id", "hero_preview", "is_active")
    list_filter = ("is_active",)
    readonly_fields = ("hero_preview",)

    class Media:
        js = ("products/admin/compress_before_upload.js",)

    @admin.display(description="Preview")
    def hero_preview(self, obj):
        return image_preview_tag(obj.image, 140, 80)

class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1
    fields = ("image", "color", "preview")
    readonly_fields = ("preview",)

    class Media:
        js = ("products/admin/compress_before_upload.js",)


    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "color":
            # If editing an existing product, only show colors mapped to its variants
            product_id = request.resolver_match.kwargs.get('object_id')
            if product_id:
                kwargs["queryset"] = ProductColor.objects.filter(
                    variants__product_id=product_id
                ).distinct()
        return super().formfield_for_foreignkey(db_field, request, **kwargs)
    @admin.display(description="Preview")
    def preview(self, obj):
        # Use the small thumbnail variant instead of the full detail-page
        # image — the admin list only ever renders this at 70x70.
        return image_preview_tag(obj.thumbnail or obj.image, 70, 70)

class ProductVariantInline(admin.TabularInline):
    model = ProductVariant
    form = VariantStockForm
    extra = 1
    fields = ("color", "size", "stock", "reserved_stock")
    # Managed by checkout and the cleanup job only.
    readonly_fields = ("reserved_stock",)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    inlines = [ProductImageInline, ProductVariantInline]

    list_display = (
        "name",
        "code",
        "is_active",
        "category",
        "has_sizes",
        "original_price",
        "price",
        "discount_percentage",
        "shipping_charge",
        "created_at",
    )
    list_editable = ("is_active",)
    list_filter = (
        "is_active",
        "category",
        "has_sizes",
        "tags",
        "created_at",
    )
    actions = ["hide_from_shop", "show_in_shop"]
    search_fields = (
        "name",
        "code",
        "description",
        "category__name",
        "tags__name",
    )
    autocomplete_fields = ("category",)
    filter_horizontal = ("tags",)
    readonly_fields = ("discount_percentage", "created_at")
    ordering = ("-created_at",)
    list_per_page = 25
    save_on_top = True
    date_hierarchy = "created_at"

    @admin.action(description="Hide from shop")
    def hide_from_shop(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f"{updated} product(s) hidden from the shop.")

    @admin.action(description="Show in shop")
    def show_in_shop(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f"{updated} product(s) shown in the shop.")

    def save_formset(self, request, form, formset, change):
        super().save_formset(request, form, formset, change)
        for f in formset.forms:
            if getattr(f, "stock_note", ""):
                self.message_user(request, f.stock_note, level="warning")

    def has_delete_permission(self, request, obj=None):
        # Deleting breaks customers' carts and shared links (a re-created
        # product gets new ids). Staff hide products instead; only a superuser
        # may delete, and never a product that has been ordered.
        if not request.user.is_superuser:
            return False
        if obj is not None and OrderItem.objects.filter(variant__product=obj).exists():
            return False
        return True

    def get_actions(self, request):
        actions = super().get_actions(request)
        if not request.user.is_superuser:
            actions.pop("delete_selected", None)
        return actions

    fieldsets = (
        ("Basic Information", {
            "fields": (
                "name",
                "code",
                "is_active",
                "category",
                "description",
                "tags",
                "original_price",
                "price",
                "discount_percentage",
                "shipping_charge",
                "has_sizes",
                "created_at",
            )
        }),
    )


@admin.register(ProductVariant)
class ProductVariantAdmin(admin.ModelAdmin):
    form = VariantStockForm
    readonly_fields = ("reserved_stock",)
    list_display = (
        "product",
        "color",
        "size",
        "stock",
        "reserved_stock",
        "out_of_stock",
    )
    list_editable = ("stock",)
    list_filter = (
        "product__category",
        "color",
        "size",
    )
    search_fields = (
        "product__name",
        "product__code",
        "color__name",
        "size",
    )
    autocomplete_fields = ("product", "color")
    ordering = ("product__name", "color__name", "size")
    list_per_page = 25
    save_on_top = True

    @admin.display(boolean=True, description="Out of stock")
    def out_of_stock(self, obj):
        return obj.is_out_of_stock

    def get_changelist_form(self, request, **kwargs):
        # The editable stock column uses its own form; make it the safe one.
        kwargs.setdefault("form", VariantStockForm)
        return super().get_changelist_form(request, **kwargs)

    def save_model(self, request, obj, form, change):
        # Both the edit page and the stock column in the list come through here.
        if isinstance(form, VariantStockForm):
            form.save_safely(obj)
            if form.stock_note:
                self.message_user(request, form.stock_note, level="warning")
        else:
            super().save_model(request, obj, form, change)
