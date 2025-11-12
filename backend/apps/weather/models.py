from django.db import models
from apps.common.models import Country, Province, City, District


class WeatherDaily(models.Model):
    """Daily weather forecast data from KMA (기상청)"""
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
    province_idx = models.ForeignKey(
        Province,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='province_idx',
        related_name='daily_weather'
    )
    city_idx = models.ForeignKey(
        City,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='city_idx',
        related_name='daily_weather'
    )
    district_idx = models.ForeignKey(
        District,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='district_idx',
        related_name='daily_weather'
    )
    forecast_date = models.DateField()

    # 오전/오후 날씨
    weather_am = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        help_text="Morning weather condition (맑음, 구름많음, 흐림, 비, 눈 등)"
    )
    weather_pm = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        help_text="Afternoon weather condition"
    )

    # 기온
    temp_min_c = models.DecimalField(
        max_digits=5,
        decimal_places=1,
        null=True,
        blank=True,
        help_text="Minimum temperature in Celsius"
    )
    temp_max_c = models.DecimalField(
        max_digits=5,
        decimal_places=1,
        null=True,
        blank=True,
        help_text="Maximum temperature in Celsius"
    )

    # 강수확률
    precipitation_am = models.IntegerField(
        null=True,
        blank=True,
        help_text="Morning precipitation probability (%)"
    )
    precipitation_pm = models.IntegerField(
        null=True,
        blank=True,
        help_text="Afternoon precipitation probability (%)"
    )

    # 기존 호환성 유지
    weather = models.TextField(null=True, blank=True, help_text="Legacy field")
    rainfall_mm = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Rainfall in millimeters"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'weather_daily'
        unique_together = [['district_idx', 'forecast_date']]
        verbose_name = 'Daily Weather'
        verbose_name_plural = 'Daily Weather'
        ordering = ['-forecast_date']
        indexes = [
            models.Index(fields=['forecast_date']),
            models.Index(fields=['province_idx', 'forecast_date']),
            models.Index(fields=['city_idx', 'forecast_date']),
            models.Index(fields=['district_idx', 'forecast_date']),
        ]

    def __str__(self):
        if self.district_idx:
            location = f"{self.district_idx.name}"
        elif self.city_idx:
            location = f"{self.city_idx.name}"
        elif self.province_idx:
            location = f"{self.province_idx.name}"
        else:
            location = "Unknown"
        return f"{location} - {self.forecast_date}"


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
    province_idx = models.ForeignKey(
        Province,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='province_idx',
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
        unique_together = [['province_idx', 'month']]
        verbose_name = 'Monthly Weather'
        verbose_name_plural = 'Monthly Weather'
        ordering = ['month']
        indexes = [
            models.Index(fields=['month']),
            models.Index(fields=['province_idx', 'month']),
        ]

    def __str__(self):
        province_name = self.province_idx.name if self.province_idx else "Unknown"
        return f"{province_name} - Month {self.month}"
