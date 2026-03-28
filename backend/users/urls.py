from django.urls import path
from .views import RegisterView, LoginView, MeView
from .views import ProfileView
from .views import AddressListCreateView, AddressDetailView,GoogleLoginView
from orders.views import user_orders
urlpatterns = [
    path("register/", RegisterView.as_view()),
    path("login/", LoginView.as_view()),
    path("me/", MeView.as_view()),
    path("profile/", ProfileView.as_view()),
    path("addresses/", AddressListCreateView.as_view()),
    path("addresses/<int:pk>/", AddressDetailView.as_view()),
    path('google/', GoogleLoginView.as_view(), name='google_login'),
    path('orders/', user_orders, name='user_orders'),
]