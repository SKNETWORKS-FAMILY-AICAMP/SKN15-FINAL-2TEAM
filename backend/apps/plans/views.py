from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django.shortcuts import get_object_or_404
from django.db.models import Q, Count, Avg, F
from django.db.models.functions import TruncDate
from django.utils import timezone
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from datetime import timedelta

from .models import TripPlan, TripDay, TripItem, TripMember
from .serializers import (
    TripPlanSerializer,
    TripPlanListSerializer,
    TripDaySerializer,
    TripItemSerializer,
    TripMemberSerializer
)
from apps.accounts.models import User
from apps.chat.models import ChatRoom, ChatMessage


class TripPlanViewSet(viewsets.ModelViewSet):
    """Trip Plan ViewSet"""
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Get trips for current user"""
        return TripPlan.objects.filter(
            members__user_idx=self.request.user
        ).distinct().select_related(
            'owner_user_idx'
        ).prefetch_related(
            'members__user_idx',
            'days__items'
        ).order_by('-created_at')  # Most recent trips first

    def get_serializer_class(self):
        """Return appropriate serializer"""
        if self.action == 'list':
            return TripPlanListSerializer
        return TripPlanSerializer

    def perform_update(self, serializer):
        """Update trip and broadcast to all members"""
        instance = serializer.save()

        # Broadcast planner update to all connected users via WebSocket
        self._broadcast_planner_update(
            trip=instance,
            update_type='trip',
            message=f'{self.request.user.email}님이 여행 정보를 수정했습니다.'
        )

        return instance

    def perform_destroy(self, instance):
        """Only owner can delete trip"""
        member = instance.members.filter(user_idx=self.request.user).first()
        if not member or member.role != 'owner':
            raise PermissionError('Only owner can delete trip')
        instance.delete()

    def _broadcast_planner_update(self, trip, update_type='trip', message=None):
        """Helper method to broadcast planner updates via WebSocket"""
        try:
            # Get the chat room for this trip
            chat_room = ChatRoom.objects.filter(trip_idx=trip).first()
            if not chat_room:
                return

            channel_layer = get_channel_layer()
            room_group_name = f'trip_chat_{chat_room.room_idx}'

            # Broadcast to all connected users
            async_to_sync(channel_layer.group_send)(
                room_group_name,
                {
                    'type': 'planner_updated',
                    'updated_by': self.request.user.email,
                    'update_type': update_type,
                    'trip_idx': trip.trip_idx,
                    'message': message or '플래너가 업데이트되었습니다.'
                }
            )
        except Exception as e:
            # Log error but don't fail the request
            print(f"Failed to broadcast planner update: {e}")

    @action(detail=True, methods=['post'])
    def invite(self, request, pk=None):
        """Invite member to trip"""
        trip = self.get_object()
        email = request.data.get('email')
        role = request.data.get('role', 'editor')

        if not email:
            return Response(
                {'error': 'Email is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check permission
        my_membership = trip.members.filter(user_idx=request.user).first()
        if not my_membership or my_membership.role not in ['owner', 'editor']:
            return Response(
                {'error': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Find user by email
        try:
            invitee = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {'error': f'User not found: {email}'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Cannot invite self
        if invitee == request.user:
            return Response(
                {'error': 'Cannot invite yourself'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if already member
        if trip.members.filter(user_idx=invitee).exists():
            return Response(
                {'error': f'{email} is already a member'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate role
        valid_roles = ['owner', 'editor', 'commenter', 'viewer']
        if role not in valid_roles:
            return Response(
                {'error': f'Invalid role. Must be one of: {valid_roles}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Cannot assign owner role
        if role == 'owner':
            return Response(
                {'error': 'Cannot assign owner role'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create member
        new_member = TripMember.objects.create(
            trip_idx=trip,
            user_idx=invitee,
            role=role
        )

        # Send system message and WebSocket notification
        try:
            room = ChatRoom.objects.get(trip_idx=trip)
            system_message = ChatMessage.objects.create(
                room_idx=room,
                user_idx=None,
                msg_type='system',
                content=f'{invitee.email}님이 {request.user.email}님의 초대로 참여했습니다. 환영합니다!'
            )

            # Send WebSocket notification to all connected users
            channel_layer = get_channel_layer()
            room_group_name = f'trip_chat_{room.room_idx}'

            # Broadcast member added event
            async_to_sync(channel_layer.group_send)(
                room_group_name,
                {
                    'type': 'member_added',
                    'member': {
                        'user_idx': invitee.user_idx,
                        'email': invitee.email,
                        'role': role
                    },
                    'invited_by': request.user.email
                }
            )

            # Broadcast system message
            async_to_sync(channel_layer.group_send)(
                room_group_name,
                {
                    'type': 'chat_message',
                    'message': {
                        'message_idx': system_message.message_idx,
                        'user_idx': None,
                        'content': system_message.content,
                        'msg_type': 'system',
                        'created_at': system_message.created_at.isoformat()
                    }
                }
            )
        except ChatRoom.DoesNotExist:
            room = ChatRoom.objects.create(
                trip_idx=trip,
                title=f'{trip.title} Chat'
            )

        return Response({
            'success': True,
            'message': f'{invitee.email} invited successfully',
            'member': TripMemberSerializer(new_member).data
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def generate_invite_code(self, request, pk=None):
        """Generate invite code for trip"""
        trip = self.get_object()

        # Check permission (owner or editor can generate invite code)
        member = trip.members.filter(user_idx=request.user).first()
        if not member or member.role not in ['owner', 'editor']:
            return Response(
                {'error': 'Only owners and editors can generate invite codes'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Generate code (24 hour expiry by default)
        expiry_hours = request.data.get('expiry_hours', 24)
        code = trip.generate_invite_code(expiry_hours=expiry_hours)

        return Response({
            'invite_code': code,
            'expires_at': trip.invite_code_expires_at,
            'trip_id': trip.trip_idx,
            'trip_title': trip.title
        })

    @action(detail=False, methods=['post'])
    def join_by_code(self, request):
        """Join trip using invite code"""
        code = request.data.get('invite_code', '').strip().upper()

        if not code:
            return Response(
                {'error': 'Invite code is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Find trip by invite code
        try:
            trip = TripPlan.objects.get(invite_code=code)
        except TripPlan.DoesNotExist:
            return Response(
                {'error': 'Invalid invite code'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check if code is still valid
        if not trip.is_invite_code_valid():
            return Response(
                {'error': 'Invite code has expired'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if user is already a member
        existing_member = trip.members.filter(user_idx=request.user).first()
        if existing_member:
            return Response({
                'success': True,
                'message': 'You are already a member of this trip',
                'trip_id': trip.trip_idx,
                'trip_title': trip.title,
                'member': TripMemberSerializer(existing_member).data
            })

        # Add user as viewer by default (use get_or_create to handle race conditions)
        try:
            new_member, created = TripMember.objects.get_or_create(
                trip_idx=trip,
                user_idx=request.user,
                defaults={'role': 'viewer'}
            )

            if not created:
                # Already exists (race condition)
                return Response({
                    'success': True,
                    'message': 'You are already a member of this trip',
                    'trip_id': trip.trip_idx,
                    'trip_title': trip.title,
                    'member': TripMemberSerializer(new_member).data
                })
        except Exception as e:
            return Response(
                {'error': f'Failed to join trip: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # Send system message and WebSocket notification
        try:
            room = ChatRoom.objects.get(trip_idx=trip)
            system_message = ChatMessage.objects.create(
                room_idx=room,
                user_idx=None,
                msg_type='system',
                content=f'{request.user.email}님이 초대 코드로 여행에 참여했습니다. 환영합니다!'
            )

            # Send WebSocket notification to all connected users
            channel_layer = get_channel_layer()
            room_group_name = f'trip_chat_{room.room_idx}'

            # Broadcast member added event
            async_to_sync(channel_layer.group_send)(
                room_group_name,
                {
                    'type': 'member_added',
                    'member': {
                        'user_idx': request.user.user_idx,
                        'email': request.user.email,
                        'role': 'viewer'
                    },
                    'invited_by': 'Invite Code'
                }
            )

            # Broadcast system message
            async_to_sync(channel_layer.group_send)(
                room_group_name,
                {
                    'type': 'chat_message',
                    'message': {
                        'message_idx': system_message.message_idx,
                        'user_idx': None,
                        'content': system_message.content,
                        'msg_type': 'system',
                        'created_at': system_message.created_at.isoformat()
                    }
                }
            )
        except ChatRoom.DoesNotExist:
            pass

        return Response({
            'success': True,
            'message': 'Successfully joined trip',
            'trip_id': trip.trip_idx,
            'trip_title': trip.title,
            'member': TripMemberSerializer(new_member).data
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def members(self, request, pk=None):
        """Get trip members"""
        trip = self.get_object()
        members = trip.members.select_related('user_idx').all()
        serializer = TripMemberSerializer(members, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='by-code/(?P<invite_code>[^/.]+)')
    def get_by_invite_code(self, request, invite_code=None):
        """Get trip by invite code"""
        if not invite_code:
            return Response(
                {'error': 'Invite code is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Find trip by invite code
        try:
            trip = TripPlan.objects.get(invite_code=invite_code.upper())
        except TripPlan.DoesNotExist:
            return Response(
                {'error': 'Invalid invite code'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check if user is a member first
        is_member = trip.members.filter(user_idx=request.user).exists()

        # If not a member, check if invite code is still valid
        if not is_member:
            if not trip.is_invite_code_valid():
                return Response(
                    {'error': 'Invite code has expired'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            return Response(
                {'error': 'You are not a member of this trip. Please join using the invite code first.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Return trip data
        serializer = TripPlanSerializer(trip)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def remove_member(self, request, pk=None):
        """Remove member from trip"""
        trip = self.get_object()
        user_idx_to_remove = request.data.get('user_idx')

        if not user_idx_to_remove:
            return Response(
                {'error': 'user_idx is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Only owner can remove members
        my_membership = trip.members.filter(user_idx=request.user).first()
        if not my_membership or my_membership.role != 'owner':
            return Response(
                {'error': 'Only owner can remove members'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Find member to remove
        member_to_remove = trip.members.filter(
            user_idx__user_idx=user_idx_to_remove
        ).first()

        if not member_to_remove:
            return Response(
                {'error': 'Member not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Cannot remove owner
        if member_to_remove.role == 'owner':
            return Response(
                {'error': 'Cannot remove owner'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Use leave action for self-removal
        if member_to_remove.user_idx == request.user:
            return Response(
                {'error': 'Use leave action to remove yourself'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Remove member
        removed_email = member_to_remove.user_idx.email
        member_to_remove.delete()

        # Send system message
        try:
            room = ChatRoom.objects.get(trip_idx=trip)
            ChatMessage.objects.create(
                room_idx=room,
                user_idx=None,
                msg_type='system',
                content=f'{removed_email} was removed from the trip.'
            )
        except ChatRoom.DoesNotExist:
            pass

        return Response({
            'success': True,
            'message': f'{removed_email} removed successfully'
        })

    @action(detail=True, methods=['post'])
    def leave(self, request, pk=None):
        """Leave trip"""
        trip = self.get_object()

        my_membership = trip.members.filter(user_idx=request.user).first()
        if not my_membership:
            return Response(
                {'error': 'You are not a member of this trip'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Owner cannot leave
        if my_membership.role == 'owner':
            return Response(
                {'error': 'Owner cannot leave. Transfer ownership first.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Leave trip
        my_email = request.user.email
        my_membership.delete()

        # Send system message
        try:
            room = ChatRoom.objects.get(trip_idx=trip)
            ChatMessage.objects.create(
                room_idx=room,
                user_idx=None,
                msg_type='system',
                content=f'{my_email} left the trip.'
            )
        except ChatRoom.DoesNotExist:
            pass

        return Response({
            'success': True,
            'message': 'Left trip successfully'
        })

    @action(detail=True, methods=['post'])
    def update_role(self, request, pk=None):
        """Update member role"""
        trip = self.get_object()
        user_idx = request.data.get('user_idx')
        new_role = request.data.get('role')

        # Only owner can update roles
        my_membership = trip.members.filter(user_idx=request.user).first()
        if not my_membership or my_membership.role != 'owner':
            return Response(
                {'error': 'Only owner can update roles'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Find target member
        target_member = trip.members.filter(user_idx__user_idx=user_idx).first()
        if not target_member:
            return Response(
                {'error': 'Member not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Cannot change owner role
        if target_member.role == 'owner':
            return Response(
                {'error': 'Cannot change owner role'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate new role
        valid_roles = ['editor', 'commenter', 'viewer']
        if new_role not in valid_roles:
            return Response(
                {'error': f'Invalid role. Must be one of: {valid_roles}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update role
        old_role = target_member.role
        target_member.role = new_role
        target_member.save()

        return Response({
            'success': True,
            'message': f'{target_member.user_idx.email} role changed from {old_role} to {new_role}',
            'member': TripMemberSerializer(target_member).data
        })

    @action(detail=True, methods=['post'])
    def submit_satisfaction(self, request, pk=None):
        """Submit user satisfaction feedback"""
        trip = self.get_object()
        satisfaction = request.data.get('satisfaction')

        # Validate satisfaction value
        if satisfaction not in ['like', 'dislike']:
            return Response(
                {'error': 'Invalid satisfaction value. Must be "like" or "dislike"'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update trip satisfaction
        trip.user_satisfaction = satisfaction
        trip.save(update_fields=['user_satisfaction', 'updated_at'])

        return Response({
            'success': True,
            'message': 'Satisfaction feedback submitted successfully',
            'satisfaction': satisfaction
        })

    @action(detail=True, methods=['get'], url_path='weather-by-days')
    def weather_by_days(self, request, pk=None):
        """
        Get weather for each day based on the first item's location
        각 일차의 첫 번째 일정 위치를 기준으로 날씨 가져오기
        """
        from apps.weather.models import WeatherDaily
        from apps.places.models import Place

        trip = self.get_object()

        # Get all days with their items
        days = trip.days.prefetch_related(
            'items__place_idx__province_idx',
            'items__place_idx__city_idx',
            'items__place_idx__district_idx'
        ).order_by('day_no')

        result = []

        for day in days:
            # Get first item (place_idx 유무 상관없이)
            first_item = day.items.order_by('order_in_day').first()

            weather_data = None
            location_info = None

            # 일정이 있으면 주소를 파싱해서 날씨 조회
            if first_item and first_item.notes:
                from apps.common.address_parser import parse_korean_address

                # notes에서 주소 추출 (📍 이모지 뒤의 주소)
                address = first_item.notes
                if '📍' in address:
                    address = address.split('📍')[1].split('\n')[0].strip()

                # 주소 파싱
                parsed = parse_korean_address(address)
                if parsed['district'] or parsed['city'] or parsed['province']:
                    location_info = {
                        'district_idx': parsed['district'],
                        'city_idx': parsed['city'],
                        'province_idx': parsed['province'],
                        'district_name': parsed['district'].name if parsed['district'] else None,
                        'city_name': parsed['city'].name if parsed['city'] else None,
                        'province_name': parsed['province'].name if parsed['province'] else None,
                    }

            # Fetch weather using location hierarchy (district > city > province)
            if location_info:
                try:
                    weather_query = WeatherDaily.objects.filter(forecast_date=day.date)

                    if location_info['district_idx']:
                        weather = weather_query.filter(district_idx=location_info['district_idx']).first()
                    elif location_info['city_idx']:
                        weather = weather_query.filter(city_idx=location_info['city_idx']).first()
                    elif location_info['province_idx']:
                        weather = weather_query.filter(province_idx=location_info['province_idx']).first()
                    else:
                        weather = None

                    if weather:
                        weather_data = {
                            'weather_daily_idx': weather.weather_daily_idx,
                            'forecast_date': str(weather.forecast_date),
                            'weather_am': weather.weather_am,
                            'weather_pm': weather.weather_pm,
                            'temp_min_c': float(weather.temp_min_c) if weather.temp_min_c else None,
                            'temp_max_c': float(weather.temp_max_c) if weather.temp_max_c else None,
                            'precipitation_am': weather.precipitation_am,
                            'precipitation_pm': weather.precipitation_pm,
                            'location': {
                                'province': location_info['province_name'],
                                'city': location_info['city_name'],
                                'district': location_info['district_name'],
                            }
                        }
                except Exception as e:
                    print(f"Error fetching weather for day {day.day_no}: {e}")

            result.append({
                'day_no': day.day_no,
                'date': str(day.date),
                'weather': weather_data,
                'first_place': first_item.title if first_item else None
            })

        return Response({
            'success': True,
            'trip_idx': trip.trip_idx,
            'days': result
        })


class TripDayViewSet(viewsets.ModelViewSet):
    """Trip Day ViewSet"""
    serializer_class = TripDaySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = TripDay.objects.filter(
            trip_idx__members__user_idx=self.request.user
        ).distinct()

        # Filter by trip_idx if provided in query params
        trip_idx = self.request.query_params.get('trip_idx', None)
        if trip_idx is not None:
            queryset = queryset.filter(trip_idx=trip_idx)

        return queryset

    def perform_create(self, serializer):
        """Create day and broadcast update"""
        instance = serializer.save()
        self._broadcast_planner_update(instance.trip_idx, 'day', f'{self.request.user.email}님이 Day를 추가했습니다.')

    def perform_update(self, serializer):
        """Update day and broadcast update"""
        instance = serializer.save()
        self._broadcast_planner_update(instance.trip_idx, 'day', f'{self.request.user.email}님이 Day를 수정했습니다.')

    def perform_destroy(self, instance):
        """Delete day and broadcast update"""
        trip = instance.trip_idx
        instance.delete()
        self._broadcast_planner_update(trip, 'day', f'{self.request.user.email}님이 Day를 삭제했습니다.')

    def _broadcast_planner_update(self, trip, update_type, message):
        """Broadcast planner update"""
        try:
            chat_room = ChatRoom.objects.filter(trip_idx=trip).first()
            if not chat_room:
                return

            channel_layer = get_channel_layer()
            room_group_name = f'trip_chat_{chat_room.room_idx}'

            async_to_sync(channel_layer.group_send)(
                room_group_name,
                {
                    'type': 'planner_updated',
                    'updated_by': self.request.user.email,
                    'update_type': update_type,
                    'trip_idx': trip.trip_idx,
                    'message': message
                }
            )
        except Exception as e:
            print(f"Failed to broadcast planner update: {e}")


class TripItemViewSet(viewsets.ModelViewSet):
    """Trip Item ViewSet"""
    serializer_class = TripItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = TripItem.objects.filter(
            day_idx__trip_idx__members__user_idx=self.request.user
        ).distinct()

        # Filter by day_idx if provided in query params
        day_idx = self.request.query_params.get('day_idx', None)
        if day_idx is not None:
            queryset = queryset.filter(day_idx=day_idx)

        return queryset

    def perform_create(self, serializer):
        """Create item and broadcast update"""
        instance = serializer.save()
        self._broadcast_planner_update(instance.day_idx.trip_idx, 'item', f'{self.request.user.email}님이 일정을 추가했습니다.')

    def perform_update(self, serializer):
        """Update item and broadcast update"""
        instance = serializer.save()
        self._broadcast_planner_update(instance.day_idx.trip_idx, 'item', f'{self.request.user.email}님이 일정을 수정했습니다.')

    def perform_destroy(self, instance):
        """Delete item and broadcast update"""
        trip = instance.day_idx.trip_idx
        instance.delete()
        self._broadcast_planner_update(trip, 'item', f'{self.request.user.email}님이 일정을 삭제했습니다.')

    def _broadcast_planner_update(self, trip, update_type, message):
        """Broadcast planner update"""
        try:
            chat_room = ChatRoom.objects.filter(trip_idx=trip).first()
            if not chat_room:
                return

            channel_layer = get_channel_layer()
            room_group_name = f'trip_chat_{chat_room.room_idx}'

            async_to_sync(channel_layer.group_send)(
                room_group_name,
                {
                    'type': 'planner_updated',
                    'updated_by': self.request.user.email,
                    'update_type': update_type,
                    'trip_idx': trip.trip_idx,
                    'message': message
                }
            )
        except Exception as e:
            print(f"Failed to broadcast planner update: {e}")


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_statistics(request):
    """
    관리자 대시보드용 통계 API (관리자 권한 필요)
    - 전체 여행 통계
    - 만족도 분석
    - 시간대별 생성 추이
    - 인기 목적지
    """
    try:
        # 기본 통계
        total_trips = TripPlan.objects.count()
        total_users = User.objects.filter(status='active').count()

        # 만족도 통계
        satisfaction_stats = TripPlan.objects.aggregate(
            total_like=Count('trip_idx', filter=Q(user_satisfaction='like')),
            total_dislike=Count('trip_idx', filter=Q(user_satisfaction='dislike')),
            total_none=Count('trip_idx', filter=Q(user_satisfaction__isnull=True))
        )

        # 최근 30일간 일별 생성 통계
        thirty_days_ago = timezone.now() - timedelta(days=30)
        daily_stats = (
            TripPlan.objects
            .filter(created_at__gte=thirty_days_ago)
            .annotate(date=TruncDate('created_at'))
            .values('date')
            .annotate(count=Count('trip_idx'))
            .order_by('date')
        )

        # 최근 30일간 일별 만족도 통계
        satisfaction_trend = (
            TripPlan.objects
            .filter(created_at__gte=thirty_days_ago, user_satisfaction__isnull=False)
            .annotate(date=TruncDate('created_at'))
            .values('date', 'user_satisfaction')
            .annotate(count=Count('trip_idx'))
            .order_by('date')
        )

        # 만족도 트렌드 데이터 재구성
        satisfaction_by_date = {}
        for item in satisfaction_trend:
            date_str = item['date'].isoformat()
            if date_str not in satisfaction_by_date:
                satisfaction_by_date[date_str] = {'date': date_str, 'like': 0, 'dislike': 0}

            if item['user_satisfaction'] == 'like':
                satisfaction_by_date[date_str]['like'] = item['count']
            elif item['user_satisfaction'] == 'dislike':
                satisfaction_by_date[date_str]['dislike'] = item['count']

        # 여행 통계
        trip_stats = TripPlan.objects.aggregate(
            avg_duration=Avg(F('end_date') - F('start_date')),
            avg_party_size=Avg('party_size'),
            avg_budget=Avg('budget_amount')
        )

        # 평균 여행 기간 (일수로 변환)
        avg_duration_days = None
        if trip_stats['avg_duration']:
            avg_duration_days = trip_stats['avg_duration'].days

        # 최근 여행 목록
        recent_trips = TripPlan.objects.select_related('owner_user_idx').order_by('-created_at')[:20]
        recent_trips_data = []
        for trip in recent_trips:
            recent_trips_data.append({
                'trip_idx': trip.trip_idx,
                'title': trip.title,
                'start_date': trip.start_date,
                'end_date': trip.end_date,
                'party_size': trip.party_size,
                'budget': trip.budget_amount,
                'user_satisfaction': trip.user_satisfaction,
                'status': trip.status,
                'created_at': trip.created_at,
                'owner_email': trip.owner_user_idx.email if trip.owner_user_idx else None,
            })

        # 인기 여행 스타일 (예산 구간별)
        budget_distribution = TripPlan.objects.filter(budget_amount__isnull=False).extra(
            select={
                'budget_range': """
                    CASE
                        WHEN budget_amount < 500000 THEN '50만원 미만'
                        WHEN budget_amount < 1000000 THEN '50만원-100만원'
                        WHEN budget_amount < 2000000 THEN '100만원-200만원'
                        WHEN budget_amount < 3000000 THEN '200만원-300만원'
                        ELSE '300만원 이상'
                    END
                """
            }
        ).values('budget_range').annotate(count=Count('trip_idx')).order_by('-count')

        # 여행 인원 분포
        party_distribution = TripPlan.objects.filter(party_size__isnull=False).values('party_size').annotate(
            count=Count('trip_idx')
        ).order_by('party_size')

        return Response({
            'success': True,
            'total_trips': total_trips,
            'total_users': total_users,
            'satisfaction': {
                'like': satisfaction_stats['total_like'],
                'dislike': satisfaction_stats['total_dislike'],
                'none': satisfaction_stats['total_none'],
                'rate': (satisfaction_stats['total_like'] / total_trips * 100) if total_trips > 0 else 0
            },
            'daily_creation': list(daily_stats),
            'satisfaction_trend': list(satisfaction_by_date.values()),
            'trip_stats': {
                'avg_duration_days': avg_duration_days,
                'avg_party_size': float(trip_stats['avg_party_size']) if trip_stats['avg_party_size'] else 0,
                'avg_budget': float(trip_stats['avg_budget']) if trip_stats['avg_budget'] else 0,
            },
            'budget_distribution': list(budget_distribution),
            'party_distribution': list(party_distribution),
            'recent_trips': recent_trips_data,
        })

    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
