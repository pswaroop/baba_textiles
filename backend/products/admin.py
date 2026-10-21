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
    extra = 1
    fields = ("color", "size", "stock", "reserved_stock")


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    inlines = [ProductImageInline, ProductVariantInline]

    list_display = (
        "name",
        "code",
        "category",
        "has_sizes",
        "original_price",
        "price",
        "discount_percentage",
        "shipping_charge",
        "created_at",
    )
    list_filter = (
        "category",
        "has_sizes",
        "tags",
        "created_at",
    )
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

    fieldsets = (
        ("Basic Information", {
            "fields": (
                "name",
                "code",
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
