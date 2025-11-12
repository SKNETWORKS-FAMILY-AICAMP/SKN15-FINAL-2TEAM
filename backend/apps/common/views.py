"""
Common views for health check and other utilities
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status, viewsets
from django.db import connection
from django.conf import settings

from .models import Country, Province, City, District, PlacesCategory, CountryElectric
from .serializers import (
    CountrySerializer,
    ProvinceSerializer,
    CitySerializer,
    DistrictSerializer,
    PlacesCategorySerializer,
    CountryElectricSerializer
)


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """
    Health check endpoint for monitoring
    """
    try:
        # Check database connection
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")

        return Response({
            'status': 'healthy',
            'database': 'connected'
        }, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({
            'status': 'unhealthy',
            'error': str(e)
        }, status=status.HTTP_503_SERVICE_UNAVAILABLE)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_frontend_config(request):
    """
    Get frontend configuration including API keys
    """
    return Response({
        'kakaoMapApiKey': settings.KAKAO_MAP_API_KEY,
    }, status=status.HTTP_200_OK)


class CountryViewSet(viewsets.ReadOnlyModelViewSet):
    """Country ViewSet - Read only"""
    queryset = Country.objects.all()
    serializer_class = CountrySerializer
    permission_classes = [AllowAny]


class PlacesCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """Places Category ViewSet - Read only"""
    queryset = PlacesCategory.objects.all()
    serializer_class = PlacesCategorySerializer
    permission_classes = [AllowAny]


class CountryElectricViewSet(viewsets.ReadOnlyModelViewSet):
    """Country Electric Info ViewSet - Read only"""
    queryset = CountryElectric.objects.filter(use_yn='Y')
    serializer_class = CountryElectricSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        queryset = super().get_queryset()
        # Filter by country_name if provided
        country_name = self.request.query_params.get('country_name', None)
        if country_name:
            queryset = queryset.filter(country_name__icontains=country_name)
        return queryset


class ProvinceViewSet(viewsets.ReadOnlyModelViewSet):
    """Province (시/도) ViewSet - Read only"""
    queryset = Province.objects.all()
    serializer_class = ProvinceSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        queryset = super().get_queryset()
        # Filter by country if provided
        country_id = self.request.query_params.get('country', None)
        if country_id:
            queryset = queryset.filter(country_id=country_id)
        return queryset


class CityViewSet(viewsets.ReadOnlyModelViewSet):
    """City (시/군/구) ViewSet - Read only"""
    queryset = City.objects.all()
    serializer_class = CitySerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        queryset = super().get_queryset()
        # Filter by province if provided
        province_id = self.request.query_params.get('province', None)
        if province_id:
            queryset = queryset.filter(province_id=province_id)
        return queryset


class DistrictViewSet(viewsets.ReadOnlyModelViewSet):
    """District (읍/면/동) ViewSet - Read only"""
    queryset = District.objects.all()
    serializer_class = DistrictSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        queryset = super().get_queryset()
        # Filter by city if provided
        city_id = self.request.query_params.get('city', None)
        if city_id:
            queryset = queryset.filter(city_id=city_id)
        return queryset
