from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import ExchangeRate
from .serializers import ExchangeRateSerializer


class ExchangeRateViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Exchange Rate ViewSet
    - List all exchange rates
    - Get rate by currency code
    - Get rates by country
    """
    queryset = ExchangeRate.objects.all().select_related('country_code')
    serializer_class = ExchangeRateSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['currency_code', 'country_code', 'bank']
    search_fields = ['currency_code', 'country_code__country_name']
    ordering_fields = ['timestamp', 'currency_code']
    ordering = ['-timestamp']

    @action(detail=False, methods=['get'], url_path='by-country/(?P<country_code>[^/.]+)')
    def by_country(self, request, country_code=None):
        """Get exchange rates by country code"""
        rates = self.queryset.filter(country_code=country_code)
        serializer = self.get_serializer(rates, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='by-currency/(?P<currency_code>[^/.]+)')
    def by_currency(self, request, currency_code=None):
        """Get exchange rate by currency code"""
        rate = self.queryset.filter(currency_code=currency_code).first()
        if rate:
            serializer = self.get_serializer(rate)
            return Response(serializer.data)
        return Response({'detail': 'Not found'}, status=404)
