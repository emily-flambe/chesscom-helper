# accounts/urls.py
from django.urls import path
from .api_views import RegisterAPIView  # or from .views import register, etc.

urlpatterns = [
    path('register/', RegisterAPIView.as_view(), name='api-register'),
]
