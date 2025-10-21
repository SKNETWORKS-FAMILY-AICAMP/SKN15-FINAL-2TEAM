from django.db import models
from apps.common.models import Country


class TripAlert(models.Model):
    """
    Trip alert model - stores travel safety alerts and warnings for countries.
    Maps to the trip_alerts table in the database.
    """

    alert_idx = models.AutoField(primary_key=True, db_column='alert_idx')
    country_code = models.ForeignKey(
        Country,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='country_code',
        to_field='country_code',
        related_name='trip_alerts'
    )
    level = models.TextField(null=True, blank=True)
    url = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'trip_alerts'
        verbose_name = 'Trip Alert'
        verbose_name_plural = 'Trip Alerts'

    def __str__(self):
        country_name = self.country_code.country_name if self.country_code else 'Unknown'
        return f"Alert {self.alert_idx} - {country_name} (Level: {self.level})"
