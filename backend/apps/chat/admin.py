from django.contrib import admin
from .models import ChatRoom, ChatMessage


@admin.register(ChatRoom)
class ChatRoomAdmin(admin.ModelAdmin):
    """ChatRoom admin configuration"""
    list_display = ('room_idx', 'trip_idx', 'title', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('title', 'trip_idx__title')
    ordering = ('-created_at',)


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    """ChatMessage admin configuration"""
    list_display = ('message_idx', 'room_idx', 'user_idx', 'msg_type', 'created_at')
    list_filter = ('msg_type', 'created_at')
    search_fields = ('content', 'user_idx__email')
    ordering = ('-created_at',)

    fieldsets = (
        ('Message Info', {
            'fields': ('room_idx', 'user_idx', 'msg_type', 'content', 'payload_json')
        }),
        ('Dates', {
            'fields': ('created_at',)
        }),
    )

    readonly_fields = ('created_at',)
