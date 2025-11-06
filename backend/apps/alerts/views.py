from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import TripAlert
from .serializers import TripAlertSerializer


class TripAlertViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Trip Alert ViewSet
    - Get travel alerts by country
    """
    queryset = TripAlert.objects.all().select_related('country_code')
    serializer_class = TripAlertSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['country_code']
    ordering_fields = ['created_at']
    ordering = ['-created_at']

    @action(detail=False, methods=['get'], url_path='by-country/(?P<country_code>[^/.]+)')
    def by_country(self, request, country_code=None):
        """Get travel alert by country code"""
        alert = self.queryset.filter(country_code=country_code).first()
        if alert:
            serializer = self.get_serializer(alert)
            return Response(serializer.data)
        return Response({'detail': 'No alert found', 'level': '안전', 'country_code': country_code})
