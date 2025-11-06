from rest_framework import serializers
from .models import ExchangeRate


class ExchangeRateSerializer(serializers.ModelSerializer):
    """Exchange Rate Serializer"""
    country_name = serializers.CharField(source="country_code.country_name", read_only=True)

    class Meta:
        model = ExchangeRate
        fields = [
            "rate_idx", "country_code", "country_name",
            "currency_code", "bank", "buy", "sell",
            "timestamp", "created_at"
        ]
        read_only_fields = ["rate_idx", "created_at"]

