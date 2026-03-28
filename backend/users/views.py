import requests
from django.contrib.auth.models import User
from django.contrib.auth import authenticate

from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.generics import CreateAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Address, Profile
from .serializers import (
    RegisterSerializer, 
    AddressSerializer, 
    ProfileSerializer
)

# --- Authentication Views ---

class RegisterView(CreateAPIView):
    serializer_class = RegisterSerializer

class LoginView(APIView):
    def post(self, request):
        email = request.data.get("email")
        password = request.data.get("password")

        user = User.objects.filter(email=email).first()
        if user is None:
            return Response({"error": "User not found"}, status=status.HTTP_400_BAD_REQUEST)

        user = authenticate(username=user.username, password=password)
        if user is None:
            return Response({"error": "Invalid password"}, status=status.HTTP_400_BAD_REQUEST)

        refresh = RefreshToken.for_user(user)
        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": {
                "id": user.id,
                "name": user.first_name,
                "email": user.email
            }
        })

class GoogleLoginView(APIView):
    """
    Exchanges a Google Access Token for a Django JWT Token
    """
    def post(self, request):
        access_token = request.data.get('access_token')
        
        # Verify token with Google
        google_response = requests.get(
            f"https://www.googleapis.com/oauth2/v3/userinfo?access_token={access_token}"
        )
        
        if google_response.status_code != 200:
            return Response({"error": "Invalid Google Token"}, status=status.HTTP_400_BAD_REQUEST)

        user_data = google_response.json()
        email = user_data['email']
        first_name = user_data.get('given_name', 'Google User')
        
        # Get or Create user
        # We use email as username for social logins
        user, created = User.objects.get_or_create(
            email=email,
            defaults={'username': email, 'first_name': first_name}
        )

        refresh = RefreshToken.for_user(user)
        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": {
                "id": user.id,
                "name": user.first_name,
                "email": user.email
            }
        })

class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            "id": user.id,
            "name": user.first_name,
            "email": user.email
        })

    def patch(self, request):
        """Handle updating the username/first_name"""
        user = request.user
        new_name = request.data.get("first_name")
        
        if new_name:
            user.first_name = new_name
            user.save()
            return Response({
                "id": user.id,
                "name": user.first_name,
                "email": user.email
            })
        return Response({"error": "Name is required"}, status=status.HTTP_400_BAD_REQUEST)

# --- Profile & Address Views ---

class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user.profile

class AddressListCreateView(generics.ListCreateAPIView):
    serializer_class = AddressSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class AddressDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AddressSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user)