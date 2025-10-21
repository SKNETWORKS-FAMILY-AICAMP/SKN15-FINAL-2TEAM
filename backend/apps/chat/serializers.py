from rest_framework import serializers
from .models import ChatRoom, ChatMessage
from apps.accounts.models import User


class UserSimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['user_idx', 'email']


class ChatMessageSerializer(serializers.ModelSerializer):
    user = UserSimpleSerializer(source='user_idx', read_only=True)
    is_bot = serializers.SerializerMethodField()

    class Meta:
        model = ChatMessage
        fields = ['message_idx', 'user', 'is_bot', 'msg_type', 'content', 'payload_json', 'created_at']
        read_only_fields = ['message_idx', 'created_at']

    def get_is_bot(self, obj):
        return obj.user_idx is None


class ChatRoomSerializer(serializers.ModelSerializer):
    latest_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = ChatRoom
        fields = ['room_idx', 'trip_idx', 'created_at', 'latest_message', 'unread_count']
        read_only_fields = ['room_idx', 'created_at']

    def get_latest_message(self, obj):
        latest = obj.messages.order_by('-created_at').first()
        if latest:
            return ChatMessageSerializer(latest).data
        return None

    def get_unread_count(self, obj):
        return 0
