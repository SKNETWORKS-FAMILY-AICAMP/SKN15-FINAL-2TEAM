from rest_framework import serializers
from .models import Country, Region1, Region2, PlacesCategory, CountryElectric


class CountrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Country
        fields = '__all__'


class Region1Serializer(serializers.ModelSerializer):
    class Meta:
        model = Region1
        fields = '__all__'


class Region2Serializer(serializers.ModelSerializer):
    class Meta:
        model = Region2
        fields = '__all__'


class PlacesCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = PlacesCategory
        fields = '__all__'


class CountryElectricSerializer(serializers.ModelSerializer):
    country_name_display = serializers.CharField(source='country_code.country_name', read_only=True)

    class Meta:
        model = CountryElectric
        fields = '__all__'
        read_only_fields = ['id']
