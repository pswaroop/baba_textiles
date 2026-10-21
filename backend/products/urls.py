from django.urls import path
from .views import CategoryListView,ProductByTagView ,HeroImageListView,ValidateStockView,all_products_view,ProductDetailView

urlpatterns = [
    path('categories/', CategoryListView.as_view()),
    path('tag/<str:tag_name>/', ProductByTagView.as_view()),
    path("hero/", HeroImageListView.as_view()),
    path("validate-stock/", ValidateStockView.as_view()),
    path("all-tagged/", all_products_view),
    path("<int:pk>/", ProductDetailView.as_view()),
]
