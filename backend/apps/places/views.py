from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from django.db.models import Q
from .models import Place, Photo
from .serializers import PlaceListSerializer, PlaceDetailSerializer, PhotoSerializer


class PlaceViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for places
    
    list: Get all places with optional search/filter
    retrieve: Get detailed information about a specific place
    search: Search places by keyword
    nearby: Get places near a specific location
    """
    queryset = Place.objects.select_related(
        'country_idx', 'region1_idx', 'region2_idx'
    ).all()
    permission_classes = [IsAuthenticatedOrReadOnly]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'ko_name', 'address', 'types']
    ordering_fields = ['rating', 'user_ratings_total', 'created_at']
    ordering = ['-rating', '-user_ratings_total']

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return PlaceDetailSerializer
        return PlaceListSerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by region
        region1 = self.request.query_params.get('region1', None)
        region2 = self.request.query_params.get('region2', None)
        country = self.request.query_params.get('country', None)

        if country:
            queryset = queryset.filter(country_idx__country_name__icontains=country)
        
        if region1:
            queryset = queryset.filter(region1_idx__city_name__icontains=region1)

        if region2:
            queryset = queryset.filter(region2_idx__region2_name__icontains=region2)

        # Filter by types
        place_type = self.request.query_params.get('type', None)
        if place_type:
            queryset = queryset.filter(types__icontains=place_type)

        # Filter by rating
        min_rating = self.request.query_params.get('min_rating', None)
        if min_rating:
            queryset = queryset.filter(rating__gte=float(min_rating))

        return queryset

    @action(detail=False, methods=['get'])
    def search(self, request):
        """
        Search places by keyword
        GET /api/places/search/?q=keyword
        """
        keyword = request.query_params.get('q', '')
        
        if not keyword:
            return Response(
                {'error': 'Keyword is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        places = self.get_queryset().filter(
            Q(name__icontains=keyword) |
            Q(ko_name__icontains=keyword) |
            Q(address__icontains=keyword) |
            Q(types__icontains=keyword)
        )[:20]  # Limit to 20 results

        serializer = self.get_serializer(places, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def nearby(self, request):
        """
        Get places near a specific location
        GET /api/places/nearby/?lat=37.5&lng=127.0&radius=5
        """
        lat = request.query_params.get('lat', None)
        lng = request.query_params.get('lng', None)
        radius = request.query_params.get('radius', 5)  # km

        if not lat or not lng:
            return Response(
                {'error': 'Latitude and longitude are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            lat = float(lat)
            lng = float(lng)
            radius = float(radius)
        except ValueError:
            return Response(
                {'error': 'Invalid coordinates or radius'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Simple bounding box search (for better performance)
        # 1 degree latitude ≈ 111 km
        # 1 degree longitude ≈ 88 km (at latitude 37°)
        lat_delta = radius / 111.0
        lng_delta = radius / 88.0

        places = self.get_queryset().filter(
            latitude__gte=lat - lat_delta,
            latitude__lte=lat + lat_delta,
            longitude__gte=lng - lng_delta,
            longitude__lte=lng + lng_delta
        )[:50]

        serializer = self.get_serializer(places, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def popular(self, request):
        """
        Get popular places (high rating and many reviews)
        GET /api/places/popular/?limit=10
        """
        limit = int(request.query_params.get('limit', 10))
        
        places = self.get_queryset().filter(
            rating__gte=4.0,
            user_ratings_total__gte=100
        ).order_by('-user_ratings_total', '-rating')[:limit]

        serializer = self.get_serializer(places, many=True)
        return Response(serializer.data)


class PhotoViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for place photos
    """
    queryset = Photo.objects.all()
    serializer_class = PhotoSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        
        place_id = self.request.query_params.get('place_id', None)
        if place_id:
            queryset = queryset.filter(place_idx__place_id=place_id)

        return queryset
