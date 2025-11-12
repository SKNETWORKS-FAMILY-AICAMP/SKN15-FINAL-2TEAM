from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django_filters.rest_framework import DjangoFilterBackend
from datetime import datetime, timedelta
from .models import WeatherDaily, WeatherMonthly
from .serializers import WeatherDailySerializer, WeatherMonthlySerializer


class WeatherDailyViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Daily Weather ViewSet
    - Get weather by district/city/province and date range
    """
    permission_classes = [AllowAny]
    queryset = WeatherDaily.objects.all().select_related(
        'country_code', 'province_idx', 'city_idx', 'district_idx'
    )
    serializer_class = WeatherDailySerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['province_idx', 'city_idx', 'district_idx', 'country_code', 'forecast_date']
    ordering_fields = ['forecast_date']
    ordering = ['forecast_date']

    @action(detail=False, methods=['get'], url_path='by-district/(?P<district_idx>[^/.]+)')
    def by_district(self, request, district_idx=None):
        """Get weather forecast for a district"""
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        if not start_date:
            start_date = datetime.now().date()
        if not end_date:
            end_date = datetime.now().date() + timedelta(days=10)

        weather = self.queryset.filter(
            district_idx=district_idx,
            forecast_date__gte=start_date,
            forecast_date__lte=end_date
        )
        serializer = self.get_serializer(weather, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='by-city/(?P<city_idx>[^/.]+)')
    def by_city(self, request, city_idx=None):
        """Get weather forecast for a city"""
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        if not start_date:
            start_date = datetime.now().date()
        if not end_date:
            end_date = datetime.now().date() + timedelta(days=10)

        # Get first district's weather for the city
        weather = self.queryset.filter(
            city_idx=city_idx,
            forecast_date__gte=start_date,
            forecast_date__lte=end_date
        ).order_by('forecast_date', 'district_idx').distinct('forecast_date')[:11]

        serializer = self.get_serializer(weather, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='by-province/(?P<province_idx>[^/.]+)')
    def by_province(self, request, province_idx=None):
        """Get weather forecast for a province"""
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        if not start_date:
            start_date = datetime.now().date()
        if not end_date:
            end_date = datetime.now().date() + timedelta(days=10)

        # Get first city/district's weather for the province
        weather = self.queryset.filter(
            province_idx=province_idx,
            forecast_date__gte=start_date,
            forecast_date__lte=end_date
        ).order_by('forecast_date', 'city_idx', 'district_idx').distinct('forecast_date')[:11]

        serializer = self.get_serializer(weather, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='by-location')
    def by_location(self, request):
        """Get weather by location (province/city/district) and date range"""
        province_idx = request.query_params.get('province_idx')
        city_idx = request.query_params.get('city_idx')
        district_idx = request.query_params.get('district_idx')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        if not start_date:
            start_date = datetime.now().date()
        if not end_date:
            end_date = datetime.now().date() + timedelta(days=10)

        # 가장 구체적인 위치부터 필터링
        queryset = self.queryset.filter(
            forecast_date__gte=start_date,
            forecast_date__lte=end_date
        )

        if district_idx:
            queryset = queryset.filter(district_idx=district_idx)
        elif city_idx:
            queryset = queryset.filter(city_idx=city_idx).order_by('forecast_date', 'district_idx').distinct('forecast_date')[:11]
        elif province_idx:
            queryset = queryset.filter(province_idx=province_idx).order_by('forecast_date', 'city_idx', 'district_idx').distinct('forecast_date')[:11]
        else:
            return Response({'error': 'At least one of province_idx, city_idx, or district_idx required'}, status=400)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class WeatherMonthlyViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Monthly Weather ViewSet
    - Get monthly climate statistics
    """
    permission_classes = [AllowAny]
    queryset = WeatherMonthly.objects.all().select_related('country_code', 'province_idx')
    serializer_class = WeatherMonthlySerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['province_idx', 'country_code', 'month']
    ordering_fields = ['month']
    ordering = ['month']

    @action(detail=False, methods=['get'], url_path='by-province/(?P<province_idx>[^/.]+)')
    def by_province(self, request, province_idx=None):
        """Get monthly weather statistics for a province"""
        weather = self.queryset.filter(province_idx=province_idx)
        serializer = self.get_serializer(weather, many=True)
        return Response(serializer.data)
