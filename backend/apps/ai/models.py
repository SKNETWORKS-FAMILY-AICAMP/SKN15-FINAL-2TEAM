from django.db import models
from django.contrib.postgres.fields import ArrayField
from pgvector.django import VectorField
from apps.plans.models import TripPlan
from apps.chat.models import ChatRoom, ChatMessage
from apps.accounts.models import User


class RecEvent(models.Model):
    """
    Recommendation event model - stores AI recommendation events.
    Maps to the rec_events table in the database.
    """

    rec_event_idx = models.AutoField(primary_key=True, db_column='rec_event_idx')
    trip_idx = models.ForeignKey(
        TripPlan,
        on_delete=models.CASCADE,
        db_column='trip_idx',
        related_name='rec_events'
    )
    room_idx = models.ForeignKey(
        ChatRoom,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='room_idx',
        related_name='rec_events'
    )
    message_idx = models.ForeignKey(
        ChatMessage,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='message_idx',
        related_name='rec_events'
    )
    algo = models.TextField()
    request_ctx = models.JSONField(null=True, blank=True)
    candidates = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'rec_events'
        verbose_name = 'Recommendation Event'
        verbose_name_plural = 'Recommendation Events'

    def __str__(self):
        return f"RecEvent {self.rec_event_idx} - {self.algo} for Trip {self.trip_idx.trip_idx}"


class RecApplied(models.Model):
    """
    Applied recommendation model - tracks which recommendations were applied by users.
    Maps to the rec_applied table in the database.
    """

    rec_applied_idx = models.AutoField(primary_key=True, db_column='rec_applied_idx')
    rec_event_idx = models.ForeignKey(
        RecEvent,
        on_delete=models.CASCADE,
        db_column='rec_event_idx',
        related_name='applied_recommendations'
    )
    applied_item = models.JSONField(null=True, blank=True)
    applied_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='applied_by',
        related_name='applied_recommendations'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'rec_applied'
        verbose_name = 'Applied Recommendation'
        verbose_name_plural = 'Applied Recommendations'

    def __str__(self):
        user_email = self.applied_by.email if self.applied_by else 'Unknown'
        return f"Applied Rec {self.rec_applied_idx} by {user_email}"


class TripCourseEmbedding(models.Model):
    """
    Trip course embeddings for RAG-based recommendation system.
    Stores YouTube travel vlogs with vector embeddings for semantic search.
    Integrates with existing Country and Region tables.
    """

    video_id = models.CharField(max_length=50, unique=True, db_index=True)

    # Basic metadata
    title = models.TextField()
    channel = models.CharField(max_length=255, null=True, blank=True)
    url = models.TextField(null=True, blank=True)

    # Location info - FK to existing tables
    country_name = models.CharField(max_length=100, null=True, blank=True)  # Denormalized for search
    country_code = models.ForeignKey(
        'common.Country',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='country_code',
        to_field='country_code',
        related_name='vlogs'
    )
    region1_idx = models.ForeignKey(
        'common.Region1',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='region1_idx',
        related_name='vlogs',
        help_text='City level'
    )
    region2_idx = models.ForeignKey(
        'common.Region2',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='region2_idx',
        related_name='vlogs',
        help_text='District level'
    )

    # Upload info
    upload_year = models.IntegerField(null=True, blank=True)
    upload_month = models.IntegerField(null=True, blank=True)
    views_num = models.IntegerField(null=True, blank=True)

    # Vector embedding - 핵심! (통합 임베딩 하나만)
    content_embedding = VectorField(dimensions=1536, null=True, blank=True)

    # Original data stored as JSON
    metadata = models.JSONField(
        null=True,
        blank=True,
        help_text='Stores all original data: description, ko, en, schedules, etc.'
    )

    # System fields
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'trip_course_embeddings'
        verbose_name = 'Trip Course Embedding'
        verbose_name_plural = 'Trip Course Embeddings'
        indexes = [
            models.Index(fields=['country_code', 'region1_idx']),
            models.Index(fields=['upload_year', 'upload_month']),
            models.Index(fields=['-views_num']),
        ]

    def __str__(self):
        location = f"{self.country_name}"
        if self.region1_idx:
            location += f" - {self.region1_idx.city_name}"
        return f"{self.title} ({location})"
