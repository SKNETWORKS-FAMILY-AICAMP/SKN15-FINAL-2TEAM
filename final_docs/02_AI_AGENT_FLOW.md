# AI 에이전트 흐름도 및 상세 설명

## 목차
1. [시스템 개요](#시스템-개요)
2. [전체 아키텍처](#전체-아키텍처)
3. [에이전트 처리 흐름](#에이전트-처리-흐름)
4. [의도 분류 시스템](#의도-분류-시스템)
5. [Tool 실행 메커니즘](#tool-실행-메커니즘)
6. [각 Tool 상세 설명](#각-tool-상세-설명)
7. [응답 생성 및 전송](#응답-생성-및-전송)
8. [성능 로깅](#성능-로깅)
9. [에러 처리](#에러-처리)

---

## 시스템 개요

Triplan의 AI 에이전트는 **LangChain 기반 ReAct Agent** 패턴을 사용하여 사용자의 자연어 입력을 이해하고, 적절한 도구를 선택하여 실행하며, 최종 응답을 생성합니다.

### 핵심 특징
- **의도 기반 분류**: 10가지 의도 유형으로 사용자 요청 분류
- **동적 Tool 선택**: 의도에 따라 최적의 Tool 자동 선택
- **RAG 통합**: 벡터 검색을 통한 맞춤형 여행지 추천
- **실시간 협업**: WebSocket을 통한 즉각적인 응답 전송
- **성능 모니터링**: 각 단계별 실행 시간 측정 및 로깅

---

## 전체 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Input                              │
│              "홍천 1박 2일 일정 짜줘"                            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    WebSocket Consumer                           │
│                  (consumers.py)                                 │
│  - 메시지 수신                                                    │
│  - ChatMessage DB 저장                                           │
│  - Agent 호출                                                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     TravelAgent                                 │
│                   (agent.py)                                    │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Step 1: 의도 분류 (Intent Classification)                │  │
│  │  - classify_intent_with_llm()                            │  │
│  │  - GPT-4로 사용자 의도 파악                               │  │
│  │  - 10가지 유형 중 하나로 분류                             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                      │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Step 2: Tool 선택 및 Routing                            │  │
│  │  - map_intent_to_tool()                                  │  │
│  │  - 의도별 최적 Tool 매핑                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                      │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Step 3: Agent 실행                                       │  │
│  │  - LangChain ReAct Agent                                 │  │
│  │  - Tool 실행 및 결과 수집                                 │  │
│  │  - 반복적 추론 (필요시)                                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                      │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Step 4: 응답 생성                                        │  │
│  │  - Tool 결과 포맷팅                                       │  │
│  │  - 마커 추가 ([RAG_RECOMMENDATION] 등)                   │  │
│  │  - WebSocket 전송                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                      │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Step 5: 성능 로깅                                        │  │
│  │  - BotPerformanceLog 생성                                │  │
│  │  - 실행 시간, 사용된 Tool 기록                            │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Frontend (planner.tsx)                         │
│  - WebSocket으로 응답 수신                                       │
│  - UI 업데이트 (채팅창, 플래너, 지도)                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 에이전트 처리 흐름

### 1. 초기화 및 설정

**파일**: `backend/apps/chat/agent.py`

```python
class TravelAgent:
    def __init__(self, room_id: int, user_id: int = None, trip_idx: int = None):
        self.room_id = room_id
        self.user_id = user_id
        self.trip_idx = trip_idx

        # OpenAI LLM 초기화
        self.llm = ChatOpenAI(
            model=settings.OPENAI_MODEL,  # gpt-4o-mini
            temperature=0.7,
            streaming=True,
            callbacks=[StreamingStdOutCallbackHandler()]
        )

        # Tool 목록 초기화
        self.tools = [
            recommend_place,           # 장소 추천
            search_place,              # 장소 검색
            add_schedule_item,         # 일정 추가
            get_weather,               # 날씨 조회
            calculate_budget,          # 예산 계산
            get_current_plan,          # 현재 플랜 조회
            # ... 기타 Tools
        ]

        # Agent Executor 생성
        self.agent = create_react_agent(
            llm=self.llm,
            tools=self.tools,
            prompt=self._create_prompt_template()
        )
```

### 2. 메시지 수신 및 Agent 호출

**WebSocket Consumer** (`backend/apps/chat/consumers.py`):

```python
async def receive(self, text_data):
    data = json.loads(text_data)
    message = data['message']

    # DB에 메시지 저장
    chat_message = await sync_to_async(ChatMessage.objects.create)(
        room_id=self.room_id,
        user_id=self.user_id,
        message=message,
        is_bot=False
    )

    # Agent 실행 (비동기)
    await sync_to_async(self.run_agent)(message)

def run_agent(self, message):
    agent = TravelAgent(
        room_id=self.room_id,
        user_id=self.user_id,
        trip_idx=self.trip_idx
    )

    # Agent 실행
    result = agent.run(message)

    # WebSocket으로 응답 전송
    async_to_sync(self.channel_layer.group_send)(
        f'chat_{self.room_id}',
        {
            'type': 'chat_message',
            'message': result,
            'is_bot': True
        }
    )
```

### 3. Agent 실행 프로세스

**`TravelAgent.run()` 메서드**:

```python
def run(self, query: str) -> str:
    start_time = time.time()

    try:
        # Step 1: 의도 분류
        intent_start = time.time()
        intent_info = self.classify_intent_with_llm(query)
        intent_time = time.time() - intent_start

        request_type = intent_info['type']
        confidence = intent_info['confidence']

        logger.info(f"🎯 분류된 의도: {request_type} (신뢰도: {confidence}%)")

        # Step 2: Tool 매핑
        tool_name = self.map_intent_to_tool(request_type, query)
        logger.info(f"🔧 선택된 Tool: {tool_name}")

        # Step 3: Agent 실행
        agent_start = time.time()
        agent_executor = AgentExecutor(
            agent=self.agent,
            tools=self.tools,
            verbose=True,
            max_iterations=5,
            handle_parsing_errors=True
        )

        # Tool 실행 및 결과 수집
        result = agent_executor.invoke({
            "input": query,
            "chat_history": self._get_chat_history(),
            "current_plan": self._get_current_plan_summary(),
            "selected_tool": tool_name
        })

        agent_time = time.time() - agent_start

        # Step 4: 응답 포맷팅
        formatted_response = self._format_response(
            result['output'],
            request_type,
            tool_name
        )

        # Step 5: 성능 로깅
        total_time = time.time() - start_time
        self._log_performance(
            query=query,
            intent=request_type,
            tool=tool_name,
            total_time=total_time,
            intent_time=intent_time,
            agent_time=agent_time,
            success=True
        )

        return formatted_response

    except Exception as e:
        logger.error(f"❌ Agent 실행 오류: {str(e)}")
        self._log_performance(
            query=query,
            intent="ERROR",
            tool="",
            total_time=time.time() - start_time,
            success=False,
            error_message=str(e)
        )
        return f"죄송합니다. 오류가 발생했습니다: {str(e)}"
```

---

## 의도 분류 시스템

### 10가지 의도 유형

**파일**: `backend/apps/chat/agent.py:classify_intent_with_llm()`

```python
INTENT_TYPES = {
    'PLACE_RECOMMENDATION': {
        'description': '특정 지역의 여행지/장소 추천 요청',
        'examples': [
            '서울 맛집 추천해줘',
            '강릉 가볼만한 곳',
            '제주도 카페 알려줘'
        ],
        'keywords': ['추천', '알려줘', '소개', '가볼만한']
    },
    'SCHEDULE_PLANNING': {
        'description': '전체 일정 계획 수립 요청 (N박N일)',
        'examples': [
            '부산 2박3일 일정 짜줘',
            '강원도 1박2일 계획',
            '제주도 3박4일 여행 플랜'
        ],
        'keywords': ['일정', '계획', '플랜', '짜줘', '박', '일']
    },
    'SCHEDULE_ADD': {
        'description': '기존 일정에 특정 장소/활동 추가',
        'examples': [
            '내일 오후에 카페 추가해줘',
            '첫째 날 저녁에 레스토랑 넣어줘',
            '2일차에 박물관 일정 추가'
        ],
        'keywords': ['추가', '넣어줘', '포함', '일차', '날']
    },
    'SCHEDULE_MODIFY': {
        'description': '기존 일정 수정/변경',
        'examples': [
            '첫째 날 일정 시간 바꿔줘',
            '2일차 점심 장소 변경',
            '일정 순서 조정해줘'
        ],
        'keywords': ['수정', '변경', '바꿔', '조정', '옮겨']
    },
    'SCHEDULE_DELETE': {
        'description': '일정 삭제',
        'examples': [
            '오늘 저녁 일정 삭제해줘',
            '2일차 카페 빼줘',
            '마지막 날 일정 지워줘'
        ],
        'keywords': ['삭제', '제거', '빼줘', '지워']
    },
    'WEATHER_INQUIRY': {
        'description': '날씨 정보 문의',
        'examples': [
            '내일 서울 날씨 어때?',
            '주말 부산 날씨',
            '다음주 제주도 기온'
        ],
        'keywords': ['날씨', '기온', '강수', '비', '눈']
    },
    'BUDGET_INQUIRY': {
        'description': '예산/비용 관련 문의',
        'examples': [
            '총 예산 얼마야?',
            '숙박비 계산해줘',
            '식비 예상 금액'
        ],
        'keywords': ['예산', '비용', '금액', '가격', '얼마']
    },
    'PLACE_SEARCH': {
        'description': '특정 장소 검색/정보 조회',
        'examples': [
            '경복궁 정보 알려줘',
            'N서울타워 위치',
            '해운대 해수욕장 영업시간'
        ],
        'keywords': ['정보', '위치', '주소', '영업시간', '어디']
    },
    'PLAN_STATUS': {
        'description': '현재 계획 조회/확인',
        'examples': [
            '지금까지 계획 보여줘',
            '현재 일정 알려줘',
            '플랜 전체 확인'
        ],
        'keywords': ['현재', '지금', '전체', '확인', '보여줘']
    },
    'GENERAL_CHAT': {
        'description': '일반 대화/질문',
        'examples': [
            '안녕',
            '고마워',
            '여행 팁 알려줘'
        ],
        'keywords': ['안녕', '고마워', '감사', '팁']
    }
}
```

### 의도 분류 프롬프트

```python
def classify_intent_with_llm(self, query: str) -> dict:
    """
    GPT-4를 사용하여 사용자 의도를 분류합니다.

    Returns:
        {
            'type': 'PLACE_RECOMMENDATION',
            'confidence': 95,
            'reasoning': '사용자가 특정 지역(홍천)의 여행지 추천을 요청함'
        }
    """

    classification_prompt = f"""
당신은 여행 플래너 챗봇의 의도 분류 전문가입니다.
사용자의 입력을 분석하여 다음 10가지 의도 중 하나로 분류하세요.

## 의도 유형:
{json.dumps(INTENT_TYPES, ensure_ascii=False, indent=2)}

## 사용자 입력:
"{query}"

## 분류 기준:
1. 키워드 매칭
2. 문맥 분석
3. 사용자 의도 추론

## 응답 형식 (JSON):
{{
    "type": "INTENT_TYPE",
    "confidence": 0-100,
    "reasoning": "분류 근거 설명"
}}
"""

    response = self.llm.invoke(classification_prompt)
    result = json.loads(response.content)

    return result
```

### 의도별 처리 예시

#### 1. PLACE_RECOMMENDATION (장소 추천)
```
입력: "홍천 가볼만한 곳 추천해줘"

의도 분류:
{
    "type": "PLACE_RECOMMENDATION",
    "confidence": 95,
    "reasoning": "홍천 지역의 관광지 추천 요청"
}

선택된 Tool: recommend_place
Tool 입력: {
    "location": "홍천",
    "preferences": ["관광지", "명소"],
    "count": 5
}

Tool 출력:
- 홍천 은행나무숲
- 수타사
- 레전드히어로즈
- 홍천강
- 공작산

응답 형식: "[AI_RECOMMENDATION]\n추천 장소 리스트..."
```

#### 2. SCHEDULE_PLANNING (일정 계획)
```
입력: "강릉 1박2일 일정 짜줘"

의도 분류:
{
    "type": "SCHEDULE_PLANNING",
    "confidence": 98,
    "reasoning": "1박2일 전체 일정 계획 수립 요청"
}

선택된 Tool: recommend_and_add_to_planner (RAG)

처리 과정:
1. 날짜 파싱: "1박2일" → 2일
2. RAG 검색: "강릉 여행" 관련 벡터 검색
3. 유사도 높은 장소 5-10개 추출
4. Kakao API로 좌표 검색
5. 일정 최적화 (시간, 동선 고려)
6. DB에 Day/Item 자동 저장
7. WebSocket으로 planner_update 전송

응답 형식: "[RAG_RECOMMENDATION]\n✨ 강릉 1박2일 일정을 추가했습니다!"
```

#### 3. WEATHER_INQUIRY (날씨 조회)
```
입력: "내일 서울 날씨 어때?"

의도 분류:
{
    "type": "WEATHER_INQUIRY",
    "confidence": 100,
    "reasoning": "날씨 정보 조회 요청"
}

선택된 Tool: get_weather
Tool 입력: {
    "location": "서울",
    "date": "2025-01-20"
}

Tool 출력:
{
    "temperature": "5°C",
    "sky": "맑음",
    "precipitation": "0%",
    "humidity": "45%"
}

응답: "내일 서울 날씨는 맑음이며, 기온은 5°C입니다. ☀️"
```

---

## Tool 실행 메커니즘

### LangChain Tool 정의

**파일**: `backend/apps/chat/agent.py`

```python
from langchain.tools import tool

@tool
def recommend_place(location: str, preferences: list = None, count: int = 5) -> str:
    """
    특정 지역의 여행지를 추천합니다.

    Args:
        location: 지역명 (예: "서울", "부산")
        preferences: 선호 유형 (예: ["맛집", "카페", "관광지"])
        count: 추천 개수

    Returns:
        추천 장소 리스트 (JSON 문자열)
    """
    try:
        # 1. RAG 검색
        rag_system = RAGSystem()
        results = rag_system.search(
            query=f"{location} {' '.join(preferences or [])}",
            top_k=count,
            filters={'region': location}
        )

        # 2. 결과 포맷팅
        recommendations = []
        for result in results:
            recommendations.append({
                'name': result['place_name'],
                'address': result['address'],
                'category': result['category'],
                'description': result['description'],
                'similarity_score': result['score']
            })

        return json.dumps(recommendations, ensure_ascii=False)

    except Exception as e:
        logger.error(f"recommend_place 오류: {e}")
        return json.dumps({'error': str(e)})
```

### Tool 실행 흐름

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent Executor                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
         ┌─────────────────────────────┐
         │   Tool Selection            │
         │  (의도 기반 매핑)            │
         └─────────────┬───────────────┘
                       │
                       ▼
         ┌─────────────────────────────┐
         │   Tool 입력 파라미터 추출    │
         │  (LLM이 자동 생성)           │
         └─────────────┬───────────────┘
                       │
                       ▼
         ┌─────────────────────────────┐
         │   Tool 실행                  │
         │  - Python 함수 호출          │
         │  - DB 쿼리                   │
         │  - 외부 API 호출             │
         └─────────────┬───────────────┘
                       │
                       ▼
         ┌─────────────────────────────┐
         │   Tool 결과 수집             │
         │  (JSON, 문자열 등)           │
         └─────────────┬───────────────┘
                       │
                       ▼
         ┌─────────────────────────────┐
         │   LLM 응답 생성              │
         │  (Tool 결과 기반)            │
         └─────────────┬───────────────┘
                       │
                       ▼
         ┌─────────────────────────────┐
         │   최종 응답 반환             │
         └─────────────────────────────┘
```

---

## 각 Tool 상세 설명

### 1. recommend_place (장소 추천)

**기능**: RAG 기반 장소 추천

**입력**:
```python
{
    "location": "홍천",
    "preferences": ["관광지", "자연"],
    "count": 5
}
```

**처리**:
1. RAG 벡터 검색 (`rag.py:search()`)
2. pgvector로 유사도 검색
3. 상위 N개 결과 추출

**출력**:
```json
[
    {
        "name": "홍천 은행나무숲",
        "address": "강원 홍천군...",
        "category": "관광지",
        "description": "가을 단풍 명소",
        "similarity_score": 0.95
    },
    ...
]
```

### 2. recommend_and_add_to_planner (일정 생성 + RAG)

**기능**: RAG 검색 → 일정 생성 → DB 저장 → 좌표 검색

**입력**:
```python
{
    "query": "강릉 1박2일",
    "trip_idx": 5,
    "auto_add": True
}
```

**처리 단계**:

#### Step 1: 날짜 파싱
```python
duration_pattern = r'(\d+)박\s*(\d+)일'
match = re.search(duration_pattern, query)
if match:
    nights = int(match.group(1))
    days = int(match.group(2))
```

#### Step 2: 지역명 추출
```python
region_pattern = r'^([가-힣]+)'
region_match = re.search(region_pattern, query.strip())
region_name = region_match.group(1) if region_match else None
```

#### Step 3: RAG 검색
```python
rag_system = RAGSystem()
results = rag_system.search(
    query=f"{region_name} 여행 추천",
    top_k=10,
    filters={'region_name': region_name}
)
```

#### Step 4: LLM으로 일정 정제
```python
refinement_prompt = f"""
다음 RAG 검색 결과를 바탕으로 {days}일 일정을 구성하세요.

검색 결과:
{json.dumps(results, ensure_ascii=False)}

요구사항:
- {days}일 일정
- 각 날짜별 5-7개 장소
- 시간대별 배치 (아침/점심/저녁)
- 이동 동선 고려

출력 형식 (JSON):
[
    {{
        "day": 1,
        "date": "2025-01-20",
        "items": [
            {{
                "time": "09:00",
                "place": "경포대",
                "reason": "아침 산책하기 좋음",
                "category": "관광지"
            }},
            ...
        ]
    }},
    ...
]
"""

response = llm.invoke(refinement_prompt)
enriched_plan = json.loads(response.content)
```

#### Step 5: Kakao API로 좌표 검색
```python
for day in enriched_plan:
    for item in day['items']:
        # 지역명 prefix 추가
        search_query = f"{region_name} {item['place']}"

        # Kakao API 검색
        response = requests.get(
            'https://dapi.kakao.com/v2/local/search/keyword.json',
            headers={'Authorization': f'KakaoAK {KAKAO_API_KEY}'},
            params={'query': search_query, 'size': 1}
        )

        if response.json()['documents']:
            place_data = response.json()['documents'][0]
            item['latitude'] = float(place_data['y'])
            item['longitude'] = float(place_data['x'])
            item['address'] = place_data['address_name']
```

#### Step 6: DB 저장
```python
for day_data in enriched_plan:
    # Day 생성
    day_obj = Day.objects.create(
        trip_idx=trip_idx,
        day_no=day_data['day'],
        date=day_data['date']
    )

    # Item 생성
    for idx, item in enumerate(day_data['items']):
        Item.objects.create(
            day_idx=day_obj,
            order=idx + 1,
            time=item['time'],
            location=item['place'],
            description=item['reason'],
            latitude=item.get('latitude'),
            longitude=item.get('longitude')
        )
```

#### Step 7: WebSocket 전송
```python
# 프론트엔드로 planner_update 이벤트 전송
channel_layer.group_send(
    f'chat_{room_id}',
    {
        'type': 'planner_update',
        'action': 'add_schedule',
        'data': {
            'days': enriched_plan,
            'trip_idx': trip_idx
        }
    }
)
```

**출력**:
```
[RAG_RECOMMENDATION]
✨ '강릉 1박2일' 추천 결과를 플래너에 추가했습니다!

📅 Day 1 (2025-01-20)
09:00 - 경포대 (아침 산책)
12:00 - 초당순두부거리 (점심)
14:00 - 오죽헌 (관광)
17:00 - 안목해변 (카페거리)
19:00 - 강릉중앙시장 (저녁)

📅 Day 2 (2025-01-21)
09:00 - 주문진해변 (아침 산책)
11:00 - 하슬라아트월드 (관광)
13:00 - 정동진 (점심)
```

### 3. get_weather (날씨 조회)

**기능**: 기상청 API 또는 DB에서 날씨 정보 조회

**입력**:
```python
{
    "location": "서울",
    "date": "2025-01-20"
}
```

**처리**:
```python
@tool
def get_weather(location: str, date: str = None) -> str:
    """날씨 정보를 조회합니다."""

    # 1. 좌표 변환 (지역명 → 위경도)
    coords = get_coordinates(location)

    # 2. 격자 좌표 변환 (위경도 → 격자 X, Y)
    grid_x, grid_y = convert_to_grid(coords['lat'], coords['lon'])

    # 3. DB에서 날씨 조회 (Airflow가 주기적으로 수집)
    weather = Weather.objects.filter(
        grid_x=grid_x,
        grid_y=grid_y,
        forecast_date=date
    ).first()

    if weather:
        return f"""
        📍 {location} 날씨 ({date})
        🌡️ 기온: {weather.temperature}°C
        ☁️ 하늘: {weather.sky_status}
        💧 강수확률: {weather.precipitation_probability}%
        💨 풍속: {weather.wind_speed}m/s
        """
    else:
        return "날씨 정보를 찾을 수 없습니다."
```

### 4. add_schedule_item (일정 추가)

**기능**: 기존 일정에 특정 장소 추가

**입력**:
```python
{
    "day_no": 1,
    "time": "15:00",
    "location": "카페",
    "description": "휴식"
}
```

**처리**:
```python
@tool
def add_schedule_item(day_no: int, time: str, location: str, description: str = "") -> str:
    """일정에 항목을 추가합니다."""

    # 1. Day 조회
    day = Day.objects.filter(
        trip_idx=self.trip_idx,
        day_no=day_no
    ).first()

    if not day:
        return f"❌ {day_no}일차를 찾을 수 없습니다."

    # 2. Kakao API로 장소 검색
    place_data = search_kakao_place(location)

    # 3. Item 생성
    max_order = Item.objects.filter(day_idx=day).aggregate(
        Max('order')
    )['order__max'] or 0

    item = Item.objects.create(
        day_idx=day,
        order=max_order + 1,
        time=time,
        location=place_data['name'],
        description=description,
        latitude=place_data['latitude'],
        longitude=place_data['longitude']
    )

    # 4. WebSocket 전송
    send_planner_update('add_item', item)

    return f"✅ {day_no}일차 {time}에 '{location}'을(를) 추가했습니다."
```

### 5. get_current_plan (현재 플랜 조회)

**기능**: 현재 여행 계획 요약 조회

**입력**: 없음 (trip_idx 자동 사용)

**처리**:
```python
@tool
def get_current_plan() -> str:
    """현재 여행 계획을 조회합니다."""

    trip = Trip.objects.get(idx=self.trip_idx)
    days = Day.objects.filter(trip_idx=trip).order_by('day_no')

    summary = f"📋 {trip.title}\n"
    summary += f"📅 {trip.start_date} ~ {trip.end_date}\n\n"

    for day in days:
        items = Item.objects.filter(day_idx=day).order_by('order')
        summary += f"Day {day.day_no} ({day.date}):\n"

        for item in items:
            summary += f"  {item.time} - {item.location}\n"

        summary += "\n"

    return summary
```

---

## 응답 생성 및 전송

### 응답 마커 시스템

프론트엔드가 응답 유형을 구분할 수 있도록 마커를 사용합니다.

```python
RESPONSE_MARKERS = {
    'RAG_RECOMMENDATION': '[RAG_RECOMMENDATION]',  # RAG 일정 추천
    'AI_RECOMMENDATION': '[AI_RECOMMENDATION]',    # 장소 추천 (UI 패널 표시)
    'WEATHER': '[WEATHER]',                        # 날씨 정보
    'GENERAL': ''                                   # 일반 응답
}
```

### 응답 포맷팅

```python
def _format_response(self, output: str, intent: str, tool: str) -> str:
    """
    Tool 결과를 사용자 친화적인 형식으로 변환합니다.
    """

    if intent == 'SCHEDULE_PLANNING' and tool == 'recommend_and_add_to_planner':
        # RAG 일정 추천 응답
        return f"[RAG_RECOMMENDATION]\n{output}"

    elif intent == 'PLACE_RECOMMENDATION':
        # AI 장소 추천 응답 (하단 패널 표시)
        return f"[AI_RECOMMENDATION]\n{output}"

    elif intent == 'WEATHER_INQUIRY':
        # 날씨 응답
        return f"[WEATHER]\n{output}"

    else:
        # 일반 응답
        return output
```

### WebSocket 전송

**Consumer** (`consumers.py`):

```python
async def chat_message(self, event):
    """
    Agent에서 생성된 응답을 WebSocket으로 전송합니다.
    """

    message = event['message']
    is_bot = event['is_bot']

    # 클라이언트로 전송
    await self.send(text_data=json.dumps({
        'type': 'chat_message',
        'message': message,
        'is_bot': is_bot,
        'timestamp': datetime.now().isoformat()
    }))

async def planner_update(self, event):
    """
    플래너 업데이트 이벤트를 WebSocket으로 전송합니다.
    """

    await self.send(text_data=json.dumps({
        'type': 'planner_update',
        'action': event['action'],
        'data': event['data']
    }))
```

**Frontend 수신** (`planner.tsx`):

```typescript
useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8001/ws/chat/${roomId}/`);

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'chat_message') {
            // 채팅 메시지 처리
            setChatMessages(prev => [...prev, {
                text: data.message,
                isBot: data.is_bot
            }]);

            // 마커에 따라 UI 업데이트
            if (data.message.startsWith('[AI_RECOMMENDATION]')) {
                // AI 추천 장소 패널 표시
                setShowRecommendationPanel(true);
            } else if (data.message.startsWith('[RAG_RECOMMENDATION]')) {
                // RAG 일정은 패널 표시 안 함 (이미 플래너에 추가됨)
                setShowRecommendationPanel(false);
            }
        }

        if (data.type === 'planner_update') {
            // 플래너 UI 업데이트
            if (data.action === 'add_schedule') {
                setSchedule(data.data.days);
                // 지도 마커도 자동 업데이트
            }
        }
    };
}, [roomId]);
```

---

## 성능 로깅

### BotPerformanceLog 모델

**파일**: `backend/apps/chat/models_performance.py`

```python
class BotPerformanceLog(models.Model):
    room_idx = models.ForeignKey(ChatRoom, on_delete=models.CASCADE)
    user_message = models.TextField()
    detected_intent = models.CharField(max_length=50)
    tool_used = models.CharField(max_length=100, blank=True)

    # 성능 메트릭
    total_time = models.FloatField(help_text="총 실행 시간 (초)")
    llm_time = models.FloatField(null=True, help_text="LLM 호출 시간")
    tool_time = models.FloatField(null=True, help_text="Tool 실행 시간")
    rag_time = models.FloatField(null=True, help_text="RAG 검색 시간")

    # 결과
    success = models.BooleanField(default=True)
    error_message = models.TextField(blank=True)
    response_length = models.IntegerField(default=0)

    # 메타데이터
    metadata = models.JSONField(default=dict, help_text="추가 정보")

    created_at = models.DateTimeField(auto_now_add=True)
```

### 성능 로깅 구현

```python
def _log_performance(self, query, intent, tool, total_time,
                     intent_time=0, agent_time=0, success=True, error_message=""):
    """
    성능 로그를 기록합니다.
    """

    BotPerformanceLog.objects.create(
        room_idx_id=self.room_id,
        user_message=query,
        detected_intent=intent,
        tool_used=tool,
        total_time=total_time,
        llm_time=intent_time,
        tool_time=agent_time,
        success=success,
        error_message=error_message,
        metadata={
            'model': settings.OPENAI_MODEL,
            'timestamp': datetime.now().isoformat()
        }
    )
```

### 관리자 대시보드에서 확인

**API**: `GET /api/chat/admin/performance/stats/`

**응답**:
```json
{
    "stats": {
        "total_requests": 1523,
        "avg_response_time": 2.35,
        "avg_llm_time": 1.2,
        "avg_tool_time": 0.8,
        "success_rate": 98.5
    },
    "intent_breakdown": {
        "PLACE_RECOMMENDATION": 450,
        "SCHEDULE_PLANNING": 380,
        "WEATHER_INQUIRY": 200,
        ...
    },
    "tool_usage": {
        "recommend_place": 450,
        "recommend_and_add_to_planner": 380,
        "get_weather": 200,
        ...
    }
}
```

---

## 에러 처리

### Try-Except 블록

```python
def run(self, query: str) -> str:
    try:
        # Agent 실행
        result = self.agent.invoke(query)
        return result

    except OpenAIError as e:
        logger.error(f"OpenAI API 오류: {e}")
        return "죄송합니다. AI 서비스에 일시적인 문제가 발생했습니다."

    except ToolException as e:
        logger.error(f"Tool 실행 오류: {e}")
        return f"작업 수행 중 오류가 발생했습니다: {str(e)}"

    except Exception as e:
        logger.error(f"예상치 못한 오류: {e}", exc_info=True)
        self._log_performance(
            query=query,
            intent="ERROR",
            tool="",
            total_time=0,
            success=False,
            error_message=str(e)
        )
        return "죄송합니다. 요청을 처리하는 중 오류가 발생했습니다."
```

### Timeout 처리

```python
from functools import wraps
import signal

def timeout(seconds):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            def timeout_handler(signum, frame):
                raise TimeoutError(f"실행 시간 초과 ({seconds}초)")

            signal.signal(signal.SIGALRM, timeout_handler)
            signal.alarm(seconds)

            try:
                result = func(*args, **kwargs)
            finally:
                signal.alarm(0)

            return result
        return wrapper
    return decorator

@timeout(30)  # 30초 제한
def run(self, query: str) -> str:
    # Agent 실행...
    pass
```

---

**마지막 업데이트**: 2025-01-19
**문서 버전**: 1.0.0
