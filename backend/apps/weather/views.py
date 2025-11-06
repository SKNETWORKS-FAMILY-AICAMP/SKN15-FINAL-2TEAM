from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from datetime import datetime, timedelta
from .models import WeatherDaily, WeatherMonthly
from .serializers import WeatherDailySerializer, WeatherMonthlySerializer


class WeatherDailyViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Daily Weather ViewSet
    - Get weather by city and date range
    """
    queryset = WeatherDaily.objects.all().select_related('country_code', 'city_code')
    serializer_class = WeatherDailySerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['city_code', 'country_code', 'forecast_date']
    ordering_fields = ['forecast_date']
    ordering = ['forecast_date']

    @action(detail=False, methods=['get'], url_path='by-city/(?P<city_code>[^/.]+)')
    def by_city(self, request, city_code=None):
        """Get weather forecast for a city (next 7 days)"""
        today = datetime.now().date()
        end_date = today + timedelta(days=7)
        
        weather = self.queryset.filter(
            city_code=city_code,
            forecast_date__gte=today,
            forecast_date__lte=end_date
        )
        serializer = self.get_serializer(weather, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='by-date-range')
    def by_date_range(self, request):
        """Get weather by city and date range"""
        city_code = request.query_params.get('city_code')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        if not all([city_code, start_date, end_date]):
            return Response({'error': 'city_code, start_date, end_date required'}, status=400)

        weather = self.queryset.filter(
            city_code=city_code,
            forecast_date__gte=start_date,
            forecast_date__lte=end_date
        )
        serializer = self.get_serializer(weather, many=True)
        return Response(serializer.data)


class WeatherMonthlyViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Monthly Weather ViewSet
    - Get monthly climate statistics
    """
    queryset = WeatherMonthly.objects.all().select_related('country_code', 'city_code')
    serializer_class = WeatherMonthlySerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['city_code', 'country_code', 'month']
    ordering_fields = ['month']
    ordering = ['month']

    @action(detail=False, methods=['get'], url_path='by-city/(?P<city_code>[^/.]+)')
    def by_city(self, request, city_code=None):
        """Get monthly weather statistics for a city"""
        weather = self.queryset.filter(city_code=city_code)
        serializer = self.get_serializer(weather, many=True)
        return Response(serializer.data)
