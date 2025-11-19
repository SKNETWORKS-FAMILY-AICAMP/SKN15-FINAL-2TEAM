from django.contrib import admin
from .models import ChatRoom, ChatMessage
from .models_performance import BotPerformanceLog, RAGTestLog


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


@admin.register(BotPerformanceLog)
class BotPerformanceLogAdmin(admin.ModelAdmin):
    """Bot Performance Log admin configuration"""
    list_display = ('created_at', 'tool_used', 'total_time', 'llm_time', 'rag_time', 'success', 'user')
    list_filter = ('success', 'tool_used', 'created_at')
    search_fields = ('user_message', 'tool_used', 'error_message')
    ordering = ('-created_at',)
    readonly_fields = ('created_at',)

    fieldsets = (
        ('Request Info', {
            'fields': ('user', 'room_idx', 'user_message', 'detected_intent', 'tool_used')
        }),
        ('Performance Metrics', {
            'fields': ('total_time', 'llm_time', 'tool_time', 'rag_time', 'db_time')
        }),
        ('Result', {
            'fields': ('success', 'error_message', 'response_length', 'metadata')
        }),
        ('Dates', {
            'fields': ('created_at',)
        }),
    )


@admin.register(RAGTestLog)
class RAGTestLogAdmin(admin.ModelAdmin):
    """RAG Test Log admin configuration"""
    list_display = ('created_at', 'query_short', 'results_count', 'search_time', 'total_time', 'success', 'user')
    list_filter = ('success', 'created_at')
    search_fields = ('query', 'error_message')
    ordering = ('-created_at',)
    readonly_fields = ('created_at',)

    fieldsets = (
        ('Test Info', {
            'fields': ('user', 'query', 'country_code', 'province_idx', 'top_k')
        }),
        ('Performance', {
            'fields': ('search_time', 'llm_refinement_time', 'total_time')
        }),
        ('Results', {
            'fields': ('success', 'results_count', 'rag_results', 'refined_plan', 'error_message')
        }),
        ('Dates', {
            'fields': ('created_at',)
        }),
    )

    def query_short(self, obj):
        return obj.query[:50] + '...' if len(obj.query) > 50 else obj.query
    query_short.short_description = 'Query'
