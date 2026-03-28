from rest_framework import generics
from .models import Product, Category
from .serializers import ProductSerializer, CategorySerializer
from .models import HeroImage
from .serializers import HeroImageSerializer

class CategoryListView(generics.ListAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer


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
                "colors",
                "colors__images",   # ✅ correct relation
                "variants"
            )
        )



class HeroImageListView(generics.ListAPIView):
    queryset = HeroImage.objects.filter(is_active=True)
    serializer_class = HeroImageSerializer