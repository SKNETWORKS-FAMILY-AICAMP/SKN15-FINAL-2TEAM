from django.db import models
from apps.common.models import Country


class ExchangeRate(models.Model):
    """
    Exchange rate model - stores currency exchange rates from various banks.
    Maps to the exchange_rates table in the database.
    """

    rate_idx = models.AutoField(primary_key=True, db_column='rate_idx')
    country_code = models.ForeignKey(
        Country,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='country_code',
        to_field='country_code',
        related_name='exchange_rates'
    )
    currency_code = models.CharField(max_length=10)
    bank = models.TextField()
    buy = models.FloatField(null=True, blank=True)
    sell = models.FloatField(null=True, blank=True)
    timestamp = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'exchange_rates'
        verbose_name = 'Exchange Rate'
        verbose_name_plural = 'Exchange Rates'
        unique_together = [['currency_code', 'bank']]
        constraints = [
            models.UniqueConstraint(
                fields=['currency_code', 'bank'],
                name='uq_exchange_rates_currency_bank'
            ),
        ]

    def __str__(self):
        return f"{self.currency_code} - {self.bank} (Buy: {self.buy}, Sell: {self.sell})"
