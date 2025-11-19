# RAG 시스템 흐름도 및 상세 설명

## 목차
1. [RAG 시스템 개요](#rag-시스템-개요)
2. [전체 아키텍처](#전체-아키텍처)
3. [데이터 준비 및 임베딩](#데이터-준비-및-임베딩)
4. [벡터 검색 프로세스](#벡터-검색-프로세스)
5. [LLM 정제 및 응답 생성](#llm-정제-및-응답-생성)
6. [성능 최적화](#성능-최적화)
7. [테스트 및 평가](#테스트-및-평가)
8. [실제 사용 시나리오](#실제-사용-시나리오)

---

## RAG 시스템 개요

**RAG (Retrieval-Augmented Generation)**는 외부 지식 베이스에서 관련 정보를 검색한 후, 이를 LLM의 컨텍스트로 제공하여 더 정확하고 맥락에 맞는 응답을 생성하는 기술입니다.

### Triplan RAG의 특징

- **pgvector 기반 벡터 DB**: PostgreSQL의 pgvector 확장을 사용하여 고속 유사도 검색
- **OpenAI Embeddings**: `text-embedding-3-small` 모델로 텍스트를 벡터화
- **지역 기반 필터링**: 특정 지역(강원도, 부산 등)으로 검색 범위 제한
- **하이브리드 검색**: 벡터 유사도 + 키워드 필터링 결합
- **LLM 정제**: RAG 결과를 GPT-4로 재가공하여 일정 최적화
- **실시간 좌표 검색**: Kakao API로 장소 좌표 자동 수집

---

## 전체 아키텍처

```
┌───────────────────────────────────────────────────────────────────┐
│                         사용자 쿼리                                │
│                  "강릉 1박2일 일정 짜줘"                            │
└────────────────────────────┬──────────────────────────────────────┘
                             │
                             ▼
┌───────────────────────────────────────────────────────────────────┐
│                    TravelAgent (agent.py)                         │
│  - 의도 분류: SCHEDULE_PLANNING                                    │
│  - Tool 선택: recommend_and_add_to_planner                        │
└────────────────────────────┬──────────────────────────────────────┘
                             │
                             ▼
┌───────────────────────────────────────────────────────────────────┐
│                       RAG System (rag.py)                         │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Step 1: 쿼리 임베딩                                          │ │
│  │  - OpenAI API 호출                                           │ │
│  │  - "강릉 1박2일" → [0.123, -0.456, ...]                      │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                             │                                      │
│                             ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Step 2: 벡터 검색 (pgvector)                                │ │
│  │  - PostgreSQL 쿼리 실행                                       │ │
│  │  - Cosine Similarity 계산                                    │ │
│  │  - Top-K 결과 추출 (기본 10개)                               │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                             │                                      │
│                             ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Step 3: 필터링                                              │ │
│  │  - 지역명 필터: region_name = '강릉'                         │ │
│  │  - 카테고리 필터 (선택적)                                     │ │
│  │  - 유사도 임계값: score >= 0.7                               │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                             │                                      │
│                             ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Step 4: 메타데이터 풍부화                                   │ │
│  │  - Place 모델에서 추가 정보 조회                             │ │
│  │  - 주소, 카테고리, 설명 포함                                 │ │
│  └─────────────────────────────────────────────────────────────┘ │
└────────────────────────────┬──────────────────────────────────────┘
                             │
                             ▼
┌───────────────────────────────────────────────────────────────────┐
│                    LLM 정제 (agent.py)                            │
│  - GPT-4로 일정 최적화                                             │
│  - 시간대별 배치                                                   │
│  - 동선 고려                                                       │
└────────────────────────────┬──────────────────────────────────────┘
                             │
                             ▼
┌───────────────────────────────────────────────────────────────────┐
│                   Kakao API 좌표 검색                             │
│  - 각 장소별 위도/경도 조회                                        │
│  - 지역명 prefix 추가 ("강릉 경포대")                              │
└────────────────────────────┬──────────────────────────────────────┘
                             │
                             ▼
┌───────────────────────────────────────────────────────────────────┐
│                        DB 저장                                    │
│  - Trip → Day → Item 계층 구조                                    │
│  - 좌표 포함 저장                                                  │
└────────────────────────────┬──────────────────────────────────────┘
                             │
                             ▼
┌───────────────────────────────────────────────────────────────────┐
│                   WebSocket 전송                                  │
│  - Frontend로 planner_update 이벤트                               │
│  - 실시간 UI 업데이트                                              │
└───────────────────────────────────────────────────────────────────┘
```

---

## 데이터 준비 및 임베딩

### 1. Place 모델 (데이터 소스)

**파일**: `backend/apps/places/models.py`

```python
class Place(models.Model):
    place_name = models.CharField(max_length=255, verbose_name="장소명")
    address = models.TextField(verbose_name="주소")
    region_name = models.CharField(max_length=100, verbose_name="지역명")
    category = models.CharField(max_length=100, verbose_name="카테고리")
    description = models.TextField(verbose_name="설명", blank=True)

    latitude = models.FloatField(verbose_name="위도", null=True)
    longitude = models.FloatField(verbose_name="경도", null=True)

    # 추가 메타데이터
    phone = models.CharField(max_length=20, blank=True)
    website = models.URLField(blank=True)
    opening_hours = models.JSONField(default=dict, blank=True)
    rating = models.FloatField(default=0.0)
    review_count = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'places_place'
        indexes = [
            models.Index(fields=['region_name']),
            models.Index(fields=['category']),
        ]
```

### 2. PlaceEmbedding 모델 (벡터 저장)

**파일**: `backend/apps/ai/models.py`

```python
from pgvector.django import VectorField

class PlaceEmbedding(models.Model):
    place = models.OneToOneField(
        'places.Place',
        on_delete=models.CASCADE,
        related_name='embedding',
        verbose_name="장소"
    )

    # 벡터 필드 (1536차원 - text-embedding-3-small)
    embedding = VectorField(
        dimensions=1536,
        verbose_name="임베딩 벡터"
    )

    # 임베딩 생성에 사용된 텍스트
    source_text = models.TextField(
        verbose_name="소스 텍스트",
        help_text="임베딩 생성에 사용된 원본 텍스트"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ai_place_embedding'
        indexes = [
            # pgvector 인덱스 (HNSW: 계층적 탐색 그래프)
            models.Index(
                name='place_embedding_hnsw_idx',
                fields=['embedding'],
                opclasses=['vector_cosine_ops']
            )
        ]
```

### 3. 임베딩 생성 프로세스

**파일**: `backend/apps/ai/rag.py:create_embeddings()`

```python
class RAGSystem:
    def __init__(self):
        self.embedding_model = "text-embedding-3-small"
        self.embedding_dimension = 1536
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)

    def create_embeddings(self, places: list[Place]) -> None:
        """
        Place 목록에 대한 임베딩을 생성하고 DB에 저장합니다.

        Args:
            places: Place 객체 리스트
        """
        logger.info(f"🔄 {len(places)}개 장소에 대한 임베딩 생성 시작")

        for place in places:
            try:
                # 1. 소스 텍스트 생성
                source_text = self._create_source_text(place)

                # 2. OpenAI API 호출
                response = self.client.embeddings.create(
                    model=self.embedding_model,
                    input=source_text,
                    encoding_format="float"
                )

                # 3. 벡터 추출
                embedding_vector = response.data[0].embedding

                # 4. DB 저장 (기존 임베딩 있으면 업데이트)
                PlaceEmbedding.objects.update_or_create(
                    place=place,
                    defaults={
                        'embedding': embedding_vector,
                        'source_text': source_text
                    }
                )

                logger.info(f"✅ {place.place_name} 임베딩 생성 완료")

            except Exception as e:
                logger.error(f"❌ {place.place_name} 임베딩 생성 실패: {e}")

        logger.info(f"🎉 임베딩 생성 완료: {len(places)}개")

    def _create_source_text(self, place: Place) -> str:
        """
        Place 객체를 임베딩용 텍스트로 변환합니다.

        전략:
        - 장소명, 지역, 카테고리는 필수
        - 설명이 있으면 포함
        - 구조화된 형식으로 통일

        Returns:
            "강릉 경포대 | 관광지 | 강릉의 대표적인 해변..."
        """
        parts = [
            place.region_name,
            place.place_name,
            place.category
        ]

        if place.description:
            parts.append(place.description)

        return " | ".join(parts)
```

### 4. 배치 임베딩 생성 (Django Management Command)

**파일**: `backend/apps/ai/management/commands/create_embeddings.py`

```bash
# 전체 장소에 대한 임베딩 생성
python manage.py create_embeddings

# 특정 지역만 생성
python manage.py create_embeddings --region 강릉

# 업데이트된 장소만 재생성
python manage.py create_embeddings --updated-since 2025-01-01
```

**구현**:
```python
from django.core.management.base import BaseCommand
from apps.places.models import Place
from apps.ai.rag import RAGSystem

class Command(BaseCommand):
    help = '장소 임베딩을 생성합니다'

    def add_arguments(self, parser):
        parser.add_argument(
            '--region',
            type=str,
            help='특정 지역만 생성'
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=100,
            help='배치 크기'
        )

    def handle(self, *args, **options):
        rag = RAGSystem()

        # 조건에 맞는 장소 조회
        queryset = Place.objects.all()

        if options['region']:
            queryset = queryset.filter(region_name=options['region'])

        # 배치 처리
        batch_size = options['batch_size']
        total = queryset.count()

        self.stdout.write(f"총 {total}개 장소 처리 예정")

        for i in range(0, total, batch_size):
            batch = queryset[i:i+batch_size]
            rag.create_embeddings(list(batch))

            self.stdout.write(
                self.style.SUCCESS(
                    f"진행률: {min(i+batch_size, total)}/{total}"
                )
            )

        self.stdout.write(self.style.SUCCESS("완료!"))
```

---

## 벡터 검색 프로세스

### 1. 쿼리 임베딩

```python
def search(self, query: str, top_k: int = 10, filters: dict = None) -> list[dict]:
    """
    쿼리를 임베딩하고 유사한 장소를 검색합니다.

    Args:
        query: 검색 쿼리 (예: "강릉 해변 카페")
        top_k: 반환할 결과 수
        filters: 추가 필터 {'region_name': '강릉', 'category': '카페'}

    Returns:
        [
            {
                'place_name': '테라로사 강릉',
                'similarity_score': 0.92,
                'address': '...',
                ...
            },
            ...
        ]
    """
    search_start = time.time()

    # Step 1: 쿼리 임베딩
    query_vector = self._embed_query(query)

    # Step 2: pgvector 검색
    results = self._vector_search(query_vector, top_k, filters)

    search_time = time.time() - search_start
    logger.info(f"🔍 검색 완료: {len(results)}개 결과 ({search_time:.2f}초)")

    return results

def _embed_query(self, query: str) -> list[float]:
    """
    쿼리 문자열을 임베딩 벡터로 변환합니다.
    """
    response = self.client.embeddings.create(
        model=self.embedding_model,
        input=query
    )

    return response.data[0].embedding
```

### 2. pgvector 유사도 검색

```python
def _vector_search(self, query_vector: list[float], top_k: int, filters: dict = None) -> list[dict]:
    """
    pgvector를 사용하여 코사인 유사도 기반 검색을 수행합니다.

    SQL 쿼리 예시:
    SELECT
        p.place_name,
        p.address,
        p.region_name,
        1 - (pe.embedding <=> %s) AS similarity_score
    FROM places_place p
    JOIN ai_place_embedding pe ON p.id = pe.place_id
    WHERE p.region_name = '강릉'
    ORDER BY pe.embedding <=> %s
    LIMIT 10;
    """
    from pgvector.django import CosineDistance

    # 기본 쿼리셋
    queryset = PlaceEmbedding.objects.select_related('place')

    # 필터 적용
    if filters:
        if 'region_name' in filters:
            queryset = queryset.filter(place__region_name=filters['region_name'])

        if 'category' in filters:
            queryset = queryset.filter(place__category__icontains=filters['category'])

    # 벡터 유사도 검색 (코사인 거리)
    results = queryset.annotate(
        distance=CosineDistance('embedding', query_vector)
    ).order_by('distance')[:top_k]

    # 결과 포맷팅
    formatted_results = []
    for result in results:
        similarity_score = 1 - result.distance  # 거리 → 유사도 변환

        formatted_results.append({
            'place_idx': result.place.idx,
            'place_name': result.place.place_name,
            'address': result.place.address,
            'region_name': result.place.region_name,
            'category': result.place.category,
            'description': result.place.description,
            'latitude': result.place.latitude,
            'longitude': result.place.longitude,
            'similarity_score': round(similarity_score, 4)
        })

    return formatted_results
```

### 3. 하이브리드 검색 (벡터 + 키워드)

```python
def hybrid_search(self, query: str, top_k: int = 10, filters: dict = None) -> list[dict]:
    """
    벡터 검색과 키워드 검색을 결합합니다.

    전략:
    1. 벡터 검색으로 상위 2*top_k 개 추출
    2. 키워드 매칭으로 재순위화
    3. 최종 top_k 개 반환
    """
    # 벡터 검색
    vector_results = self.search(query, top_k=top_k*2, filters=filters)

    # 키워드 추출
    keywords = self._extract_keywords(query)

    # 재순위화
    for result in vector_results:
        keyword_score = self._calculate_keyword_score(
            result['place_name'] + ' ' + result['description'],
            keywords
        )

        # 최종 점수 = 0.7 * 벡터 유사도 + 0.3 * 키워드 점수
        result['final_score'] = (
            0.7 * result['similarity_score'] +
            0.3 * keyword_score
        )

    # 최종 점수로 정렬
    vector_results.sort(key=lambda x: x['final_score'], reverse=True)

    return vector_results[:top_k]

def _extract_keywords(self, query: str) -> list[str]:
    """
    쿼리에서 핵심 키워드를 추출합니다.

    예: "강릉 해변 카페 추천" → ["강릉", "해변", "카페"]
    """
    # 불용어 제거
    stopwords = ['추천', '알려줘', '해줘', '좋은', '괜찮은']

    words = query.split()
    keywords = [w for w in words if w not in stopwords]

    return keywords

def _calculate_keyword_score(self, text: str, keywords: list[str]) -> float:
    """
    텍스트에서 키워드 매칭 점수를 계산합니다.
    """
    matches = sum(1 for kw in keywords if kw in text)
    return matches / len(keywords) if keywords else 0
```

### 4. 성능 최적화

#### pgvector 인덱스

```sql
-- HNSW 인덱스 생성 (Hierarchical Navigable Small World)
CREATE INDEX place_embedding_hnsw_idx
ON ai_place_embedding
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 설명:
-- m: 그래프 연결 수 (높을수록 정확, 느림)
-- ef_construction: 인덱스 구축 시 탐색 깊이
```

**성능 비교**:
```
인덱스 없음:
- 10,000개 장소 검색: ~500ms

HNSW 인덱스:
- 10,000개 장소 검색: ~20ms
- 약 25배 속도 향상
```

#### 캐싱

```python
from django.core.cache import cache

def search(self, query: str, top_k: int = 10, filters: dict = None) -> list[dict]:
    # 캐시 키 생성
    cache_key = f"rag_search:{hash(query)}:{top_k}:{hash(str(filters))}"

    # 캐시 확인
    cached_result = cache.get(cache_key)
    if cached_result:
        logger.info(f"💾 캐시 히트: {cache_key}")
        return cached_result

    # 검색 수행
    results = self._vector_search(query_vector, top_k, filters)

    # 캐시 저장 (15분)
    cache.set(cache_key, results, timeout=900)

    return results
```

---

## LLM 정제 및 응답 생성

### 1. RAG 결과 정제 프롬프트

**파일**: `backend/apps/chat/agent.py:recommend_and_add_to_planner()`

```python
def _refine_rag_results(self, rag_results: list[dict], query: str, days: int) -> list[dict]:
    """
    RAG 검색 결과를 LLM으로 정제하여 최적의 일정을 생성합니다.

    Input (rag_results):
    [
        {'place_name': '경포대', 'category': '해변', 'similarity_score': 0.95},
        {'place_name': '오죽헌', 'category': '문화재', 'similarity_score': 0.92},
        {'place_name': '초당순두부', 'category': '맛집', 'similarity_score': 0.88},
        ...
    ]

    Output:
    [
        {
            'day': 1,
            'date': '2025-01-20',
            'items': [
                {
                    'time': '09:00',
                    'place': '경포대',
                    'reason': '아침 산책하기 좋은 해변',
                    'category': '관광지'
                },
                ...
            ]
        },
        ...
    ]
    """

    refinement_prompt = f"""
당신은 여행 일정 최적화 전문가입니다.
다음 RAG 검색 결과를 바탕으로 **{days}일** 여행 일정을 구성하세요.

## RAG 검색 결과:
{json.dumps(rag_results, ensure_ascii=False, indent=2)}

## 사용자 요청:
"{query}"

## 일정 구성 원칙:
1. **시간대별 배치**:
   - 오전 (09:00-12:00): 관광지, 자연 명소
   - 점심 (12:00-14:00): 맛집, 식당
   - 오후 (14:00-18:00): 박물관, 카페, 쇼핑
   - 저녁 (18:00-21:00): 레스토랑, 야경

2. **동선 최적화**:
   - 인접한 장소끼리 그룹화
   - 불필요한 이동 최소화
   - 지역 특성 고려 (해안가 → 산 → 시내)

3. **다양성 확보**:
   - 관광지, 맛집, 카페, 문화시설 골고루 배치
   - 같은 카테고리 연속 배치 지양

4. **현실성**:
   - 하루 5-7개 장소
   - 이동 시간 고려 (장소 간 30분-1시간)
   - 휴식 시간 포함

## 출력 형식 (JSON):
[
    {{
        "day": 1,
        "date": "2025-01-20",
        "items": [
            {{
                "time": "09:00",
                "place": "경포대",
                "reason": "아침 산책하기 좋은 강릉 대표 해변",
                "category": "관광지"
            }},
            {{
                "time": "12:00",
                "place": "초당순두부마을",
                "reason": "강릉 대표 맛집, 점심 식사",
                "category": "맛집"
            }},
            ...
        ]
    }},
    ...
]

**중요**: 반드시 JSON 형식으로만 응답하세요. 추가 설명 없이 JSON만 출력하세요.
"""

    # GPT-4 호출
    response = self.llm.invoke(refinement_prompt)

    # JSON 파싱
    try:
        # 응답에서 JSON 부분만 추출
        content = response.content.strip()

        # 코드 블록 제거 (```json ... ```)
        if content.startswith('```'):
            content = content.split('```')[1]
            if content.startswith('json'):
                content = content[4:]
            content = content.strip()

        enriched_plan = json.loads(content)

        logger.info(f"✅ LLM 정제 완료: {len(enriched_plan)}일 일정")
        return enriched_plan

    except json.JSONDecodeError as e:
        logger.error(f"❌ JSON 파싱 실패: {e}")
        logger.error(f"응답 내용: {response.content}")

        # 대체 로직: RAG 결과를 직접 변환
        return self._fallback_plan_generation(rag_results, days)
```

### 2. Fallback 계획 생성

```python
def _fallback_plan_generation(self, rag_results: list[dict], days: int) -> list[dict]:
    """
    LLM 정제 실패 시 RAG 결과를 직접 일정으로 변환합니다.

    간단한 휴리스틱 사용:
    - 카테고리별 시간대 매핑
    - 순차적 배치
    """
    plan = []
    places_per_day = len(rag_results) // days

    category_time_map = {
        '관광지': ['09:00', '10:00', '14:00'],
        '맛집': ['12:00', '18:00'],
        '카페': ['15:00', '16:00'],
        '문화시설': ['10:00', '14:00'],
        '쇼핑': ['16:00', '17:00']
    }

    for day_no in range(1, days + 1):
        start_idx = (day_no - 1) * places_per_day
        end_idx = start_idx + places_per_day
        day_places = rag_results[start_idx:end_idx]

        items = []
        for i, place in enumerate(day_places):
            category = place['category']
            time_options = category_time_map.get(category, ['09:00'])
            time = time_options[i % len(time_options)]

            items.append({
                'time': time,
                'place': place['place_name'],
                'reason': place.get('description', ''),
                'category': category
            })

        # 시간순 정렬
        items.sort(key=lambda x: x['time'])

        plan.append({
            'day': day_no,
            'date': (datetime.now() + timedelta(days=day_no-1)).strftime('%Y-%m-%d'),
            'items': items
        })

    return plan
```

---

## 성능 최적화

### 1. 임베딩 캐싱

```python
class RAGSystem:
    def __init__(self):
        self._embedding_cache = {}  # 메모리 캐시

    def _embed_query(self, query: str) -> list[float]:
        # 캐시 확인
        if query in self._embedding_cache:
            return self._embedding_cache[query]

        # API 호출
        response = self.client.embeddings.create(
            model=self.embedding_model,
            input=query
        )

        vector = response.data[0].embedding

        # 캐시 저장
        self._embedding_cache[query] = vector

        return vector
```

### 2. 배치 임베딩

```python
def create_embeddings_batch(self, places: list[Place], batch_size: int = 100) -> None:
    """
    대량의 장소를 배치로 임베딩합니다.

    OpenAI API는 한 번에 여러 텍스트를 임베딩할 수 있어 효율적입니다.
    """
    for i in range(0, len(places), batch_size):
        batch = places[i:i+batch_size]

        # 소스 텍스트 생성
        texts = [self._create_source_text(p) for p in batch]

        # 배치 임베딩 (한 번의 API 호출)
        response = self.client.embeddings.create(
            model=self.embedding_model,
            input=texts
        )

        # DB 저장
        for place, embedding_data in zip(batch, response.data):
            PlaceEmbedding.objects.update_or_create(
                place=place,
                defaults={
                    'embedding': embedding_data.embedding,
                    'source_text': texts[batch.index(place)]
                }
            )

        logger.info(f"배치 {i//batch_size + 1} 완료 ({len(batch)}개)")
```

### 3. 쿼리 최적화

```python
# Bad: N+1 쿼리
for embedding in PlaceEmbedding.objects.all():
    place = embedding.place  # 매번 DB 쿼리
    print(place.place_name)

# Good: select_related 사용
for embedding in PlaceEmbedding.objects.select_related('place'):
    print(embedding.place.place_name)  # 한 번의 JOIN 쿼리

# 성능 차이:
# Bad: 10,000개 장소 → 10,001번 쿼리 (1+N)
# Good: 10,000개 장소 → 1번 쿼리
```

---

## 테스트 및 평가

### 1. RAGTestLog 모델

**파일**: `backend/apps/chat/models_performance.py`

```python
class RAGTestLog(models.Model):
    query = models.TextField(verbose_name="테스트 쿼리")
    filters = models.JSONField(default=dict, verbose_name="필터 조건")

    # 검색 설정
    top_k = models.IntegerField(default=10)
    search_type = models.CharField(
        max_length=20,
        choices=[('vector', '벡터'), ('hybrid', '하이브리드')],
        default='vector'
    )

    # 성능 메트릭
    search_time = models.FloatField(verbose_name="검색 시간 (초)")
    result_count = models.IntegerField(verbose_name="결과 개수")

    # 유사도 통계
    avg_similarity_score = models.FloatField(null=True, verbose_name="평균 유사도")
    min_similarity_score = models.FloatField(null=True, verbose_name="최소 유사도")
    max_similarity_score = models.FloatField(null=True, verbose_name="최대 유사도")
    similarity_std_dev = models.FloatField(null=True, verbose_name="유사도 표준편차")

    # 결과
    rag_results = models.JSONField(verbose_name="검색 결과")
    success = models.BooleanField(default=True)
    error_message = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
```

### 2. 테스트 API

**파일**: `backend/apps/chat/views_admin.py`

```python
@api_view(['POST'])
@permission_classes([IsAdminUser])
def test_rag_search(request):
    """
    RAG 검색을 테스트하고 결과를 로깅합니다.

    POST /api/chat/admin/rag/test/
    {
        "query": "강릉 해변 카페",
        "top_k": 10,
        "filters": {"region_name": "강릉"}
    }
    """
    query = request.data.get('query')
    top_k = request.data.get('top_k', 10)
    filters = request.data.get('filters', {})

    try:
        # RAG 검색
        rag = RAGSystem()
        start_time = time.time()
        results = rag.search(query, top_k=top_k, filters=filters)
        search_time = time.time() - start_time

        # 유사도 통계 계산
        scores = [r['similarity_score'] for r in results]
        avg_score = sum(scores) / len(scores) if scores else None
        min_score = min(scores) if scores else None
        max_score = max(scores) if scores else None

        std_dev = None
        if scores and len(scores) > 1:
            mean = avg_score
            variance = sum((x - mean) ** 2 for x in scores) / len(scores)
            std_dev = variance ** 0.5

        # 로그 저장
        log = RAGTestLog.objects.create(
            query=query,
            filters=filters,
            top_k=top_k,
            search_type='vector',
            search_time=search_time,
            result_count=len(results),
            avg_similarity_score=avg_score,
            min_similarity_score=min_score,
            max_similarity_score=max_score,
            similarity_std_dev=std_dev,
            rag_results=results,
            success=True
        )

        return Response({
            'log_id': log.id,
            'search_time': search_time,
            'result_count': len(results),
            'avg_similarity_score': avg_score,
            'min_similarity_score': min_score,
            'max_similarity_score': max_score,
            'similarity_std_dev': std_dev,
            'results': results
        })

    except Exception as e:
        # 에러 로깅
        RAGTestLog.objects.create(
            query=query,
            filters=filters,
            top_k=top_k,
            search_type='vector',
            search_time=0,
            result_count=0,
            rag_results=[],
            success=False,
            error_message=str(e)
        )

        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
```

### 3. Frontend 테스트 UI

**파일**: `frontend/src/components/admin/RAGSystemTester.tsx`

```typescript
const RAGSystemTester: React.FC = () => {
  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState(10);
  const [region, setRegion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RAGTestResult | null>(null);

  const handleTest = async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/chat/admin/rag/test/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          query,
          top_k: topK,
          filters: region ? { region_name: region } : {}
        })
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('RAG 테스트 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5">RAG 시스템 테스트</Typography>

      <TextField
        label="검색 쿼리"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        fullWidth
        margin="normal"
        placeholder="예: 강릉 해변 카페"
      />

      <TextField
        label="결과 개수 (top_k)"
        type="number"
        value={topK}
        onChange={(e) => setTopK(Number(e.target.value))}
        margin="normal"
      />

      <TextField
        label="지역 필터 (선택)"
        value={region}
        onChange={(e) => setRegion(e.target.value)}
        margin="normal"
        placeholder="예: 강릉"
      />

      <Button
        variant="contained"
        onClick={handleTest}
        disabled={loading || !query}
      >
        {loading ? '검색 중...' : '테스트 실행'}
      </Button>

      {result && (
        <Box mt={4}>
          <Card>
            <CardContent>
              <Typography variant="h6">📊 검색 통계</Typography>
              <Typography>검색 시간: {result.search_time.toFixed(3)}초</Typography>
              <Typography>결과 개수: {result.result_count}개</Typography>
              <Typography>
                평균 유사도: {(result.avg_similarity_score * 100).toFixed(1)}%
              </Typography>
              <Typography>
                유사도 범위: {(result.min_similarity_score * 100).toFixed(1)}% ~ {(result.max_similarity_score * 100).toFixed(1)}%
              </Typography>
            </CardContent>
          </Card>

          <Typography variant="h6" mt={4}>🔍 검색 결과</Typography>
          {result.results.map((item, index) => (
            <Card key={index} sx={{ mt: 2 }}>
              <CardContent>
                <Typography variant="h6">{item.place_name}</Typography>
                <Typography color="textSecondary">{item.address}</Typography>
                <Chip
                  label={`유사도: ${(item.similarity_score * 100).toFixed(1)}%`}
                  color={item.similarity_score > 0.8 ? 'success' : 'default'}
                />
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
};
```

---

## 실제 사용 시나리오

### 시나리오 1: "강릉 1박2일 일정 짜줘"

#### Step 1: 사용자 입력
```
User: "강릉 1박2일 일정 짜줘"
```

#### Step 2: Agent 의도 분류
```json
{
  "type": "SCHEDULE_PLANNING",
  "confidence": 98,
  "reasoning": "1박2일 전체 일정 계획 요청"
}
```

#### Step 3: RAG 검색
```python
# 쿼리 임베딩
query_vector = embed("강릉 1박2일")

# 벡터 검색
rag_results = search(
    query_vector,
    top_k=15,
    filters={'region_name': '강릉'}
)
```

#### Step 4: RAG 결과
```json
[
  {
    "place_name": "경포대",
    "category": "관광지",
    "similarity_score": 0.95,
    "address": "강원 강릉시 경포로 365"
  },
  {
    "place_name": "초당순두부마을",
    "category": "맛집",
    "similarity_score": 0.92
  },
  {
    "place_name": "안목해변",
    "category": "카페거리",
    "similarity_score": 0.90
  },
  ...
]
```

#### Step 5: LLM 정제
```json
[
  {
    "day": 1,
    "date": "2025-01-20",
    "items": [
      {
        "time": "09:00",
        "place": "경포대",
        "reason": "강릉 대표 해변, 아침 산책",
        "category": "관광지"
      },
      {
        "time": "12:00",
        "place": "초당순두부마을",
        "reason": "점심 식사, 강릉 명물",
        "category": "맛집"
      },
      {
        "time": "14:00",
        "place": "오죽헌",
        "reason": "신사임당 유적지",
        "category": "문화재"
      },
      {
        "time": "16:00",
        "place": "안목해변",
        "reason": "커피거리, 휴식",
        "category": "카페"
      },
      {
        "time": "19:00",
        "place": "강릉중앙시장",
        "reason": "저녁 식사 및 전통시장 체험",
        "category": "맛집"
      }
    ]
  },
  {
    "day": 2,
    "date": "2025-01-21",
    "items": [
      {
        "time": "09:00",
        "place": "주문진해변",
        "reason": "아침 해변 산책",
        "category": "관광지"
      },
      {
        "time": "11:00",
        "place": "하슬라아트월드",
        "reason": "바다 전망 미술관",
        "category": "문화시설"
      },
      {
        "time": "13:00",
        "place": "정동진",
        "reason": "점심 및 해돋이 명소",
        "category": "관광지"
      }
    ]
  }
]
```

#### Step 6: Kakao API 좌표 검색
```python
for day in enriched_plan:
    for item in day['items']:
        # "강릉 경포대" 검색
        kakao_result = search_kakao(f"강릉 {item['place']}")

        item['latitude'] = kakao_result['y']
        item['longitude'] = kakao_result['x']
        item['address'] = kakao_result['address_name']
```

#### Step 7: DB 저장 & WebSocket 전송
```python
# DB 저장
for day_data in enriched_plan:
    day = Day.objects.create(trip_idx=5, day_no=day_data['day'], ...)

    for item_data in day_data['items']:
        Item.objects.create(day_idx=day, ...)

# WebSocket 전송
send_planner_update('add_schedule', enriched_plan)
```

#### Step 8: Frontend UI 업데이트
```typescript
// planner.tsx에서 수신
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'planner_update') {
        // 스케줄 업데이트
        setSchedule(data.data.days);

        // 지도 마커 자동 추가
        updateMapMarkers(data.data.days);
    }
};
```

---

**마지막 업데이트**: 2025-01-19
**문서 버전**: 1.0.0
