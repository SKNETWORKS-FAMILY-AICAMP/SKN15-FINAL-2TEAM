from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.accounts'
    verbose_name = 'User Accounts'

    def ready(self):
        """
        Import signal handlers when the app is ready.
        """
        # Import signals here if needed
        # import apps.accounts.signals
        pass
