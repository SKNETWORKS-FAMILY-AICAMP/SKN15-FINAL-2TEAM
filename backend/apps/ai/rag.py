"""
RAG (Retrieval-Augmented Generation) System for Travel Recommendations
여행 경로 임베딩을 활용한 검색 증강 생성 시스템
"""

from typing import List, Dict, Optional
import openai
from django.conf import settings
from django.db.models import Q
import logging

from apps.ai.models import TripCourseEmbedding
from apps.common.models import Country, Region1

logger = logging.getLogger(__name__)


class TripRAG:
    """여행 경로 RAG 시스템"""

    def __init__(self):
        """OpenAI 클라이언트 초기화"""
        openai.api_key = settings.OPENAI_API_KEY

    def create_query_embedding(self, query: str) -> List[float]:
        """
        쿼리 텍스트를 벡터 임베딩으로 변환

        Args:
            query: 검색 쿼리 (예: "서울 3박4일 여행", "제주도 가족 여행")

        Returns:
            1536차원 임베딩 벡터
        """
        try:
            response = openai.embeddings.create(
                model="text-embedding-ada-002",
                input=query
            )
            embedding = response.data[0].embedding
            logger.info(f"✅ Created embedding for query: '{query[:50]}...'")
            return embedding
        except Exception as e:
            logger.error(f"❌ Failed to create embedding: {e}")
            raise

    def search_similar_trips(
        self,
        query: str,
        country_code: Optional[int] = None,
        region1_idx: Optional[int] = None,
        limit: int = 5,
        min_views: int = 1000
    ) -> List[Dict]:
        """
        벡터 유사도 검색으로 비슷한 여행 경로 찾기

        Args:
            query: 검색 쿼리 (예: "서울 맛집 투어", "제주도 자연 여행")
            country_code: 국가 필터 (선택)
            region1_idx: 도시 필터 (선택)
            limit: 반환할 결과 수
            min_views: 최소 조회수 (인기 영상 필터)

        Returns:
            유사한 여행 경로 리스트 (제목, URL, 스케줄, 거리 등)
        """
        try:
            # 1. 쿼리 임베딩 생성
            query_embedding = self.create_query_embedding(query)

            # 2. 필터 조건 구성
            filters = Q(content_embedding__isnull=False)

            if country_code:
                filters &= Q(country_code=country_code)

            if region1_idx:
                filters &= Q(region1_idx=region1_idx)

            if min_views:
                filters &= Q(views_num__gte=min_views)

            # 3. pgvector를 사용한 유사도 검색 (코사인 거리)
            from pgvector.django import CosineDistance

            similar_trips = (
                TripCourseEmbedding.objects
                .filter(filters)
                .annotate(distance=CosineDistance('content_embedding', query_embedding))
                .order_by('distance')[:limit]
            )

            # 4. 결과 포맷팅
            results = []
            for trip in similar_trips:
                # metadata에서 상세 정보 추출
                metadata = trip.metadata or {}

                result = {
                    "video_id": trip.video_id,
                    "title": trip.title,
                    "channel": trip.channel,
                    "url": trip.url,
                    "country": trip.country_name,
                    "city": trip.region1_idx.city_name if trip.region1_idx else None,
                    "views": trip.views_num,
                    "upload_date": f"{trip.upload_year}-{trip.upload_month:02d}" if trip.upload_year and trip.upload_month else None,
                    "similarity_score": float(1 - trip.distance),  # 거리를 유사도로 변환
                    "description": metadata.get('description_ko', metadata.get('description_en', '')),
                    "schedules": metadata.get('schedules', []),
                    "tags": metadata.get('tags', []),
                }
                results.append(result)

            logger.info(f"🔍 Found {len(results)} similar trips for query: '{query}'")
            return results

        except Exception as e:
            logger.error(f"❌ RAG search failed: {e}", exc_info=True)
            return []

    def get_trip_schedule_summary(self, video_id: str) -> Optional[str]:
        """
        특정 여행 영상의 스케줄 요약 반환

        Args:
            video_id: YouTube 비디오 ID

        Returns:
            스케줄 요약 텍스트
        """
        try:
            trip = TripCourseEmbedding.objects.get(video_id=video_id)
            metadata = trip.metadata or {}
            schedules = metadata.get('schedules', [])

            if not schedules:
                return None

            # 스케줄을 읽기 쉬운 형식으로 포맷팅
            summary_lines = [f"📍 {trip.title} 일정:"]

            for day_idx, day_schedule in enumerate(schedules, 1):
                if isinstance(day_schedule, list):
                    places = " → ".join(day_schedule[:5])  # 처음 5개 장소만
                    if len(day_schedule) > 5:
                        places += f" 외 {len(day_schedule) - 5}곳"
                    summary_lines.append(f"Day {day_idx}: {places}")
                elif isinstance(day_schedule, dict):
                    places = day_schedule.get('places', [])
                    if places:
                        place_str = " → ".join(places[:5])
                        if len(places) > 5:
                            place_str += f" 외 {len(places) - 5}곳"
                        summary_lines.append(f"Day {day_idx}: {place_str}")

            return "\n".join(summary_lines)

        except TripCourseEmbedding.DoesNotExist:
            logger.warning(f"⚠️ Trip not found: {video_id}")
            return None
        except Exception as e:
            logger.error(f"❌ Failed to get schedule summary: {e}")
            return None

    def recommend_by_current_trip(
        self,
        trip_title: str,
        country_code: Optional[int] = None,
        region1_idx: Optional[int] = None,
        limit: int = 5
    ) -> List[Dict]:
        """
        현재 여행 계획과 유사한 경로 추천

        Args:
            trip_title: 현재 여행 제목
            country_code: 여행 국가
            region1_idx: 여행 도시
            limit: 추천 개수

        Returns:
            추천 여행 경로 리스트
        """
        # 현재 여행 정보로 검색 쿼리 구성
        query_parts = [trip_title]

        if country_code:
            try:
                country = Country.objects.get(country_code=country_code)
                query_parts.append(country.country_name)
            except Country.DoesNotExist:
                pass

        if region1_idx:
            try:
                region = Region1.objects.get(region1_idx=region1_idx)
                query_parts.append(region.city_name)
            except Region1.DoesNotExist:
                pass

        query = " ".join(query_parts)
        logger.info(f"🎯 Recommending trips similar to: '{query}'")

        return self.search_similar_trips(
            query=query,
            country_code=country_code,
            region1_idx=region1_idx,
            limit=limit
        )


# 싱글톤 인스턴스
_rag_instance = None

def get_rag() -> TripRAG:
    """RAG 인스턴스 가져오기 (싱글톤)"""
    global _rag_instance
    if _rag_instance is None:
        _rag_instance = TripRAG()
    return _rag_instance
