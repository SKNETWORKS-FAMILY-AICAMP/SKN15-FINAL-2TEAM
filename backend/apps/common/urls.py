"""
URL configuration for common app
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'countries', views.CountryViewSet, basename='country')
router.register(r'provinces', views.ProvinceViewSet, basename='province')
router.register(r'cities', views.CityViewSet, basename='city')
router.register(r'districts', views.DistrictViewSet, basename='district')
router.register(r'categories', views.PlacesCategoryViewSet, basename='category')
router.register(r'electric', views.CountryElectricViewSet, basename='electric')

urlpatterns = [
    path('health/', views.health_check, name='health_check'),
    path('api/config/', views.get_frontend_config, name='frontend_config'),
    path('', include(router.urls)),
]
