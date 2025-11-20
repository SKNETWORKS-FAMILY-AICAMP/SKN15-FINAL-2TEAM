"""
YouTube 크롤러 작업 관리 모델
"""
from django.db import models
from django.utils import timezone
from apps.accounts.models import User


class YouTubeCrawlerJob(models.Model):
    """YouTube 크롤링 작업 기록"""

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    job_idx = models.AutoField(primary_key=True, db_column='job_idx')
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        db_column='created_by',
        related_name='youtube_jobs'
    )
    file_path = models.TextField(help_text='업로드된 data.txt 파일 경로')
    location = models.CharField(max_length=200, null=True, blank=True, help_text='처리 중인 지역명')
    total_urls = models.IntegerField(default=0, help_text='총 URL 개수')
    processed_count = models.IntegerField(default=0, help_text='처리 완료 개수')
    success_count = models.IntegerField(default=0, help_text='성공 개수')
    fail_count = models.IntegerField(default=0, help_text='실패 개수')
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )
    error_message = models.TextField(null=True, blank=True, help_text='에러 메시지')
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'youtube_crawler_jobs'
        verbose_name = 'YouTube 크롤링 작업'
        verbose_name_plural = 'YouTube 크롤링 작업 목록'
        ordering = ['-created_at']

    def __str__(self):
        return f"Job #{self.job_idx} - {self.status} ({self.success_count}/{self.total_urls})"

    @property
    def progress_percent(self):
        """진행률 계산"""
        if self.total_urls == 0:
            return 0
        return int((self.processed_count / self.total_urls) * 100)

    @property
    def duration_seconds(self):
        """처리 시간 계산 (초)"""
        if not self.started_at:
            return None
        end_time = self.completed_at or timezone.now()
        return (end_time - self.started_at).total_seconds()
