from django.db.models import Sum, Case, When, Value, IntegerField
from django.db.models.functions import Coalesce
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page

from .models import Product, Category, HeroImage, ProductVariant
from .serializers import ProductSerializer, CategorySerializer, HeroImageSerializer


class CategoryListView(generics.ListAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

#    @method_decorator(cache_page(60 * 15))
#    def dispatch(self, *args, **kwargs):
#        return super().dispatch(*args, **kwargs)


class ProductByTagView(generics.ListAPIView):
    serializer_class = ProductSerializer

    def get_queryset(self):
        tag_name = self.kwargs.get("tag_name")

        return (
            Product.objects
            .filter(tags__name=tag_name)
            .select_related("category")
            .prefetch_related(
                "tags",
                "images",
                "variants",
                "variants__color",
            )
            .annotate(
                total_stock=Coalesce(Sum("variants__stock"), 0),
            )
            .annotate(
                is_sold_out=Case(
                    When(total_stock__lte=0, then=Value(1)),
                    default=Value(0),
                    output_field=IntegerField(),
                )
            )
            # ✅ Order by in-stock first, then by newest created_at descending
            .order_by("is_sold_out", "-created_at")
        )

from django.core.cache import cache
from rest_framework import generics
from rest_framework.response import Response

from .models import HeroImage
from .serializers import HeroImageSerializer


class HeroImageListView(generics.ListAPIView):
    serializer_class = HeroImageSerializer

    def get_queryset(self):
        return HeroImage.objects.filter(is_active=True).order_by("-id")

    def list(self, request, *args, **kwargs):
        cache_key = "hero_images_api_cache"
        cached_data = cache.get(cache_key)

        if cached_data is not None:
            return Response(cached_data)

        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        data = serializer.data

        cache.set(cache_key, data, timeout=60 * 60)
        return Response(data)

class ValidateStockView(APIView):
    """
    Validates if the requested quantities for cart items are available in stock.
    """
    def post(self, request, *args, **kwargs):
        items = request.data.get("items", [])

        if not items:
            return Response(
                {"status": "error", "message": "Cart is empty."},
                status=status.HTTP_400_BAD_REQUEST
            )

        for item in items:
            variant_id = item.get("variant_id")
            quantity = item.get("quantity")
            product_name = item.get("product_name", "Unknown Product")
            color = item.get("color", "")
            size = item.get("size", "")

            if not variant_id or quantity is None:
                return Response(
                    {"status": "error", "message": "Invalid cart item data."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            try:
                variant = ProductVariant.objects.get(id=variant_id)
                
                # ✅ Compute available stock by subtracting what's currently reserved
                available_stock = max(0, variant.stock - variant.reserved_stock)

                if quantity > available_stock:
                    variant_details = [str(color), str(size)]
                    variant_details = [d for d in variant_details if d and d != "None"]
                    details_str = f" ({' - '.join(variant_details)})" if variant_details else ""

                    return Response({
                        "status": "error",
                        "message": f"Only {available_stock} in stock for {product_name}{details_str}. Please reduce the quantity."
                    }, status=status.HTTP_400_BAD_REQUEST)

            except ProductVariant.DoesNotExist:
                return Response({
                    "status": "error",
                    "message": f"Variant unavailable for {product_name}."
                }, status=status.HTTP_404_NOT_FOUND)

        return Response({
            "status": "success",
            "message": "All items are in stock."
        }, status=status.HTTP_200_OK)
