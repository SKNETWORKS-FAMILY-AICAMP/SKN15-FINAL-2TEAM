"""
URL configuration for Triplan project.
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

urlpatterns = [
    # Admin
    path('admin/', admin.site.urls),

    # API Authentication
    path('api/auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # API Endpoints
    path('api/accounts/', include('apps.accounts.urls')),
    path('api/rooms/', include('apps.rooms.urls')),
    path('api/plans/', include('apps.plans.urls')),
    path('api/chat/', include('apps.chat.urls')),
    path('api/ai/', include('apps.ai.urls')),
    path('api/export/', include('apps.export.urls')),

    # Health check
    path('health/', include('core.urls')),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
