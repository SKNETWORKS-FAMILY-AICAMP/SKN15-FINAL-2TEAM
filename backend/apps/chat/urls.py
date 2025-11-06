from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ChatRoomViewSet
from .views_stt import transcribe_audio, stt_health

router = DefaultRouter()
router.register(r'rooms', ChatRoomViewSet, basename='chatroom')

urlpatterns = [
    path('', include(router.urls)),
    # STT (Speech-to-Text) API
    path('stt/transcribe/', transcribe_audio, name='stt-transcribe'),
    path('stt/health/', stt_health, name='stt-health'),
]
