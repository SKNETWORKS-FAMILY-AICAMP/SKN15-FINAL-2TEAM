"""
YouTube 크롤러 API Views
"""
import os
import threading
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser
from django.core.files.storage import default_storage
from django.conf import settings
from django.db.models import Q

from .models_youtube import YouTubeCrawlerJob
from .tasks import run_youtube_crawler_task
from apps.ai.models import TripCourseEmbedding


class YouTubeCrawlerJobViewSet(viewsets.ModelViewSet):
    """
    YouTube 크롤러 작업 관리 API

    list: 모든 작업 목록 조회
    retrieve: 특정 작업 상세 조회
    create: 새 크롤링 작업 생성 (파일 업로드)
    """
    queryset = YouTubeCrawlerJob.objects.all().order_by('-created_at')
    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser, FormParser]

    def get_serializer_class(self):
        # Serializer 없이 dict로 반환
        return None

    def list(self, request):
        """모든 크롤링 작업 목록"""
        jobs = self.queryset[:50]  # 최근 50개만

        data = [{
            'job_idx': job.job_idx,
            'status': job.status,
            'location': job.location,
            'total_urls': job.total_urls,
            'processed_count': job.processed_count,
            'success_count': job.success_count,
            'fail_count': job.fail_count,
            'progress_percent': job.progress_percent,
            'error_message': job.error_message,
            'started_at': job.started_at.isoformat() if job.started_at else None,
            'completed_at': job.completed_at.isoformat() if job.completed_at else None,
            'created_at': job.created_at.isoformat(),
            'updated_at': job.updated_at.isoformat(),
            'duration_seconds': job.duration_seconds,
            'created_by': job.created_by.email if job.created_by else None,
        } for job in jobs]

        return Response({
            'success': True,
            'jobs': data
        })

    def retrieve(self, request, pk=None):
        """특정 작업 상세 조회"""
        try:
            job = YouTubeCrawlerJob.objects.get(job_idx=pk)

            data = {
                'job_idx': job.job_idx,
                'status': job.status,
                'file_path': job.file_path,
                'total_urls': job.total_urls,
                'processed_count': job.processed_count,
                'success_count': job.success_count,
                'fail_count': job.fail_count,
                'progress_percent': job.progress_percent,
                'error_message': job.error_message,
                'started_at': job.started_at.isoformat() if job.started_at else None,
                'completed_at': job.completed_at.isoformat() if job.completed_at else None,
                'created_at': job.created_at.isoformat(),
                'updated_at': job.updated_at.isoformat(),
                'duration_seconds': job.duration_seconds,
                'created_by': job.created_by.email if job.created_by else None,
            }

            return Response({
                'success': True,
                'job': data
            })
        except YouTubeCrawlerJob.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Job not found'
            }, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['post'])
    def upload(self, request):
        """
        파일 업로드 및 크롤링 작업 생성

        POST /api/youtube-crawler/upload/
        Content-Type: multipart/form-data
        Body: {data_file: File}
        """
        if 'data_file' not in request.FILES:
            return Response({
                'success': False,
                'error': 'data_file is required'
            }, status=status.HTTP_400_BAD_REQUEST)

        uploaded_file = request.FILES['data_file']

        # 파일 확장자 검증
        if not uploaded_file.name.endswith('.txt'):
            return Response({
                'success': False,
                'error': 'Only .txt files are allowed'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 파일 저장
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

        # 백그라운드 작업 시작
        thread = threading.Thread(
            target=run_youtube_crawler_task,
            args=(job.job_idx, full_path)
        )
        thread.daemon = True
        thread.start()

        return Response({
            'success': True,
            'message': f'크롤링 작업이 시작되었습니다. (Job #{job.job_idx})',
            'job': {
                'job_idx': job.job_idx,
                'status': job.status,
                'created_at': job.created_at.isoformat(),
            }
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """
        작업 중지

        POST /api/youtube-crawler/{job_idx}/cancel/
        """
        try:
            from django.utils import timezone

            job = YouTubeCrawlerJob.objects.get(job_idx=pk)

            if job.status not in ['pending', 'processing']:
                return Response({
                    'success': False,
                    'error': f'Cannot cancel job with status: {job.status}'
                }, status=status.HTTP_400_BAD_REQUEST)

            job.status = 'failed'
            job.error_message = 'User cancelled'
            job.completed_at = timezone.now()
            job.save()

            return Response({
                'success': True,
                'message': f'Job #{job.job_idx} cancelled successfully'
            })

        except YouTubeCrawlerJob.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Job not found'
            }, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def collected_data(self, request):
        """
        크롤링된 데이터 조회 (trip_course_embeddings)
        누구나 조회 가능 (인증 불필요)

        GET /api/youtube-crawler/collected_data/
        Query params:
            - location: 지역명 검색 (옵션)
            - page: 페이지 번호 (기본 1)
            - page_size: 페이지당 개수 (기본 20, 최대 100)
        """
        location_query = request.query_params.get('location', '').strip()
        page = int(request.query_params.get('page', 1))
        page_size = min(int(request.query_params.get('page_size', 20)), 100)

        # 기본 쿼리
        queryset = TripCourseEmbedding.objects.all().order_by('-created_at')

        # 지역 필터링 (country, province, city, district에서 검색)
        if location_query:
            queryset = queryset.filter(
                Q(country_code__country_name__icontains=location_query) |
                Q(province_idx__name__icontains=location_query) |
                Q(city_idx__name__icontains=location_query) |
                Q(district_idx__name__icontains=location_query)
            )

        # 전체 개수
        total_count = queryset.count()

        # 페이징
        start = (page - 1) * page_size
        end = start + page_size
        items = queryset[start:end]

        # 데이터 변환
        data = []
        for item in items:
            # 위치 정보 조합
            location_parts = []
            if item.country_code:
                location_parts.append(item.country_code.country_name)
            if item.province_idx:
                location_parts.append(item.province_idx.name)
            if item.city_idx:
                location_parts.append(item.city_idx.name)
            if item.district_idx:
                location_parts.append(item.district_idx.name)

            location_str = ' > '.join(location_parts) if location_parts else '-'

            data.append({
                'id': item.id,
                'video_id': item.video_id,
                'title': item.title,
                'channel': item.channel,
                'url': item.url,
                'location': location_str,
                'country': item.country_code.country_name if item.country_code else None,
                'province': item.province_idx.name if item.province_idx else None,
                'city': item.city_idx.name if item.city_idx else None,
                'district': item.district_idx.name if item.district_idx else None,
                'upload_year': item.upload_year,
                'upload_month': item.upload_month,
                'views': item.views_num,
                'has_parsed_data': bool(item.parsed_itinerary),
                'created_at': item.created_at.isoformat(),
            })

        return Response({
            'success': True,
            'data': data,
            'pagination': {
                'total': total_count,
                'page': page,
                'page_size': page_size,
                'total_pages': (total_count + page_size - 1) // page_size,
            }
        })
