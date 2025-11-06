from rest_framework import serializers
from .models import TripAlert


class TripAlertSerializer(serializers.ModelSerializer):
    """Trip Alert Serializer"""
    country_name = serializers.CharField(source="country_code.country_name", read_only=True)

    class Meta:
        model = TripAlert
        fields = [
            "alert_idx", "country_code", "country_name",
            "level", "url", "created_at"
        ]
        read_only_fields = ["alert_idx", "created_at"]

