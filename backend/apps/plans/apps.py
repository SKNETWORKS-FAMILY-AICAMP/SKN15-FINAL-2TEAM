from django.apps import AppConfig


class PlansConfig(AppConfig):
    """
    Django application configuration for the plans app.
    This app manages trip plans, days, items, and member permissions.
    """
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.plans'
    verbose_name = 'Trip Plans'
