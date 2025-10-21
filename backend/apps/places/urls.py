from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PlaceViewSet, PhotoViewSet

router = DefaultRouter()
router.register(r'places', PlaceViewSet, basename='place')
router.register(r'photos', PhotoViewSet, basename='photo')

urlpatterns = [
    path('', include(router.urls)),
]
