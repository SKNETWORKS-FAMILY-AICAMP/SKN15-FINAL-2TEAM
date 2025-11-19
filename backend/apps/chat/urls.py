from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ChatRoomViewSet, rag_test
from .views_stt import transcribe_audio, stt_health
from .views_admin import BotPerformanceViewSet, RAGTestViewSet

router = DefaultRouter()
router.register(r'rooms', ChatRoomViewSet, basename='chatroom')
router.register(r'admin/performance', BotPerformanceViewSet, basename='bot-performance')
router.register(r'admin/rag-test', RAGTestViewSet, basename='rag-test')

urlpatterns = [
    path('', include(router.urls)),
    # STT (Speech-to-Text) API
    path('stt/transcribe/', transcribe_audio, name='stt-transcribe'),
    path('stt/health/', stt_health, name='stt-health'),
    # RAG Test API (Admin Dashboard)
    path('test/', rag_test, name='rag-test'),
]
