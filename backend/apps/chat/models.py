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
