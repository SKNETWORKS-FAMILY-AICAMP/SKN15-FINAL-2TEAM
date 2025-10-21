from rest_framework import serializers
from .models import Place, Photo, PlaceCategory
from apps.common.models import Country, Region1, Region2


class CountrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Country
        fields = ['country_idx', 'country_name', 'iso2']


class Region1Serializer(serializers.ModelSerializer):
    class Meta:
        model = Region1
        fields = ['region1_idx', 'city_name']


class Region2Serializer(serializers.ModelSerializer):
    class Meta:
        model = Region2
        fields = ['region2_idx', 'region2_name']


class PhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Photo
        fields = ['photo_idx', 'is_primary', 'width', 'height',
                  'local_path', 'remote_uri', 'attributions']


class PlaceListSerializer(serializers.ModelSerializer):
    """Simplified serializer for list views"""
    country = serializers.CharField(source='country_idx.country_name', read_only=True)
    region1 = serializers.CharField(source='region1_idx.city_name', read_only=True)
    region2 = serializers.CharField(source='region2_idx.region2_name', read_only=True)

    class Meta:
        model = Place
        fields = [
            'place_idx', 'place_id', 'name', 'ko_name',
            'country', 'region1', 'region2',
            'address', 'latitude', 'longitude',
            'rating', 'user_ratings_total', 'types'
        ]


class PlaceDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer with all information"""
    country = CountrySerializer(source='country_idx', read_only=True)
    region1 = Region1Serializer(source='region1_idx', read_only=True)
    region2 = Region2Serializer(source='region2_idx', read_only=True)
    photos = PhotoSerializer(many=True, read_only=True)

    class Meta:
        model = Place
        fields = [
            'place_idx', 'place_id', 'name', 'ko_name',
            'country', 'region1', 'region2',
            'types', 'address', 'latitude', 'longitude',
            'google_maps_uri', 'website_uri', 'phone',
            'rating', 'user_ratings_total',
            'photos', 'created_at', 'updated_at'
        ]
