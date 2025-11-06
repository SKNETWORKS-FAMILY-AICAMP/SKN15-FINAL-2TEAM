from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import WeatherDailyViewSet, WeatherMonthlyViewSet

router = DefaultRouter()
router.register(r'daily', WeatherDailyViewSet, basename='weather-daily')
router.register(r'monthly', WeatherMonthlyViewSet, basename='weather-monthly')

urlpatterns = [
    path('', include(router.urls)),
]
