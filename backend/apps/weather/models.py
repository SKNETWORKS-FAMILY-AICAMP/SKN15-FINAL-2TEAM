from django.db import models
from apps.common.models import Country, Region1


class WeatherDaily(models.Model):
    """Daily weather forecast data"""
    weather_daily_idx = models.AutoField(primary_key=True)
    country_code = models.ForeignKey(
        Country,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='country_code',
        to_field='country_code',
        related_name='daily_weather'
    )
    city_code = models.ForeignKey(
        Region1,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='city_code',
        to_field='city_code',
        related_name='daily_weather'
    )
    forecast_date = models.DateField()
    weather = models.TextField(null=True, blank=True)
    temp_min_c = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Minimum temperature in Celsius"
    )
    temp_max_c = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Maximum temperature in Celsius"
    )
    rainfall_mm = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Rainfall in millimeters"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'weather_daily'
        unique_together = [['city_code', 'forecast_date']]
        verbose_name = 'Daily Weather'
        verbose_name_plural = 'Daily Weather'
        ordering = ['-forecast_date']
        indexes = [
            models.Index(fields=['forecast_date']),
            models.Index(fields=['city_code', 'forecast_date']),
        ]

    def __str__(self):
        city_name = self.city_code.city_name if self.city_code else "Unknown"
        return f"{city_name} - {self.forecast_date}"


class WeatherMonthly(models.Model):
    """Monthly climate statistics"""
    weather_monthly_idx = models.AutoField(primary_key=True)
    country_code = models.ForeignKey(
        Country,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='country_code',
        to_field='country_code',
        related_name='monthly_weather'
    )
    city_code = models.ForeignKey(
        Region1,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='city_code',
        to_field='city_code',
        related_name='monthly_weather'
    )
    month = models.IntegerField(
        help_text="Month number (1-12)"
    )
    max_temp_c = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Average maximum temperature in Celsius"
    )
    min_temp_c = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Average minimum temperature in Celsius"
    )
    mean_temp_c = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Average mean temperature in Celsius"
    )
    raindays = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Average number of rainy days"
    )
    rainfall_mm = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Average rainfall in millimeters"
    )
    climate_from = models.DateField(
        null=True,
        blank=True,
        help_text="Climate data reference date"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'weather_monthly'
        unique_together = [['city_code', 'month']]
        verbose_name = 'Monthly Weather'
        verbose_name_plural = 'Monthly Weather'
        ordering = ['month']
        indexes = [
            models.Index(fields=['month']),
            models.Index(fields=['city_code', 'month']),
        ]

    def __str__(self):
        city_name = self.city_code.city_name if self.city_code else "Unknown"
        return f"{city_name} - Month {self.month}"
