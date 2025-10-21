"""
Development settings
"""

from .base import *
from datetime import timedelta

DEBUG = True

ALLOWED_HOSTS = ['*']

# Development-specific apps
# INSTALLED_APPS += [
#     'django_extensions',
# ]

# CORS - Allow all in development
CORS_ALLOW_ALL_ORIGINS = True

# Longer JWT token lifetime for development
SIMPLE_JWT = {
    **SIMPLE_JWT,
    'ACCESS_TOKEN_LIFETIME': timedelta(days=1),  # 1 day for development
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),  # 30 days
}

# Email backend for development
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# SQLite for quick development (optional)
# DATABASES = {
#     'default': {
#         'ENGINE': 'django.db.backends.sqlite3',
#         'NAME': BASE_DIR / 'db.sqlite3',
#     }
# }
