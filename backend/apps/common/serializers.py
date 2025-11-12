from rest_framework import serializers
from .models import Country, Province, City, District, PlacesCategory, CountryElectric


class CountrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Country
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


class ProvinceSerializer(serializers.ModelSerializer):
    country_name = serializers.CharField(source='country.country_name', read_only=True)
    country_iso2 = serializers.CharField(source='country.iso2', read_only=True)

    class Meta:
        model = Province
        fields = '__all__'


class CitySerializer(serializers.ModelSerializer):
    province_name = serializers.CharField(source='province.name', read_only=True)
    country_name = serializers.CharField(source='province.country.country_name', read_only=True)

    class Meta:
        model = City
        fields = '__all__'


class DistrictSerializer(serializers.ModelSerializer):
    city_name = serializers.CharField(source='city.name', read_only=True)
    province_name = serializers.CharField(source='city.province.name', read_only=True)
    full_address = serializers.CharField(read_only=True)

    class Meta:
        model = District
        fields = '__all__'
