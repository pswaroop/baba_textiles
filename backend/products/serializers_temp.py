from rest_framework import serializers
from .models import (
    Category,
    Product,
    ProductColor,
    ProductImage,
    ProductVariant,
    HeroImage,
)

class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ["id", "image", "color"]

class ProductColorSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductColor
        fields = ["id", "name", "color"]

class ProductVariantSerializer(serializers.ModelSerializer):
    color = ProductColorSerializer(read_only=True)
    stock = serializers.SerializerMethodField()

    class Meta:
        model = ProductVariant
        fields = ["id", "size", "stock", "color"]

    def get_stock(self, obj):
        # 🚀 OPTIMIZATION & FIX: Send 'available' stock to the frontend, 
        # not total physical stock. This prevents users from seeing items 
        # as available if they are currently locked in someone else's checkout.
        physical_stock = getattr(obj, 'stock', 0)
        reserved_stock = getattr(obj, 'reserved_stock', 0)
        return max(0, physical_stock - reserved_stock)

class ProductSerializer(serializers.ModelSerializer):
    images = ProductImageSerializer(many=True, read_only=True)
    variants = ProductVariantSerializer(many=True, read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    
    # Use these instead of computing them heavily
    tag_names = serializers.SerializerMethodField()
    available_colors = serializers.SerializerMethodField()
    
    # Expose the sorting variables to the frontend
    total_stock = serializers.SerializerMethodField()
    is_sold_out = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id", "code", "name", "description", "price",
            "original_price", "discount_percentage", "has_sizes",
            "shipping_charge", "category", "category_name",
            "variants", "images", "tag_names", "available_colors",
            "total_stock", "is_sold_out",
        ]

    def get_tag_names(self, obj):
        # Assumes 'tags' is prefetched in the view
        return [tag.name for tag in obj.tags.all()]

    def get_available_colors(self, obj):
        # 🚀 OPTIMIZATION: Do NOT query the database here!
        # Since we already prefetched 'variants' and 'variants__color' in the view,
        # we can just extract the unique colors in memory. Extremely fast!
        variants = obj.variants.all()
        
        # Use a dictionary to keep unique colors by ID
        unique_colors = {}
        for variant in variants:
            if variant.color and variant.color.id not in unique_colors:
                unique_colors[variant.color.id] = variant.color
                
        # Serialize the unique colors
        return ProductColorSerializer(unique_colors.values(), many=True).data

    def get_total_stock(self, obj):
        # If the view annotated 'total_stock' directly in the DB, use it (Super Fast)
        if hasattr(obj, 'total_stock'):
            return obj.total_stock
        
        # Safe fallback: If not annotated, compute it in memory from prefetched variants
        return sum(
            max(0, getattr(v, 'stock', 0) - getattr(v, 'reserved_stock', 0)) 
            for v in obj.variants.all()
        )

    def get_is_sold_out(self, obj):
        # If the view annotated 'is_sold_out', use it
        if hasattr(obj, 'is_sold_out'):
            return bool(obj.is_sold_out)
        
        # Safe fallback
        return self.get_total_stock(obj) <= 0

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = "__all__"

class HeroImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = HeroImage
        fields = ["id", "image"]
