from rest_framework import serializers
from .models import WeatherDaily, WeatherMonthly


class WeatherDailySerializer(serializers.ModelSerializer):
    """Daily Weather Serializer"""
    country_name = serializers.CharField(source="country_code.country_name", read_only=True)
    province_name = serializers.CharField(source="province_idx.name", read_only=True)
    city_name = serializers.CharField(source="city_idx.name", read_only=True)
    district_name = serializers.CharField(source="district_idx.name", read_only=True)

    class Meta:
        model = WeatherDaily
        fields = [
            "weather_daily_idx", "country_code", "country_name",
            "province_idx", "province_name",
            "city_idx", "city_name",
            "district_idx", "district_name",
            "forecast_date",
            "weather_am", "weather_pm",
            "temp_min_c", "temp_max_c",
            "precipitation_am", "precipitation_pm",
            "weather", "rainfall_mm",
            "created_at", "updated_at"
        ]
        read_only_fields = ["weather_daily_idx", "created_at", "updated_at"]


class WeatherMonthlySerializer(serializers.ModelSerializer):
    """Monthly Weather Serializer"""
    country_name = serializers.CharField(source="country_code.country_name", read_only=True)
    city_name = serializers.CharField(source="city_code.city_name", read_only=True)

    class Meta:
        model = WeatherMonthly
        fields = [
            "weather_monthly_idx", "country_code", "country_name",
            "city_code", "city_name", "month",
            "max_temp_c", "min_temp_c", "mean_temp_c",
            "raindays", "rainfall_mm", "climate_from",
            "created_at"
        ]
        read_only_fields = ["weather_monthly_idx", "created_at"]

