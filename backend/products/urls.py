from django.urls import path
from .views import CategoryListView,ProductByTagView ,HeroImageListView

urlpatterns = [
    path('categories/', CategoryListView.as_view()),
    path('tag/<str:tag_name>/', ProductByTagView.as_view()),
    path("hero/", HeroImageListView.as_view()),
]