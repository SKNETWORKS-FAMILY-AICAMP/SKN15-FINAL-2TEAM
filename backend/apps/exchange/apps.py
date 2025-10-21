from django.apps import AppConfig


class ExchangeConfig(AppConfig):
    """
    Django application configuration for the exchange app.
    This app manages currency exchange rates from various banks.
    """
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.exchange'
    verbose_name = 'Exchange Rates'
