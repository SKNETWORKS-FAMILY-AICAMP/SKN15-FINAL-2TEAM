from django.apps import AppConfig


class ExportConfig(AppConfig):
    """
    Django application configuration for the export app.
    This app manages asynchronous export jobs for trip plans (PDF, ICS, CSV).
    """
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.export'
    verbose_name = 'Export Jobs'
