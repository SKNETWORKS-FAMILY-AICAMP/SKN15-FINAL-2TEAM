"""
Admin-only views for chat performance monitoring and RAG testing
"""
import time
import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser
from django.db.models import Avg, Count, Sum, Q
from django.utils import timezone
from datetime import timedelta

from .models_performance import BotPerformanceLog, RAGTestLog
from .serializers_admin import (
    BotPerformanceLogSerializer,
    RAGTestLogSerializer,
    PerformanceStatsSerializer,
    RAGTestRequestSerializer
)

logger = logging.getLogger(__name__)


class BotPerformanceViewSet(viewsets.ReadOnlyModelViewSet):
    """봇 성능 로그 조회 (관리자 전용)"""
    queryset = BotPerformanceLog.objects.all()
    serializer_class = BotPerformanceLogSerializer
    permission_classes = [IsAdminUser]

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """성능 통계 조회"""
        # 기간 필터 (기본: 최근 7일)
        days = int(request.query_params.get('days', 7))
        since = timezone.now() - timedelta(days=days)

        logs = BotPerformanceLog.objects.filter(created_at__gte=since)

        # 전체 통계
        total_stats = logs.aggregate(
            total_requests=Count('id'),
            avg_total_time=Avg('total_time'),
            avg_llm_time=Avg('llm_time'),
            avg_rag_time=Avg('rag_time'),
            success_count=Count('id', filter=Q(success=True)),
            error_count=Count('id', filter=Q(success=False)),
        )

        # 도구별 통계
        tool_stats = logs.values('tool_used').annotate(
            count=Count('id'),
            avg_time=Avg('total_time'),
            success_rate=Count('id', filter=Q(success=True)) * 100.0 / Count('id')
        ).order_by('-count')

        # 시간대별 통계 (시간당 요청 수)
        hourly_stats = []
        for hour in range(24):
            hour_logs = logs.filter(created_at__hour=hour)
            hourly_stats.append({
                'hour': hour,
                'count': hour_logs.count(),
                'avg_time': hour_logs.aggregate(Avg('total_time'))['total_time__avg'] or 0
            })

        # 최근 느린 요청 (top 10)
        slow_requests = logs.order_by('-total_time')[:10].values(
            'created_at', 'user_message', 'tool_used', 'total_time', 'success'
        )

        return Response({
            'period': f'Last {days} days',
            'total_stats': total_stats,
            'tool_stats': list(tool_stats),
            'hourly_stats': hourly_stats,
            'slow_requests': list(slow_requests),
        })


class RAGTestViewSet(viewsets.ModelViewSet):
    """RAG 테스트 및 로그 (관리자 전용)"""
    queryset = RAGTestLog.objects.all()
    serializer_class = RAGTestLogSerializer
    permission_classes = [IsAdminUser]

    @action(detail=False, methods=['post'])
    def test_rag(self, request):
        """RAG 시스템 테스트 실행"""
        serializer = RAGTestRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        query = serializer.validated_data['query']
        country_code = serializer.validated_data.get('country_code')
        province_idx = serializer.validated_data.get('province_idx')
        top_k = serializer.validated_data.get('top_k', 3)
        use_llm = serializer.validated_data.get('use_llm', True)

        try:
            from apps.ai.rag import get_rag
            from langchain_openai import ChatOpenAI
            import json

            start_time = time.time()

            # Step 1: RAG 검색
            rag = get_rag()
            search_start = time.time()
            rag_results = rag.search_similar_trips(
                query=query,
                country_code=country_code,
                province_idx=province_idx,
                limit=top_k
            )
            search_time = time.time() - search_start

            logger.info(f"✅ RAG search completed: {len(rag_results)} results in {search_time:.2f}s")

            # Step 2: LLM 정제 (선택적)
            refined_plan = None
            llm_refinement_time = None

            if use_llm and rag_results:
                # RAG 결과를 텍스트로 변환
                rag_summary = []
                for idx, result in enumerate(rag_results, 1):
                    rag_summary.append(f"\n🎯 추천 여행 {idx}: {result['title']} (유사도: {int(result['similarity_score']*100)}%)")
                    if result['schedules']:
                        for day_idx, places in enumerate(result['schedules'], 1):
                            if isinstance(places, list) and places:
                                rag_summary.append(f"  Day {day_idx}: {' → '.join(places)}")

                refinement_prompt = f"""당신은 여행 플래너 전문가입니다.

사용자 요청: {query}

RAG 검색 결과 (실제 여행자들의 경로):
{''.join(rag_summary)}

**임무**: 위 RAG 결과를 분석하여 3일 일정으로 정리하세요.

**필수 규칙**:
1. day_1, day_2, day_3만 생성
2. 각 Day당 4-6개 장소 (아침식사, 오전관광, 점심식사, 오후관광, 저녁식사, 숙박 포함)
3. 장소명은 정확하고 구체적으로
4. 시간은 09:00(아침) → 11:00(관광) → 13:00(점심) → 15:00(관광) → 18:00(저녁) → 20:00(숙박) 형식

**출력 형식** (반드시 JSON, 3일만):
{{
  "day_1": [
    {{"place": "장소명", "time": "09:00", "reason": "추천 이유"}},
    ...
  ],
  "day_2": [...],
  "day_3": [...]
}}

JSON만 출력하세요. 설명이나 다른 텍스트는 금지입니다.
"""

                llm_start = time.time()
                llm = ChatOpenAI(model="gpt-4o", temperature=0.7)
                llm_response = llm.invoke(refinement_prompt)
                refined_text = llm_response.content.strip()

                # JSON 추출
                if '```json' in refined_text:
                    refined_text = refined_text.split('```json')[1].split('```')[0].strip()
                elif '```' in refined_text:
                    refined_text = refined_text.split('```')[1].split('```')[0].strip()

                try:
                    refined_plan = json.loads(refined_text)
                    llm_refinement_time = time.time() - llm_start
                    logger.info(f"✅ LLM refinement completed in {llm_refinement_time:.2f}s")
                except json.JSONDecodeError as e:
                    logger.error(f"❌ LLM JSON parse error: {e}\nRaw response: {refined_text[:500]}")
                    refined_plan = None

            total_time = time.time() - start_time

            # 🆕 유사도 통계 계산
            similarity_scores = [r['similarity_score'] for r in rag_results if 'similarity_score' in r]
            avg_similarity = sum(similarity_scores) / len(similarity_scores) if similarity_scores else None
            min_similarity = min(similarity_scores) if similarity_scores else None
            max_similarity = max(similarity_scores) if similarity_scores else None

            # 표준편차 계산
            similarity_std_dev = None
            if similarity_scores and len(similarity_scores) > 1:
                mean = avg_similarity
                variance = sum((x - mean) ** 2 for x in similarity_scores) / len(similarity_scores)
                similarity_std_dev = variance ** 0.5

            # 로그 저장
            log = RAGTestLog.objects.create(
                user=request.user,
                query=query,
                country_code=country_code,
                province_idx=province_idx,
                top_k=top_k,
                search_time=search_time,
                llm_refinement_time=llm_refinement_time,
                total_time=total_time,
                results_count=len(rag_results),
                rag_results=rag_results,
                refined_plan=refined_plan,
                avg_similarity_score=avg_similarity,
                min_similarity_score=min_similarity,
                max_similarity_score=max_similarity,
                similarity_std_dev=similarity_std_dev,
                success=True
            )

            return Response({
                'log_id': log.id,
                'query': query,
                'search_time': search_time,
                'llm_refinement_time': llm_refinement_time,
                'total_time': total_time,
                'results_count': len(rag_results),
                'rag_results': rag_results,
                'refined_plan': refined_plan,
                # 🆕 유사도 통계
                'avg_similarity_score': avg_similarity,
                'min_similarity_score': min_similarity,
                'max_similarity_score': max_similarity,
                'similarity_std_dev': similarity_std_dev,
            })

        except Exception as e:
            logger.error(f"❌ RAG test failed: {e}", exc_info=True)

            # 에러 로그 저장
            RAGTestLog.objects.create(
                user=request.user,
                query=query,
                country_code=country_code,
                province_idx=province_idx,
                top_k=top_k,
                search_time=0,
                total_time=time.time() - start_time,
                results_count=0,
                success=False,
                error_message=str(e)
            )

            return Response({
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """RAG 테스트 통계"""
        days = int(request.query_params.get('days', 7))
        since = timezone.now() - timedelta(days=days)

        logs = RAGTestLog.objects.filter(created_at__gte=since)

        stats = logs.aggregate(
            total_tests=Count('id'),
            avg_search_time=Avg('search_time'),
            avg_llm_time=Avg('llm_refinement_time'),
            avg_total_time=Avg('total_time'),
            avg_results=Avg('results_count'),
            success_count=Count('id', filter=Q(success=True)),
            error_count=Count('id', filter=Q(success=False)),
            # 🆕 유사도 통계
            avg_similarity=Avg('avg_similarity_score'),
            min_similarity=Avg('min_similarity_score'),
            max_similarity=Avg('max_similarity_score'),
            avg_std_dev=Avg('similarity_std_dev'),
        )

        # 최근 테스트
        recent_tests = logs.order_by('-created_at')[:10].values(
            'created_at', 'query', 'results_count', 'total_time', 'success'
        )

        return Response({
            'period': f'Last {days} days',
            'stats': stats,
            'recent_tests': list(recent_tests),
        })
