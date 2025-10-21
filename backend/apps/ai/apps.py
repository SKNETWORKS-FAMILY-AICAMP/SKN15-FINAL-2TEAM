from django.apps import AppConfig


class AiConfig(AppConfig):
    """
    Django application configuration for the AI app.
    This app manages AI-powered recommendations and their application tracking.
    """
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.ai'
    verbose_name = 'AI Recommendations'
