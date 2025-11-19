from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TripPlanViewSet, TripDayViewSet, TripItemViewSet, admin_statistics, admin_all_trips, admin_trip_chat_logs
from .views_youtube import YouTubeCrawlerJobViewSet

router = DefaultRouter()
router.register(r'trips', TripPlanViewSet, basename='trip')
router.register(r'days', TripDayViewSet, basename='tripday')
router.register(r'items', TripItemViewSet, basename='tripitem')
router.register(r'youtube-crawler', YouTubeCrawlerJobViewSet, basename='youtube-crawler')

urlpatterns = [
    path('', include(router.urls)),
    path('admin/statistics/', admin_statistics, name='admin-statistics'),
    path('admin/trips/', admin_all_trips, name='admin-all-trips'),
    path('admin/trips/<int:trip_idx>/chat-logs/', admin_trip_chat_logs, name='admin-trip-chat-logs'),
]
