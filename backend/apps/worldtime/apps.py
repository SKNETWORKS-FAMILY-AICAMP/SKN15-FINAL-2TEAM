from django.apps import AppConfig


class WorldtimeConfig(AppConfig):
    """
    Django application configuration for the worldtime app.
    This app manages timezone information for cities around the world.
    """
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.worldtime'
    verbose_name = 'World Time'
