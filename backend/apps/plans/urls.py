from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TripPlanViewSet, TripDayViewSet, TripItemViewSet, admin_statistics

router = DefaultRouter()
router.register(r'trips', TripPlanViewSet, basename='trip')
router.register(r'days', TripDayViewSet, basename='tripday')
router.register(r'items', TripItemViewSet, basename='tripitem')

urlpatterns = [
    path('', include(router.urls)),
    path('admin/statistics/', admin_statistics, name='admin-statistics'),
]
