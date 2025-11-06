from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TripAlertViewSet

router = DefaultRouter()
router.register(r'travel', TripAlertViewSet, basename='trip-alert')

urlpatterns = [
    path('', include(router.urls)),
]
