from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.db.models import Q
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

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

    def perform_destroy(self, instance):
        """Only owner can delete trip"""
        member = instance.members.filter(user_idx=self.request.user).first()
        if not member or member.role != 'owner':
            raise PermissionError('Only owner can delete trip')
        instance.delete()

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

        # Add user as viewer by default
        new_member = TripMember.objects.create(
            trip_idx=trip,
            user_idx=request.user,
            role='viewer'
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

        # Check if code is still valid
        if not trip.is_invite_code_valid():
            return Response(
                {'error': 'Invite code has expired'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if user has access to this trip
        is_member = trip.members.filter(user_idx=request.user).exists()

        if not is_member:
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


class TripDayViewSet(viewsets.ModelViewSet):
    """Trip Day ViewSet"""
    serializer_class = TripDaySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return TripDay.objects.filter(
            trip_idx__members__user_idx=self.request.user
        ).distinct()


class TripItemViewSet(viewsets.ModelViewSet):
    """Trip Item ViewSet"""
    serializer_class = TripItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return TripItem.objects.filter(
            day_idx__trip_idx__members__user_idx=self.request.user
        ).distinct()
