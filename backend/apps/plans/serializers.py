from rest_framework import serializers
from .models import TripPlan, TripDay, TripItem, TripMember
from apps.accounts.models import User


class TripMemberSerializer(serializers.ModelSerializer):
    """Trip Member Serializer"""
    email = serializers.EmailField(source='user_idx.email', read_only=True)

    class Meta:
        model = TripMember
        fields = ['trip_member_idx', 'user_idx', 'email', 'role']
        read_only_fields = ['trip_member_idx']


class TripItemSerializer(serializers.ModelSerializer):
    """Trip Item Serializer"""

    class Meta:
        model = TripItem
        fields = [
            'item_idx', 'day_idx', 'item_type', 'place_idx',
            'title', 'start_time', 'end_time', 'estimated_cost',
            'lock_flag', 'notes', 'order_in_day', 'created_at', 'updated_at'
        ]
        read_only_fields = ['item_idx', 'created_at', 'updated_at']


class TripDaySerializer(serializers.ModelSerializer):
    """Trip Day Serializer"""
    items = TripItemSerializer(many=True, read_only=True)

    class Meta:
        model = TripDay
        fields = ['day_idx', 'trip_idx', 'day_no', 'date', 'items']
        read_only_fields = ['day_idx']


class TripPlanSerializer(serializers.ModelSerializer):
    """Trip Plan Serializer"""
    days = TripDaySerializer(many=True, read_only=True)
    members = TripMemberSerializer(many=True, read_only=True)
    owner_email = serializers.EmailField(source='owner_user_idx.email', read_only=True)
    member_count = serializers.SerializerMethodField()
    country_name = serializers.CharField(source='country_idx.country_name', read_only=True)
    region1_name = serializers.CharField(source='region1_idx.region1_name', read_only=True)
    region2_name = serializers.CharField(source='region2_idx.region2_name', read_only=True)

    class Meta:
        model = TripPlan
        fields = [
            'trip_idx', 'owner_user_idx', 'owner_email', 'title',
            'country_idx', 'region1_idx', 'region2_idx',
            'country_name', 'region1_name', 'region2_name',
            'start_date', 'end_date', 'party_size',
            'budget_currency', 'budget_amount', 'status',
            'invite_code', 'invite_code_expires_at', 'user_satisfaction',
            'created_at', 'updated_at', 'days', 'members', 'member_count'
        ]
        read_only_fields = ['trip_idx', 'created_at', 'updated_at', 'owner_user_idx', 'invite_code', 'invite_code_expires_at']

    def get_member_count(self, obj):
        """Get member count"""
        return obj.members.count()

    def create(self, validated_data):
        """Create trip and add owner as member"""
        from datetime import timedelta

        user = self.context['request'].user
        validated_data['owner_user_idx'] = user

        trip = super().create(validated_data)

        # Generate invite code automatically
        trip.generate_invite_code(expiry_hours=168)  # 7 days expiry

        # Add owner as member
        TripMember.objects.create(
            trip_idx=trip,
            user_idx=user,
            role='owner'
        )

        # Auto-create TripDay entries based on start_date and end_date
        if trip.start_date and trip.end_date:
            current_date = trip.start_date
            day_number = 1

            while current_date <= trip.end_date:
                TripDay.objects.create(
                    trip_idx=trip,
                    day_no=day_number,
                    date=current_date
                )
                current_date += timedelta(days=1)
                day_number += 1

        return trip


class TripPlanListSerializer(serializers.ModelSerializer):
    """Trip Plan List Serializer"""
    owner_email = serializers.EmailField(source='owner_user_idx.email', read_only=True)
    member_count = serializers.SerializerMethodField()
    my_role = serializers.SerializerMethodField()

    class Meta:
        model = TripPlan
        fields = [
            'trip_idx', 'owner_user_idx', 'owner_email', 'title',
            'start_date', 'end_date', 'status',
            'invite_code', 'invite_code_expires_at', 'user_satisfaction',
            'member_count', 'my_role', 'created_at'
        ]

    def get_member_count(self, obj):
        return obj.members.count()

    def get_my_role(self, obj):
        """Get current user's role"""
        user = self.context['request'].user
        member = obj.members.filter(user_idx=user).first()
        return member.role if member else None
