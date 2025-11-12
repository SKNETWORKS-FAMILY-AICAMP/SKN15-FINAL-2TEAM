from rest_framework import serializers
from .models import Place, Photo, PlaceCategory
from apps.common.models import Country, Province, City, District


class CountrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Country
        fields = ['country_idx', 'country_name', 'iso2']


class ProvinceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Province
        fields = ['province_idx', 'name', 'code']


class CitySerializer(serializers.ModelSerializer):
    class Meta:
        model = City
        fields = ['city_idx', 'name', 'code']


class DistrictSerializer(serializers.ModelSerializer):
    class Meta:
        model = District
        fields = ['district_idx', 'name', 'code']


class PhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Photo
        fields = ['photo_idx', 'is_primary', 'width', 'height',
                  'local_path', 'remote_uri', 'attributions']


class PlaceListSerializer(serializers.ModelSerializer):
    """Simplified serializer for list views"""
    country = serializers.CharField(source='country_idx.country_name', read_only=True)
    province = serializers.CharField(source='province_idx.name', read_only=True)
    city = serializers.CharField(source='city_idx.name', read_only=True)
    district = serializers.CharField(source='district_idx.name', read_only=True)

    class Meta:
        model = Place
        fields = [
            'place_idx', 'place_id', 'name', 'ko_name',
            'country', 'province', 'city', 'district',
            'address', 'latitude', 'longitude',
            'rating', 'user_ratings_total', 'types'
        ]


class PlaceDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer with all information"""
    country = CountrySerializer(source='country_idx', read_only=True)
    province = ProvinceSerializer(source='province_idx', read_only=True)
    city = CitySerializer(source='city_idx', read_only=True)
    district = DistrictSerializer(source='district_idx', read_only=True)
    photos = PhotoSerializer(many=True, read_only=True)

    class Meta:
        model = Place
        fields = [
            'place_idx', 'place_id', 'name', 'ko_name',
            'country', 'province', 'city', 'district',
            'types', 'address', 'latitude', 'longitude',
            'google_maps_uri', 'website_uri', 'phone',
            'rating', 'user_ratings_total',
            'photos', 'created_at', 'updated_at'
        ]
