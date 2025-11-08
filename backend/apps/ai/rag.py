"""
RAG (Retrieval-Augmented Generation) System for Travel Recommendations
여행 경로 임베딩을 활용한 검색 증강 생성 시스템
"""

from typing import List, Dict, Optional
import openai
from django.conf import settings
from django.db.models import Q
import logging
import requests
from bs4 import BeautifulSoup
import json

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
        min_views: int = 1000,
        use_fallback: bool = True
    ) -> List[Dict]:
        """
        벡터 유사도 검색으로 비슷한 여행 경로 찾기 (Fallback 전략 포함)

        Args:
            query: 검색 쿼리 (예: "서울 맛집 투어", "제주도 자연 여행")
            country_code: 국가 필터 (선택)
            region1_idx: 도시 필터 (선택)
            limit: 반환할 결과 수
            min_views: 최소 조회수 (인기 영상 필터)
            use_fallback: RAG 결과 없을 시 외부 검색 사용 여부

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
                    "source": "rag_database"
                }
                results.append(result)

            logger.info(f"🔍 RAG found {len(results)} trips for query: '{query}'")

            # 5. Fallback 전략: RAG 결과가 없으면 외부 검색
            if len(results) == 0 and use_fallback:
                logger.warning(f"⚠️ No RAG results for '{query}', trying fallback search...")
                fallback_results = self._fallback_search(query, country_code, region1_idx, limit)
                if fallback_results:
                    logger.info(f"✅ Fallback found {len(fallback_results)} results")
                    return fallback_results
                else:
                    logger.warning(f"⚠️ Fallback also returned no results")

            return results

        except Exception as e:
            logger.error(f"❌ RAG search failed: {e}", exc_info=True)
            # 예외 발생 시에도 Fallback 시도
            if use_fallback:
                try:
                    return self._fallback_search(query, country_code, region1_idx, limit)
                except:
                    pass
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

    def _fallback_search(
        self,
        query: str,
        country_code: Optional[int] = None,
        region1_idx: Optional[int] = None,
        limit: int = 5
    ) -> List[Dict]:
        """
        RAG 결과가 없을 때 외부 API로 검색 (다단계 Fallback)

        우선순위:
        1. YouTube Data API 실시간 검색
        2. Naver 블로그 검색
        3. Google Custom Search (선택)

        Args:
            query: 검색 쿼리
            country_code: 국가 필터
            region1_idx: 도시 필터
            limit: 결과 수

        Returns:
            외부 검색 결과
        """
        results = []

        # 위치 정보 추가
        location_info = self._get_location_info(country_code, region1_idx)
        search_query = f"{query} {location_info}" if location_info else query

        # 1단계: YouTube Data API 실시간 검색
        youtube_results = self._search_youtube_api(search_query, limit)
        if youtube_results:
            results.extend(youtube_results)
            logger.info(f"✅ YouTube API returned {len(youtube_results)} results")

        # 2단계: 아직 충분하지 않으면 Naver 블로그 검색
        if len(results) < limit:
            naver_results = self._search_naver_blog(search_query, limit - len(results))
            if naver_results:
                results.extend(naver_results)
                logger.info(f"✅ Naver Blog returned {len(naver_results)} results")

        # 3단계: GPT-4로 일반적인 추천 생성 (최후의 수단)
        if len(results) == 0:
            gpt_results = self._generate_gpt_recommendations(search_query, limit)
            if gpt_results:
                results.extend(gpt_results)
                logger.info(f"✅ GPT-4 generated {len(gpt_results)} recommendations")

        return results[:limit]

    def _get_location_info(self, country_code: Optional[int], region1_idx: Optional[int]) -> str:
        """국가/도시 정보를 문자열로 변환"""
        parts = []
        if region1_idx:
            try:
                region = Region1.objects.get(region1_idx=region1_idx)
                parts.append(region.city_name)
            except Region1.DoesNotExist:
                pass

        if country_code:
            try:
                country = Country.objects.get(country_code=country_code)
                parts.append(country.country_name)
            except Country.DoesNotExist:
                pass

        return " ".join(parts)

    def _search_youtube_api(self, query: str, limit: int) -> List[Dict]:
        """
        YouTube Data API v3로 실시간 여행 영상 검색

        Returns:
            YouTube 검색 결과 리스트
        """
        try:
            youtube_api_key = getattr(settings, 'YOUTUBE_API_KEY', None)
            if not youtube_api_key:
                logger.warning("⚠️ YouTube API key not configured")
                return []

            # YouTube Data API 호출
            url = "https://www.googleapis.com/youtube/v3/search"
            params = {
                "part": "snippet",
                "q": f"{query} 여행",
                "type": "video",
                "maxResults": limit,
                "order": "viewCount",
                "relevanceLanguage": "ko",
                "key": youtube_api_key
            }

            response = requests.get(url, params=params, timeout=5)
            response.raise_for_status()
            data = response.json()

            results = []
            for item in data.get("items", []):
                video_id = item["id"]["videoId"]
                snippet = item["snippet"]

                result = {
                    "video_id": video_id,
                    "title": snippet["title"],
                    "channel": snippet["channelTitle"],
                    "url": f"https://www.youtube.com/watch?v={video_id}",
                    "description": snippet.get("description", ""),
                    "thumbnail": snippet.get("thumbnails", {}).get("high", {}).get("url", ""),
                    "published_at": snippet.get("publishedAt", ""),
                    "similarity_score": 0.7,  # 외부 API는 고정 점수
                    "source": "youtube_api",
                    "schedules": [],  # 실시간 검색은 일정 없음
                    "tags": []
                }
                results.append(result)

            return results

        except Exception as e:
            logger.error(f"❌ YouTube API search failed: {e}")
            return []

    def _search_naver_blog(self, query: str, limit: int) -> List[Dict]:
        """
        Naver 블로그 API로 여행 후기 검색

        Returns:
            Naver 블로그 검색 결과
        """
        try:
            client_id = getattr(settings, 'NAVER_CLIENT_ID', None)
            client_secret = getattr(settings, 'NAVER_CLIENT_SECRET', None)

            if not client_id or not client_secret:
                logger.warning("⚠️ Naver API credentials not configured")
                return []

            url = "https://openapi.naver.com/v1/search/blog.json"
            headers = {
                "X-Naver-Client-Id": client_id,
                "X-Naver-Client-Secret": client_secret
            }
            params = {
                "query": f"{query} 여행",
                "display": limit,
                "sort": "sim"  # 정확도순
            }

            response = requests.get(url, headers=headers, params=params, timeout=5)
            response.raise_for_status()
            data = response.json()

            results = []
            for item in data.get("items", []):
                # HTML 태그 제거
                title = BeautifulSoup(item["title"], "html.parser").get_text()
                description = BeautifulSoup(item["description"], "html.parser").get_text()

                result = {
                    "title": title,
                    "url": item["link"],
                    "description": description,
                    "blog_name": item.get("bloggername", ""),
                    "posted_date": item.get("postdate", ""),
                    "similarity_score": 0.65,
                    "source": "naver_blog",
                    "schedules": [],
                    "tags": []
                }
                results.append(result)

            return results

        except Exception as e:
            logger.error(f"❌ Naver Blog search failed: {e}")
            return []

    def _generate_gpt_recommendations(self, query: str, limit: int) -> List[Dict]:
        """
        GPT-4로 일반적인 여행 추천 생성 (최후의 수단)

        Returns:
            GPT-4가 생성한 추천 리스트
        """
        try:
            prompt = f"""
사용자가 '{query}' 여행 정보를 찾고 있습니다.
하지만 데이터베이스에 관련 정보가 없습니다.

일반적인 여행 지식을 바탕으로 {limit}개의 추천 여행 코스를 JSON 형식으로 생성해주세요.

각 추천은 다음 구조를 따라야 합니다:
{{
  "title": "여행 제목",
  "description": "간단한 설명 (100자 내외)",
  "schedules": [
    {{"day": 1, "places": ["장소1", "장소2", "장소3"]}},
    {{"day": 2, "places": ["장소4", "장소5"]}}
  ],
  "tips": "여행 팁"
}}

JSON 배열로 응답해주세요.
"""

            response = openai.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=[
                    {"role": "system", "content": "당신은 전문 여행 플래너입니다."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                response_format={"type": "json_object"}
            )

            content = response.choices[0].message.content
            recommendations = json.loads(content)

            # 결과 포맷팅
            results = []
            if isinstance(recommendations, dict) and "recommendations" in recommendations:
                recommendations = recommendations["recommendations"]

            for idx, rec in enumerate(recommendations[:limit], 1):
                result = {
                    "title": rec.get("title", f"추천 여행 코스 {idx}"),
                    "description": rec.get("description", ""),
                    "schedules": rec.get("schedules", []),
                    "tips": rec.get("tips", ""),
                    "similarity_score": 0.5,
                    "source": "gpt4_generated",
                    "url": None,
                    "tags": []
                }
                results.append(result)

            return results

        except Exception as e:
            logger.error(f"❌ GPT-4 recommendation generation failed: {e}")
            return []

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
            limit=limit,
            use_fallback=True  # Fallback 활성화
        )


# 싱글톤 인스턴스
_rag_instance = None

def get_rag() -> TripRAG:
    """RAG 인스턴스 가져오기 (싱글톤)"""
    global _rag_instance
    if _rag_instance is None:
        _rag_instance = TripRAG()
    return _rag_instance
