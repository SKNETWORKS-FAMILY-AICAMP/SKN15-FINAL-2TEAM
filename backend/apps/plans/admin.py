from django.contrib import admin
from django.urls import path
from django.shortcuts import render, redirect
from django.contrib import messages
from django.utils.html import format_html
from .models import TripPlan, TripDay, TripItem, TripMember
from .models_youtube import YouTubeCrawlerJob


@admin.register(TripPlan)
class TripPlanAdmin(admin.ModelAdmin):
    """TripPlan admin configuration"""
    list_display = ('trip_idx', 'title', 'owner_user_idx', 'start_date', 'end_date',
                    'party_size', 'status', 'user_satisfaction', 'created_at')
    list_filter = ('status', 'user_satisfaction', 'created_at')
    search_fields = ('title', 'owner_user_idx__email', 'invite_code')
    date_hierarchy = 'created_at'
    ordering = ('-created_at',)

    fieldsets = (
        ('Basic Info', {
            'fields': ('title', 'owner_user_idx', 'status')
        }),
        ('Trip Details', {
            'fields': ('start_date', 'end_date', 'party_size', 'budget_currency', 'budget_amount')
        }),
        ('Location', {
            'fields': ('country_idx', 'region1_idx', 'region2_idx')
        }),
        ('Invite Code', {
            'fields': ('invite_code', 'invite_code_expires_at'),
            'classes': ('collapse',)
        }),
        ('User Feedback', {
            'fields': ('user_satisfaction',)
        }),
        ('Dates', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    readonly_fields = ('created_at', 'updated_at')


@admin.register(TripDay)
class TripDayAdmin(admin.ModelAdmin):
    """TripDay admin configuration"""
    list_display = ('day_idx', 'trip_idx', 'day_no', 'date')
    list_filter = ('date',)
    search_fields = ('trip_idx__title',)
    ordering = ('trip_idx', 'day_no')


@admin.register(TripItem)
class TripItemAdmin(admin.ModelAdmin):
    """TripItem admin configuration"""
    list_display = ('item_idx', 'day_idx', 'title', 'item_type', 'start_time',
                    'order_in_day', 'lock_flag')
    list_filter = ('item_type', 'lock_flag')
    search_fields = ('title', 'notes')
    ordering = ('day_idx', 'order_in_day')

    fieldsets = (
        ('Basic Info', {
            'fields': ('day_idx', 'item_type', 'title', 'place_idx')
        }),
        ('Time', {
            'fields': ('start_time', 'end_time')
        }),
        ('Details', {
            'fields': ('notes', 'estimated_cost', 'order_in_day', 'lock_flag')
        }),
    )


@admin.register(TripMember)
class TripMemberAdmin(admin.ModelAdmin):
    """TripMember admin configuration"""
    list_display = ('trip_member_idx', 'trip_idx', 'user_idx', 'role')
    list_filter = ('role',)
    search_fields = ('trip_idx__title', 'user_idx__email')
    ordering = ('trip_idx', 'role')


@admin.register(YouTubeCrawlerJob)
class YouTubeCrawlerJobAdmin(admin.ModelAdmin):
    """YouTube 크롤러 작업 관리"""
    list_display = ('job_idx', 'status_badge', 'total_urls', 'success_count',
                    'fail_count', 'progress', 'duration', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('file_path', 'error_message')
    readonly_fields = ('job_idx', 'created_by', 'file_path', 'total_urls',
                       'processed_count', 'success_count', 'fail_count',
                       'error_message', 'started_at', 'completed_at',
                       'created_at', 'updated_at', 'progress_bar')
    ordering = ('-created_at',)

    fieldsets = (
        ('작업 정보', {
            'fields': ('job_idx', 'status', 'created_by', 'file_path')
        }),
        ('진행 상황', {
            'fields': ('progress_bar', 'total_urls', 'processed_count',
                       'success_count', 'fail_count')
        }),
        ('시간', {
            'fields': ('started_at', 'completed_at', 'created_at', 'updated_at')
        }),
        ('오류', {
            'fields': ('error_message',),
            'classes': ('collapse',)
        }),
    )

    def status_badge(self, obj):
        """상태 배지"""
        colors = {
            'pending': '#6c757d',
            'processing': '#0d6efd',
            'completed': '#198754',
            'failed': '#dc3545'
        }
        color = colors.get(obj.status, '#6c757d')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; '
            'border-radius: 3px; font-weight: bold;">{}</span>',
            color, obj.get_status_display()
        )
    status_badge.short_description = '상태'

    def progress(self, obj):
        """진행률"""
        if obj.total_urls == 0:
            return '-'
        percent = obj.progress_percent
        return f"{percent}% ({obj.processed_count}/{obj.total_urls})"
    progress.short_description = '진행률'

    def progress_bar(self, obj):
        """진행률 바"""
        percent = obj.progress_percent
        color = '#198754' if obj.status == 'completed' else '#0d6efd'
        if obj.status == 'failed':
            color = '#dc3545'

        return format_html(
            '<div style="width: 100%; background-color: #e9ecef; border-radius: 5px;">'
            '<div style="width: {}%; background-color: {}; height: 25px; border-radius: 5px; '
            'text-align: center; color: white; line-height: 25px; font-weight: bold;">{}</div>'
            '</div>',
            percent, color, f"{percent}%"
        )
    progress_bar.short_description = '진행 상황'

    def duration(self, obj):
        """처리 시간"""
        seconds = obj.duration_seconds
        if not seconds:
            return '-'
        if seconds < 60:
            return f"{int(seconds)}초"
        elif seconds < 3600:
            return f"{int(seconds//60)}분 {int(seconds%60)}초"
        else:
            hours = int(seconds//3600)
            minutes = int((seconds%3600)//60)
            return f"{hours}시간 {minutes}분"
    duration.short_description = '소요 시간'

    def get_urls(self):
        """커스텀 URL 추가"""
        urls = super().get_urls()
        custom_urls = [
            path('youtube-crawler/', self.admin_site.admin_view(self.youtube_crawler_view),
                 name='youtube_crawler'),
            path('youtube-crawler/run/', self.admin_site.admin_view(self.run_crawler_view),
                 name='run_youtube_crawler'),
        ]
        return custom_urls + urls

    def youtube_crawler_view(self, request):
        """YouTube 크롤러 메인 페이지"""
        context = {
            **self.admin_site.each_context(request),
            'title': 'YouTube 여행 일정 크롤러',
            'jobs': YouTubeCrawlerJob.objects.all()[:20],
        }
        return render(request, 'admin/youtube_crawler.html', context)

    def run_crawler_view(self, request):
        """크롤러 실행"""
        if request.method == 'POST' and request.FILES.get('data_file'):
            import os
            from django.core.files.storage import default_storage
            from django.conf import settings

            # 파일 저장
            uploaded_file = request.FILES['data_file']
            file_path = default_storage.save(
                f'youtube_crawler/{uploaded_file.name}',
                uploaded_file
            )
            full_path = os.path.join(settings.MEDIA_ROOT, file_path)

            # Job 생성
            job = YouTubeCrawlerJob.objects.create(
                created_by=request.user,
                file_path=full_path,
                status='pending'
            )

            # 백그라운드 작업 시작 (쓰레드)
            import threading
            from .tasks import run_youtube_crawler_task
            thread = threading.Thread(
                target=run_youtube_crawler_task,
                args=(job.job_idx, full_path)
            )
            thread.daemon = True
            thread.start()

            messages.success(request, f'크롤링 작업이 시작되었습니다. (Job #{job.job_idx})')
            return redirect('admin:youtube_crawler')

        return redirect('admin:youtube_crawler')
