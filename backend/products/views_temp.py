from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page

from .models import Product, Category, HeroImage, ProductVariant
from .serializers import ProductSerializer, CategorySerializer, HeroImageSerializer

# 🚀 OPTIMIZATION: Cache the category list for 15 minutes. 
# It rarely changes, so serve it from RAM instead of the Database.
class CategoryListView(generics.ListAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

    @method_decorator(cache_page(60 * 15))
    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)


class ProductByTagView(generics.ListAPIView):
    serializer_class = ProductSerializer

    def get_queryset(self):
        tag_name = self.kwargs.get("tag_name")

        return (
            Product.objects
            .filter(tags__name=tag_name)
            # 🚀 OPTIMIZATION: Good job having these here! This, combined with our 
            # serializer fix, completely removes database stress.
            .select_related("category")
            .prefetch_related(
                "tags",
                "images",
                "variants",
                "variants__color",
            )
        )

# 🚀 OPTIMIZATION: Cache hero images for 1 hour.
class HeroImageListView(generics.ListAPIView):
    queryset = HeroImage.objects.filter(is_active=True)
    serializer_class = HeroImageSerializer

    @method_decorator(cache_page(60 * 60))
    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)

# ... [Keep your ValidateStockView exactly the same as before] ...

class ValidateStockView(APIView):
    """
    Validates if the requested quantities for cart items are available in stock.
    """
    def post(self, request, *args, **kwargs):
        items = request.data.get('items', [])
        
        if not items:
            return Response(
                {"status": "error", "message": "Cart is empty."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        for item in items:
            variant_id = item.get('variant_id')
            quantity = item.get('quantity')
            product_name = item.get('product_name', 'Unknown Product')
            color = item.get('color', '')
            size = item.get('size', '')
            
            if not variant_id or quantity is None:
                return Response(
                    {"status": "error", "message": "Invalid cart item data."}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            try:
                variant = ProductVariant.objects.get(id=variant_id)
                
                if quantity > variant.stock:
                    # Format a nice error message specifying exactly what is out of stock
                    variant_details = [str(color), str(size)]
                    variant_details = [d for d in variant_details if d and d != 'None']
                    details_str = f" ({' - '.join(variant_details)})" if variant_details else ""
                    
                    return Response({
                        "status": "error", 
                        "message": f"Only {variant.stock} in stock for {product_name}{details_str}. Please reduce the quantity."
                    }, status=status.HTTP_400_BAD_REQUEST)
                    
            except ProductVariant.DoesNotExist:
                return Response({
                    "status": "error",
                    "message": f"Variant unavailable for {product_name}."
                }, status=status.HTTP_404_NOT_FOUND)

        # If loop finishes without returning, all items are in stock
        return Response({
            "status": "success", 
            "message": "All items are in stock."
        }, status=status.HTTP_200_OK)
