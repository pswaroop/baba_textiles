from django.contrib import admin
from .models import (
    Category,
    Product,
    ProductImage,
    ProductColor,
    ProductColorImage,
    ProductVariant,
    ProductTag,
    HeroImage
)

admin.site.register(HeroImage)

# ========================
# Inline Models
# ========================


class CategoryAdmin(admin.ModelAdmin):
    prepopulated_fields = {"slug": ("name",)}

class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1


class ProductColorImageInline(admin.TabularInline):
    model = ProductColorImage
    extra = 1


# ========================
# Admin Models
# ========================

class ProductAdmin(admin.ModelAdmin):
    inlines = [ProductImageInline]
    filter_horizontal = ('tags',)

    list_display = (
        "name",
        "code",
        "category",
        "shipping_charge",
        "original_price",
        "discount_percentage",
    )


class ProductColorAdmin(admin.ModelAdmin):
    inlines = [ProductColorImageInline]


# ========================
# Register
# ========================

admin.site.register(Category, CategoryAdmin)
admin.site.register(Product, ProductAdmin)
admin.site.register(ProductColor, ProductColorAdmin)
admin.site.register(ProductVariant)
admin.site.register(ProductTag)