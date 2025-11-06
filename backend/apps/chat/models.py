from django.db import models
from apps.accounts.models import User
from apps.plans.models import TripPlan


class ChatRoom(models.Model):
    """
    Chat room model - represents a chat room associated with a trip plan.
    Maps to the chat_rooms table in the database.
    """

    room_idx = models.AutoField(primary_key=True, db_column='room_idx')
    trip_idx = models.ForeignKey(
        TripPlan,
        on_delete=models.CASCADE,
        db_column='trip_idx',
        related_name='chat_rooms'
    )
    title = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'chat_rooms'
        verbose_name = 'Chat Room'
        verbose_name_plural = 'Chat Rooms'
        ordering = ['-created_at']

    def __str__(self):
        return f"Chat Room {self.room_idx} - {self.title or self.trip_idx.title}"


class ChatMessage(models.Model):
    """
    Chat message model - represents a message in a chat room.
    Maps to the chat_messages table in the database.
    """

    MSG_TYPE_CHOICES = [
        ('text', 'Text'),
        ('system', 'System'),
        ('card', 'Card'),
        ('recommendation', 'Recommendation'),
    ]

    message_idx = models.AutoField(primary_key=True, db_column='message_idx')
    room_idx = models.ForeignKey(
        ChatRoom,
        on_delete=models.CASCADE,
        db_column='room_idx',
        related_name='messages'
    )
    user_idx = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='user_idx',
        related_name='chat_messages'
    )
    msg_type = models.TextField(
        choices=MSG_TYPE_CHOICES,
        default='text'
    )
    content = models.TextField(null=True, blank=True)
    payload_json = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'chat_messages'
        verbose_name = 'Chat Message'
        verbose_name_plural = 'Chat Messages'
        ordering = ['created_at']
        constraints = [
            models.CheckConstraint(
                check=models.Q(msg_type__in=['text', 'system', 'card', 'recommendation']),
                name='chat_messages_msg_type_check'
            ),
        ]

    def __str__(self):
        user_display = self.user_idx.email if self.user_idx else 'System'
        return f"{self.msg_type} message from {user_display} in Room {self.room_idx.room_idx}"


class ChatRequest(models.Model):
    """
    Chat request log model - stores full-text chat requests for analysis and logging.
    챗봇 요청사항 전체 텍스트를 저장하는 모델.
    """

    request_idx = models.AutoField(primary_key=True, db_column='request_idx')
    room_idx = models.ForeignKey(
        ChatRoom,
        on_delete=models.CASCADE,
        db_column='room_idx',
        related_name='requests'
    )
    user_idx = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='user_idx',
        related_name='chat_requests'
    )
    trip_idx = models.ForeignKey(
        TripPlan,
        on_delete=models.CASCADE,
        db_column='trip_idx',
        related_name='chat_requests',
        help_text='Associated trip for quick filtering'
    )

    # 요청 정보
    user_message = models.TextField(help_text='User input message (full text)')
    agent_response = models.TextField(null=True, blank=True, help_text='Agent response (full text)')

    # Agent 메타데이터
    tools_used = models.JSONField(
        null=True,
        blank=True,
        help_text='List of tools used by agent (e.g., ["get_planner_info", "add_place_to_day"])'
    )
    execution_time_ms = models.IntegerField(
        null=True,
        blank=True,
        help_text='Agent execution time in milliseconds'
    )

    # 분류 및 태깅
    request_type = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        help_text='Request type (e.g., "add_place", "search", "recommend")'
    )
    success = models.BooleanField(
        default=True,
        help_text='Whether the request was successfully processed'
    )
    error_message = models.TextField(
        null=True,
        blank=True,
        help_text='Error message if request failed'
    )

    # 시스템 필드
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'chat_requests'
        verbose_name = 'Chat Request'
        verbose_name_plural = 'Chat Requests'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['room_idx', '-created_at']),
            models.Index(fields=['user_idx', '-created_at']),
            models.Index(fields=['trip_idx', '-created_at']),
            models.Index(fields=['request_type']),
            models.Index(fields=['success']),
        ]

    def __str__(self):
        user_display = self.user_idx.email if self.user_idx else 'Anonymous'
        return f"Request {self.request_idx} from {user_display} ({self.request_type or 'general'})"
