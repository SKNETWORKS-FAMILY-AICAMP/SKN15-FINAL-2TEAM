from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from .models import ChatRoom, ChatMessage
from .serializers import ChatRoomSerializer, ChatMessageSerializer


class ChatRoomViewSet(viewsets.ModelViewSet):
    serializer_class = ChatRoomSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ChatRoom.objects.filter(
            trip_idx__members__user_idx=self.request.user
        ).distinct()

    @action(detail=True, methods=['get'])
    def messages(self, request, pk=None):
        room = self.get_object()
        limit = int(request.query_params.get('limit', 50))
        offset = int(request.query_params.get('offset', 0))

        messages = room.messages.select_related('user_idx').order_by('-created_at')[offset:offset+limit]
        serializer = ChatMessageSerializer(messages, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def send_message(self, request, pk=None):
        room = self.get_object()
        content = request.data.get('content', '')
        msg_type = request.data.get('msg_type', 'text')

        if not content.strip():
            return Response(
                {'error': 'Message content cannot be empty'},
                status=status.HTTP_400_BAD_REQUEST
            )

        message = ChatMessage.objects.create(
            room_idx=room,
            user_idx=request.user,
            msg_type=msg_type,
            content=content
        )

        serializer = ChatMessageSerializer(message)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def create_for_trip(self, request):
        trip_id = request.data.get('trip_id')
        if not trip_id:
            return Response(
                {'error': 'trip_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from apps.plans.models import TripPlan
        trip = get_object_or_404(TripPlan, trip_idx=trip_id)

        if not trip.members.filter(user_idx=request.user).exists():
            return Response(
                {'error': 'You are not a member of this trip'},
                status=status.HTTP_403_FORBIDDEN
            )

        room, created = ChatRoom.objects.get_or_create(trip_idx=trip)
        serializer = self.get_serializer(room)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
