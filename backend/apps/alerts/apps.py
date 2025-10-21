from django.apps import AppConfig


class AlertsConfig(AppConfig):
    """
    Django application configuration for the alerts app.
    This app manages travel safety alerts and warnings for countries.
    """
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.alerts'
    verbose_name = 'Travel Alerts'
