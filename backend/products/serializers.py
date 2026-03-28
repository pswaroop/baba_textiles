from rest_framework import serializers
from .models import (
    Category,
    Product,
    ProductColor,
    ProductImage,
    ProductColorImage,
    ProductVariant,
    HeroImage
)


# ================= COLOR IMAGE =================

class ProductColorImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductColorImage
        fields = ["id", "image"]


# ================= PRODUCT IMAGE =================

class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ["id", "image"]


# ================= PRODUCT COLOR =================

class ProductColorSerializer(serializers.ModelSerializer):
    images = ProductColorImageSerializer(many=True, read_only=True)

    class Meta:
        model = ProductColor
        fields = ["id", "name", "color", "images"]


# ================= PRODUCT VARIANT =================

class ProductVariantSerializer(serializers.ModelSerializer):
    color = serializers.CharField(source="color.name")

    class Meta:
        model = ProductVariant
        fields = ["id", "size", "stock", "color"]


# ================= PRODUCT =================

class ProductSerializer(serializers.ModelSerializer):
    images = ProductImageSerializer(many=True, read_only=True)
    colors = ProductColorSerializer(many=True, read_only=True)
    variants = ProductVariantSerializer(many=True, read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    tag_names = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "code",
            "name",
            "description",
            "price",
            "original_price",
            "discount_percentage",
            "has_sizes",
            "shipping_charge",  # ✅ ADDED THIS
            "category",
            "category_name",
            "colors",
            "variants",
            "images",
            "tag_names"
        ]

    def get_tag_names(self, obj):
        return [tag.name for tag in obj.tags.all()]


# ================= CATEGORY =================

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = "__all__"


# ================= HERO =================

class HeroImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = HeroImage
        fields = ["id", "image"]