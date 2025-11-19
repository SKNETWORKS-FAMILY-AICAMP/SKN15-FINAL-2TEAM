# Triplan 시스템 아키텍처 상세 문서

## 목차
1. [시스템 개요](#시스템-개요)
2. [전체 아키텍처](#전체-아키텍처)
3. [프론트엔드 아키텍처](#프론트엔드-아키텍처)
4. [백엔드 아키텍처](#백엔드-아키텍처)
5. [데이터베이스 스키마](#데이터베이스-스키마)
6. [WebSocket 통신](#websocket-통신)
7. [AI/ML 파이프라인](#aiml-파이프라인)
8. [외부 API 통합](#외부-api-통합)
9. [보안 및 인증](#보안-및-인증)
10. [성능 및 확장성](#성능-및-확장성)

---

## 시스템 개요

**Triplan**은 AI 기반 협업 여행 플래너로, 다음과 같은 핵심 기능을 제공합니다:

### 핵심 기능
- **AI 챗봇 기반 여행 계획**: GPT-4를 활용한 자연어 대화형 플래너
- **RAG 기반 맞춤 추천**: 벡터 검색으로 사용자 맥락에 맞는 여행지 추천
- **실시간 협업**: WebSocket 기반 다중 사용자 동시 편집
- **지도 시각화**: Kakao Map API 통합 장소 검색 및 마커 표시
- **날씨 정보**: 기상청 API 연동 실시간 날씨 제공
- **관리자 대시보드**: 성능 모니터링, 사용자 관리, RAG 테스트

### 기술 스택 요약

| 계층 | 기술 |
|------|------|
| Frontend | Next.js 14, TypeScript, Material-UI, Kakao Maps SDK |
| Backend | Django 4.2, Django REST Framework, Django Channels |
| Database | PostgreSQL 15 + pgvector |
| Cache | Redis 7 |
| AI/ML | OpenAI GPT-4, LangChain, sentence-transformers |
| Workflow | Apache Airflow 2.7 |
| Deployment | Docker, Docker Compose, Nginx |
| Cloud | AWS EC2, S3 (선택) |

---

## 전체 아키텍처

### 7-Instance 프로덕션 아키텍처

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Client Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   Browser    │  │    Mobile    │  │    Tablet    │              │
│  │  (Desktop)   │  │   (Future)   │  │   (Future)   │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                 │                        │
│         └─────────────────┴─────────────────┘                        │
│                           │                                          │
└───────────────────────────┼──────────────────────────────────────────┘
                            │
                            │ HTTPS (443) / WSS
                            │
┌───────────────────────────▼──────────────────────────────────────────┐
│                     Instance #1: Nginx Proxy                         │
│  - SSL Termination (Let's Encrypt)                                  │
│  - Load Balancing                                                    │
│  - Request Routing (triplan.com, api.triplan.com, ws.triplan.com)   │
│  Port: 80, 443                                                       │
└───────────────────────────┬──────────────────────────────────────────┘
                            │
                ┌───────────┼──────────────┬──────────────┐
                │           │              │              │
┌───────────────▼──┐  ┌─────▼──────┐  ┌───▼──────────┐  ┌▼──────────┐
│  Instance #2     │  │Instance #3 │  │ Instance #6  │  │Instance #5│
│  Frontend        │  │  Backend   │  │  WebSocket   │  │  Airflow  │
│  Next.js         │  │  Django    │  │  Channels    │  │Full Stack │
│  (SSR/SSG)       │  │  REST API  │  │  (ASGI)      │  │Scheduler+ │
│                  │  │            │  │              │  │Webserver+ │
│  - Pages         │  │  - Auth    │  │  - Chat      │  │    DB     │
│  - Components    │  │  - Plans   │  │  - Collab    │  │           │
│  - State Mgmt    │  │  - Places  │  │  - Realtime  │  │Port: 8080 │
│  - API Calls     │  │  - AI Agent│  │              │  │           │
│  Port: 3000      │  │Port: 8000  │  │Port: 8001    │  │           │
└──────────────────┘  └────┬───────┘  └──────┬───────┘  └───────────┘
                           │                 │
                           │         ┌───────┴──────────┐
                           │         │                  │
                ┌──────────▼─────────▼──┐    ┌─────────▼─────────┐
                │   Instance #4         │    │  Instance #7      │
                │   Database            │    │  Redis Cache      │
                │   PostgreSQL 15       │    │                   │
                │   + pgvector          │    │  - Session Cache  │
                │                       │    │  - WS Channels    │
                │  - Users & Auth       │    │  - RAG Cache      │
                │  - Trips & Plans      │    │                   │
                │  - Places & Reviews   │    │  Port: 6379       │
                │  - Embeddings (RAG)   │    │                   │
                │  - Performance Logs   │    │                   │
                │  Port: 5432           │    │                   │
                └───────────────────────┘    └───────────────────┘
                            │
                            │
┌───────────────────────────▼──────────────────────────────────────────┐
│                      External Services                               │
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  OpenAI API  │  │  Kakao API   │  │  KMA API     │              │
│  │  - GPT-4     │  │  - Map       │  │  - Weather   │              │
│  │  - Embeddings│  │  - Search    │  │              │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└──────────────────────────────────────────────────────────────────────┘
```

### Instance 구성 요약

| Instance | 역할 | 서비스 | 포트 | EC2 타입 |
|----------|------|--------|------|----------|
| #1 | Nginx | 리버스 프록시, SSL | 80, 443 | t3.small |
| #2 | Frontend | Next.js 애플리케이션 | 3000 | t3.small |
| #3 | Backend | Django REST API | 8000 | t3.medium |
| #4 | Database | PostgreSQL + pgvector | 5432 | t3.medium |
| #5 | Airflow | Scheduler + Webserver + DB | 8080 | t3.medium |
| #6 | WebSocket | Django Channels | 8001 | t3.small |
| #7 | Redis | Cache + Channels | 6379 | t3.small |

---

## 프론트엔드 아키텍처

### 디렉토리 구조

```
frontend/
├── pages/                      # Next.js 페이지 (라우팅)
│   ├── index.tsx              # 랜딩 페이지
│   ├── login.tsx              # 로그인
│   ├── signup.tsx             # 회원가입
│   ├── planner.tsx            # 메인 플래너 (핵심)
│   ├── dashboard.tsx          # 관리자 대시보드
│   ├── _app.tsx               # App Wrapper
│   └── _document.tsx          # HTML Document
│
├── src/
│   ├── components/            # 재사용 가능한 컴포넌트
│   │   ├── Header.tsx         # 네비게이션 헤더
│   │   ├── KakaoMapSearch.tsx # 지도 + 마커
│   │   ├── planner/
│   │   │   ├── DateSelector.tsx
│   │   │   ├── ScheduleList.tsx
│   │   │   ├── PlaceSearchSidebar.tsx
│   │   │   └── UnifiedChatWidget.tsx  # AI 챗봇
│   │   └── admin/
│   │       ├── BotPerformanceMonitor.tsx
│   │       ├── RAGSystemTester.tsx
│   │       └── TripManagement.tsx
│   │
│   ├── hooks/                 # 커스텀 React Hooks
│   │   ├── useAuth.ts         # 인증 상태 관리
│   │   ├── useCollaborativeChat.ts  # WebSocket 채팅
│   │   └── usePlanner.ts      # 플래너 상태 관리
│   │
│   ├── services/              # API 통신 레이어
│   │   ├── api.ts             # Axios 인스턴스
│   │   ├── authAPI.ts         # 인증 API
│   │   ├── tripAPI.ts         # 여행 계획 API
│   │   └── chatAPI.ts         # 채팅 API
│   │
│   ├── types/                 # TypeScript 타입 정의
│   │   ├── auth.ts
│   │   ├── planner.ts
│   │   └── chat.ts
│   │
│   ├── utils/                 # 유틸리티 함수
│   │   ├── formatDate.ts
│   │   └── validators.ts
│   │
│   └── styles/                # 글로벌 스타일
│       └── globals.css
│
├── public/                    # 정적 파일
│   ├── images/
│   └── favicon.ico
│
├── .env.local                 # 환경 변수
├── next.config.js             # Next.js 설정
├── tsconfig.json              # TypeScript 설정
└── package.json               # 의존성
```

### 핵심 컴포넌트 설명

#### 1. planner.tsx (메인 플래너)

**역할**: 여행 계획의 중심 화면

**주요 기능**:
- 날짜 선택 및 일정 생성
- 장소 검색 및 추가 (Kakao API)
- 일정 드래그 앤 드롭
- AI 챗봇 통합
- 실시간 협업 (WebSocket)
- 지도 마커 동기화

**상태 관리**:
```typescript
const [trip, setTrip] = useState<Trip | null>(null);
const [schedule, setSchedule] = useState<DaySchedule[]>([]);
const [selectedDate, setSelectedDate] = useState<Date>(new Date());
const [mapMarkers, setMapMarkers] = useState<Marker[]>([]);
const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
```

**WebSocket 통합**:
```typescript
useEffect(() => {
    const ws = new WebSocket(`${WS_URL}/ws/chat/${roomId}/`);

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'planner_update') {
            // 다른 사용자의 일정 변경 반영
            setSchedule(data.data.days);
            updateMapMarkers(data.data.days);
        }

        if (data.type === 'chat_message') {
            // 챗봇 메시지 표시
            setChatMessages(prev => [...prev, data]);
        }
    };

    return () => ws.close();
}, [roomId]);
```

#### 2. KakaoMapSearch.tsx (지도 컴포넌트)

**역할**: Kakao Map 렌더링 및 마커 관리

**기능**:
- 지도 초기화 및 렌더링
- 스케줄 아이템별 마커 생성
- 마커 클릭 시 정보창 표시
- 좌표 캐싱 (중복 검색 방지)

**좌표 최적화**:
```typescript
// Backend에서 제공한 좌표 우선 사용
if (schedule.latitude && schedule.longitude) {
    // 검색 없이 바로 마커 생성
    const position = new kakao.maps.LatLng(
        schedule.latitude,
        schedule.longitude
    );
    createMarker(position, schedule);
} else {
    // Kakao API 검색
    ps.keywordSearch(schedule.location, (data, status) => {
        if (status === kakao.maps.services.Status.OK) {
            const position = new kakao.maps.LatLng(data[0].y, data[0].x);
            createMarker(position, schedule);
        }
    });
}
```

#### 3. UnifiedChatWidget.tsx (AI 챗봇)

**역할**: 사용자와 AI 간 대화 인터페이스

**기능**:
- 메시지 입력 및 전송
- 챗봇 응답 표시
- 응답 마커 처리 (`[RAG_RECOMMENDATION]`, `[AI_RECOMMENDATION]`)
- AI 추천 장소 패널 표시

**메시지 전송**:
```typescript
const sendMessage = (message: string) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.error('WebSocket not connected');
        return;
    }

    // UI 즉시 업데이트
    setChatMessages(prev => [...prev, {
        text: message,
        isBot: false,
        timestamp: new Date()
    }]);

    // WebSocket 전송
    ws.send(JSON.stringify({
        type: 'chat_message',
        message: message
    }));
};
```

**응답 마커 처리**:
```typescript
useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.text.startsWith('[AI_RECOMMENDATION]')) {
        // 장소 추천 패널 표시
        setShowRecommendationPanel(true);
        parseRecommendations(lastMessage.text);
    } else if (lastMessage.text.startsWith('[RAG_RECOMMENDATION]')) {
        // RAG 일정 추천 (패널 표시 안 함)
        setShowRecommendationPanel(false);
    }
}, [lastMessage]);
```

### 상태 관리 전략

**Global State**: Context API 또는 Zustand (선택적)
```typescript
// AuthContext
const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        // localStorage에서 토큰 복원
        const savedToken = localStorage.getItem('token');
        if (savedToken) {
            setToken(savedToken);
            fetchUser(savedToken);
        }
    }, []);

    const login = async (email: string, password: string) => {
        const response = await authAPI.login(email, password);
        setToken(response.token);
        setUser(response.user);
        localStorage.setItem('token', response.token);
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
```

**Local State**: useState (컴포넌트 내부)

**Server State**: React Query (선택적, 미사용 시 useEffect + fetch)

---

## 백엔드 아키텍처

### 디렉토리 구조

```
backend/
├── apps/                          # Django 앱들
│   ├── accounts/                  # 사용자 인증
│   │   ├── models.py              # User 모델
│   │   ├── serializers.py         # DRF Serializers
│   │   ├── views.py               # 회원가입/로그인 API
│   │   └── urls.py
│   │
│   ├── plans/                     # 여행 계획
│   │   ├── models.py              # Trip, Day, Item
│   │   ├── serializers.py
│   │   ├── views.py               # CRUD API
│   │   ├── tasks.py               # Celery 태스크 (미래)
│   │   └── urls.py
│   │
│   ├── places/                    # 장소 정보
│   │   ├── models.py              # Place
│   │   ├── serializers.py
│   │   ├── views.py
│   │   └── urls.py
│   │
│   ├── chat/                      # AI 챗봇
│   │   ├── models.py              # ChatRoom, ChatMessage
│   │   ├── models_performance.py  # BotPerformanceLog, RAGTestLog
│   │   ├── serializers.py
│   │   ├── serializers_admin.py
│   │   ├── views.py               # 채팅 API
│   │   ├── views_admin.py         # 관리자 API
│   │   ├── consumers.py           # WebSocket Consumer
│   │   ├── agent.py               # TravelAgent (LangChain)
│   │   ├── prompts/
│   │   │   ├── v1.py              # Agent 프롬프트
│   │   │   └── tool_descriptions.py
│   │   ├── security.py            # 보안 검증
│   │   ├── middleware.py          # WebSocket 미들웨어
│   │   └── urls.py
│   │
│   ├── ai/                        # RAG 시스템
│   │   ├── models.py              # PlaceEmbedding
│   │   ├── rag.py                 # RAGSystem 클래스
│   │   ├── views.py
│   │   ├── management/
│   │   │   └── commands/
│   │   │       └── create_embeddings.py
│   │   └── migrations/
│   │
│   └── weather/                   # 날씨 정보
│       ├── models.py              # Weather
│       ├── views.py
│       ├── management/
│       │   └── commands/
│       │       └── fetch_kma_daily.py
│       └── urls.py
│
├── config/                        # Django 설정
│   ├── settings/
│   │   ├── base.py                # 공통 설정
│   │   ├── development.py         # 개발 환경
│   │   └── production.py          # 프로덕션 환경
│   ├── urls.py                    # URL 라우팅
│   ├── asgi.py                    # ASGI (WebSocket)
│   └── wsgi.py                    # WSGI (HTTP)
│
├── staticfiles/                   # 정적 파일
├── media/                         # 업로드 파일
├── logs/                          # 로그 파일
├── requirements.txt               # Python 의존성
├── Dockerfile                     # Docker 이미지
└── manage.py                      # Django CLI
```

### Django 앱 상세 설명

#### 1. accounts (사용자 인증)

**모델**:
```python
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager

class UserManager(BaseUserManager):
    def create_user(self, email, username, password=None):
        user = self.model(email=self.normalize_email(email), username=username)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, username, password):
        user = self.create_user(email, username, password)
        user.is_admin = True
        user.is_staff = True
        user.save(using=self._db)
        return user

class User(AbstractBaseUser):
    email = models.EmailField(unique=True, max_length=255)
    username = models.CharField(max_length=150)
    is_active = models.BooleanField(default=True)
    is_admin = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']
```

**API 엔드포인트**:
```python
# POST /api/accounts/signup/
class SignupView(APIView):
    def post(self, request):
        serializer = UserSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            token = RefreshToken.for_user(user)
            return Response({
                'user': UserSerializer(user).data,
                'access': str(token.access_token),
                'refresh': str(token)
            })
        return Response(serializer.errors, status=400)

# POST /api/accounts/login/
class LoginView(APIView):
    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')

        user = authenticate(username=email, password=password)
        if user:
            token = RefreshToken.for_user(user)
            return Response({
                'user': UserSerializer(user).data,
                'access': str(token.access_token),
                'refresh': str(token)
            })
        return Response({'error': 'Invalid credentials'}, status=401)
```

#### 2. plans (여행 계획)

**모델**:
```python
class Trip(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    start_date = models.DateField()
    end_date = models.DateField()
    code = models.CharField(max_length=10, unique=True)  # 공유 코드
    is_public = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def generate_code(self):
        """6자리 랜덤 코드 생성"""
        import random, string
        return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

class Day(models.Model):
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='days')
    day_no = models.IntegerField()
    date = models.DateField()

    class Meta:
        unique_together = ['trip', 'day_no']
        ordering = ['day_no']

class Item(models.Model):
    day = models.ForeignKey(Day, on_delete=models.CASCADE, related_name='items')
    order = models.IntegerField()
    time = models.TimeField()
    location = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    latitude = models.FloatField(null=True)
    longitude = models.FloatField(null=True)

    class Meta:
        unique_together = ['day', 'order']
        ordering = ['order']
```

**API 엔드포인트**:
```python
# GET /api/plans/trips/
# POST /api/plans/trips/
class TripViewSet(viewsets.ModelViewSet):
    serializer_class = TripSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Trip.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        trip = serializer.save(user=self.request.user)
        trip.code = trip.generate_code()
        trip.save()

# GET /api/plans/trips/{id}/days/
# POST /api/plans/days/
class DayViewSet(viewsets.ModelViewSet):
    serializer_class = DaySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        trip_id = self.request.query_params.get('trip_idx')
        return Day.objects.filter(trip__id=trip_id, trip__user=self.request.user)

# POST /api/plans/items/
# PATCH /api/plans/items/{id}/
# DELETE /api/plans/items/{id}/
class ItemViewSet(viewsets.ModelViewSet):
    serializer_class = ItemSerializer
    permission_classes = [IsAuthenticated]
```

#### 3. chat (AI 챗봇 & WebSocket)

**Consumer** (WebSocket 핸들러):
```python
# backend/apps/chat/consumers.py
from channels.generic.websocket import AsyncWebsocketConsumer
import json

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f'chat_{self.room_id}'

        # 그룹 참여
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()
        logger.info(f"WebSocket connected: room {self.room_id}")

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        data = json.loads(text_data)
        message = data['message']

        # DB 저장
        chat_message = await sync_to_async(ChatMessage.objects.create)(
            room_id=self.room_id,
            user_id=self.user_id,
            message=message,
            is_bot=False
        )

        # Agent 실행 (비동기)
        await sync_to_async(self.run_agent)(message)

    def run_agent(self, message):
        """TravelAgent 실행 (동기 함수)"""
        agent = TravelAgent(
            room_id=self.room_id,
            user_id=self.user_id,
            trip_idx=self.trip_idx
        )

        result = agent.run(message)

        # 응답 전송
        async_to_sync(self.channel_layer.group_send)(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message': result,
                'is_bot': True
            }
        )

    async def chat_message(self, event):
        """그룹 메시지 수신 핸들러"""
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': event['message'],
            'is_bot': event['is_bot']
        }))

    async def planner_update(self, event):
        """플래너 업데이트 이벤트"""
        await self.send(text_data=json.dumps({
            'type': 'planner_update',
            'action': event['action'],
            'data': event['data']
        }))
```

**Agent** (LangChain 기반):
```python
# backend/apps/chat/agent.py
from langchain.agents import create_react_agent, AgentExecutor
from langchain.tools import tool
from langchain_openai import ChatOpenAI

class TravelAgent:
    def __init__(self, room_id, user_id, trip_idx):
        self.room_id = room_id
        self.user_id = user_id
        self.trip_idx = trip_idx

        self.llm = ChatOpenAI(
            model=settings.OPENAI_MODEL,
            temperature=0.7
        )

        self.tools = [
            self.recommend_place,
            self.search_place,
            self.add_schedule_item,
            self.get_weather,
            self.get_current_plan
        ]

        self.agent = create_react_agent(
            llm=self.llm,
            tools=self.tools,
            prompt=self._create_prompt()
        )

    @tool
    def recommend_place(self, location: str, count: int = 5):
        """장소를 추천합니다."""
        rag = RAGSystem()
        results = rag.search(location, top_k=count)
        return json.dumps(results, ensure_ascii=False)

    def run(self, query: str) -> str:
        """Agent 실행"""
        try:
            # 의도 분류
            intent = self.classify_intent_with_llm(query)

            # Tool 선택
            tool_name = self.map_intent_to_tool(intent['type'], query)

            # Agent 실행
            executor = AgentExecutor(
                agent=self.agent,
                tools=self.tools,
                max_iterations=5
            )

            result = executor.invoke({
                "input": query,
                "selected_tool": tool_name
            })

            return result['output']

        except Exception as e:
            logger.error(f"Agent error: {e}")
            return "죄송합니다. 오류가 발생했습니다."
```

#### 4. ai (RAG 시스템)

**모델**:
```python
from pgvector.django import VectorField

class PlaceEmbedding(models.Model):
    place = models.OneToOneField('places.Place', on_delete=models.CASCADE)
    embedding = VectorField(dimensions=1536)
    source_text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
```

**RAG 시스템**:
```python
# backend/apps/ai/rag.py
from openai import OpenAI
from pgvector.django import CosineDistance

class RAGSystem:
    def __init__(self):
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        self.embedding_model = "text-embedding-3-small"

    def search(self, query: str, top_k: int = 10, filters: dict = None):
        """벡터 검색"""
        # 쿼리 임베딩
        query_vector = self._embed_query(query)

        # pgvector 검색
        queryset = PlaceEmbedding.objects.select_related('place')

        if filters and 'region_name' in filters:
            queryset = queryset.filter(
                place__region_name=filters['region_name']
            )

        results = queryset.annotate(
            distance=CosineDistance('embedding', query_vector)
        ).order_by('distance')[:top_k]

        return [
            {
                'place_name': r.place.place_name,
                'similarity_score': 1 - r.distance,
                'address': r.place.address,
                ...
            }
            for r in results
        ]

    def _embed_query(self, query: str):
        """쿼리 임베딩"""
        response = self.client.embeddings.create(
            model=self.embedding_model,
            input=query
        )
        return response.data[0].embedding
```

---

## 데이터베이스 스키마

### ER 다이어그램

```
┌─────────────────────┐
│       User          │
├─────────────────────┤
│ PK  idx             │
│     email (unique)  │
│     username        │
│     password_hash   │
│     is_active       │
│     is_admin        │
│     created_at      │
└──────────┬──────────┘
           │ 1
           │
           │ N
┌──────────▼──────────┐
│       Trip          │
├─────────────────────┤
│ PK  idx             │
│ FK  user_id         │
│     title           │
│     start_date      │
│     end_date        │
│     code (unique)   │
│     is_public       │
│     created_at      │
└──────────┬──────────┘
           │ 1
           │
           │ N
┌──────────▼──────────┐
│       Day           │
├─────────────────────┤
│ PK  idx             │
│ FK  trip_idx        │
│     day_no          │
│     date            │
└──────────┬──────────┘
           │ 1
           │
           │ N
┌──────────▼──────────┐
│       Item          │
├─────────────────────┤
│ PK  idx             │
│ FK  day_idx         │
│     order           │
│     time            │
│     location        │
│     description     │
│     latitude        │
│     longitude       │
└─────────────────────┘

┌─────────────────────┐
│      Place          │
├─────────────────────┤
│ PK  idx             │
│     place_name      │
│     address         │
│     region_name     │
│     category        │
│     description     │
│     latitude        │
│     longitude       │
│     phone           │
│     rating          │
│     created_at      │
└──────────┬──────────┘
           │ 1
           │
           │ 1
┌──────────▼──────────┐
│  PlaceEmbedding     │
├─────────────────────┤
│ PK  idx             │
│ FK  place_id        │
│     embedding       │◄── pgvector (1536 dims)
│     source_text     │
│     created_at      │
└─────────────────────┘

┌─────────────────────┐
│     ChatRoom        │
├─────────────────────┤
│ PK  idx             │
│ FK  trip_idx        │
│     name            │
│     created_at      │
└──────────┬──────────┘
           │ 1
           │
           │ N
┌──────────▼──────────┐
│   ChatMessage       │
├─────────────────────┤
│ PK  idx             │
│ FK  room_idx        │
│ FK  user_id         │
│     message         │
│     is_bot          │
│     created_at      │
└─────────────────────┘

┌─────────────────────┐
│      Weather        │
├─────────────────────┤
│ PK  idx             │
│     region_name     │
│     grid_x          │
│     grid_y          │
│     forecast_date   │
│     temperature     │
│     sky_status      │
│     precipitation   │
│     wind_speed      │
│     humidity        │
│     created_at      │
└─────────────────────┘

┌─────────────────────┐
│ BotPerformanceLog   │
├─────────────────────┤
│ PK  idx             │
│ FK  room_idx        │
│     user_message    │
│     detected_intent │
│     tool_used       │
│     total_time      │
│     llm_time        │
│     tool_time       │
│     rag_time        │
│     success         │
│     error_message   │
│     metadata        │
│     created_at      │
└─────────────────────┘

┌─────────────────────┐
│    RAGTestLog       │
├─────────────────────┤
│ PK  idx             │
│     query           │
│     filters         │
│     top_k           │
│     search_time     │
│     result_count    │
│     avg_similarity  │
│     min_similarity  │
│     max_similarity  │
│     rag_results     │
│     success         │
│     created_at      │
└─────────────────────┘
```

### 주요 인덱스

```sql
-- User
CREATE INDEX idx_user_email ON accounts_user(email);

-- Trip
CREATE INDEX idx_trip_user_id ON plans_trip(user_id);
CREATE INDEX idx_trip_code ON plans_trip(code);

-- Day
CREATE INDEX idx_day_trip_idx ON plans_day(trip_idx);

-- Item
CREATE INDEX idx_item_day_idx ON plans_item(day_idx);

-- Place
CREATE INDEX idx_place_region_name ON places_place(region_name);
CREATE INDEX idx_place_category ON places_place(category);

-- PlaceEmbedding (pgvector HNSW)
CREATE INDEX place_embedding_hnsw_idx
ON ai_place_embedding
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Weather
CREATE INDEX idx_weather_region ON weather_weather(region_name);
CREATE INDEX idx_weather_date ON weather_weather(forecast_date);
CREATE INDEX idx_weather_grid ON weather_weather(grid_x, grid_y);

-- ChatMessage
CREATE INDEX idx_chat_room_idx ON chat_chatmessage(room_idx);
CREATE INDEX idx_chat_created_at ON chat_chatmessage(created_at);

-- BotPerformanceLog
CREATE INDEX idx_perf_room_idx ON chat_botperformancelog(room_idx);
CREATE INDEX idx_perf_created_at ON chat_botperformancelog(created_at);
```

---

## WebSocket 통신

### 채널 레이어 구성

**Redis 백엔드**:
```python
# config/settings/base.py
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [(
                os.getenv("REDIS_HOST", "redis"),
                int(os.getenv("REDIS_PORT", 6379))
            )],
            "password": os.getenv("REDIS_PASSWORD"),
        },
    },
}
```

### 라우팅

```python
# config/asgi.py
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from django.core.asgi import get_asgi_application
from apps.chat import routing

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AuthMiddlewareStack(
        URLRouter(
            routing.websocket_urlpatterns
        )
    ),
})

# apps/chat/routing.py
from django.urls import path
from . import consumers

websocket_urlpatterns = [
    path('ws/chat/<int:room_id>/', consumers.ChatConsumer.as_asgi()),
]
```

### 메시지 흐름

```
Client                   WebSocket                 Agent                  Database
  │                         │                        │                        │
  │─────"강릉 추천"────────►│                        │                        │
  │                         │                        │                        │
  │                         │──receive()────────────►│                        │
  │                         │                        │                        │
  │                         │                        │──RAG search───────────►│
  │                         │                        │◄──results──────────────│
  │                         │                        │                        │
  │                         │◄──group_send()─────────│                        │
  │◄────bot response────────│                        │                        │
  │                         │                        │                        │
  │                         │                        │──save to DB───────────►│
  │                         │                        │                        │
  │                         │◄──planner_update───────│                        │
  │◄────UI update───────────│                        │                        │
```

---

## AI/ML 파이프라인

### 임베딩 생성 파이프라인

```
┌──────────────┐
│ Place Data   │
│  (DB)        │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────┐
│  create_embeddings.py        │
│  (Django Management Command) │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  _create_source_text()       │
│  "강릉 경포대 | 관광지 | ..." │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  OpenAI Embeddings API       │
│  text-embedding-3-small      │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  Vector (1536 dims)          │
│  [0.123, -0.456, ...]        │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  PlaceEmbedding.save()       │
│  (PostgreSQL + pgvector)     │
└──────────────────────────────┘
```

### RAG 검색 파이프라인

```
┌──────────────┐
│ User Query   │
│ "강릉 해변"  │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────┐
│  OpenAI Embeddings API       │
│  query → vector              │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  pgvector Cosine Similarity  │
│  SELECT ... ORDER BY         │
│  embedding <=> query_vector  │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  Top-K Results               │
│  (similarity_score >= 0.7)   │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  LLM Refinement (GPT-4)      │
│  일정 최적화, 시간 배치      │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  Final Response              │
└──────────────────────────────┘
```

---

## 외부 API 통합

### 1. OpenAI API

**사용 모델**:
- `gpt-4o-mini`: Agent 추론, 의도 분류, LLM 정제
- `text-embedding-3-small`: 텍스트 임베딩 (1536차원)

**API 호출 예시**:
```python
from openai import OpenAI

client = OpenAI(api_key=settings.OPENAI_API_KEY)

# Chat Completion
response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {"role": "system", "content": "You are a travel planner."},
        {"role": "user", "content": "강릉 추천해줘"}
    ],
    temperature=0.7
)

# Embeddings
embedding_response = client.embeddings.create(
    model="text-embedding-3-small",
    input="강릉 경포대 해변"
)
```

### 2. Kakao API

**사용 API**:
- **Kakao Map JavaScript SDK**: 프론트엔드 지도 렌더링
- **Kakao Local REST API**: 백엔드 장소 검색

**장소 검색 예시**:
```python
import requests

def search_kakao_place(query: str):
    url = "https://dapi.kakao.com/v2/local/search/keyword.json"
    headers = {"Authorization": f"KakaoAK {settings.KAKAO_REST_API_KEY}"}
    params = {"query": query, "size": 1}

    response = requests.get(url, headers=headers, params=params)
    data = response.json()

    if data['documents']:
        place = data['documents'][0]
        return {
            'name': place['place_name'],
            'address': place['address_name'],
            'latitude': float(place['y']),
            'longitude': float(place['x'])
        }
    return None
```

### 3. 기상청 API (KMA)

**API**: 단기예보 조회서비스 (`VilageFcstInfoService_2.0`)

**데이터 수집** (Airflow DAG):
```python
# airflow/dags/d_fetch_kma_daily.py
from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta

def fetch_kma_weather():
    """기상청 API 호출 및 DB 저장"""
    import requests

    url = "http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst"
    params = {
        "serviceKey": settings.KMA_API_KEY,
        "numOfRows": 100,
        "pageNo": 1,
        "dataType": "JSON",
        "base_date": datetime.now().strftime("%Y%m%d"),
        "base_time": "0500",
        "nx": 60,  # 격자 X
        "ny": 127  # 격자 Y
    }

    response = requests.get(url, params=params)
    data = response.json()

    # DB 저장
    for item in data['response']['body']['items']['item']:
        Weather.objects.update_or_create(
            grid_x=item['nx'],
            grid_y=item['ny'],
            forecast_date=item['fcstDate'],
            defaults={
                'temperature': item.get('T1H'),
                'sky_status': item.get('SKY'),
                'precipitation': item.get('POP'),
                ...
            }
        )

dag = DAG(
    'fetch_kma_daily',
    default_args={'owner': 'airflow'},
    description='기상청 날씨 데이터 수집',
    schedule_interval='0 6 * * *',  # 매일 오전 6시
    start_date=datetime(2025, 1, 1),
    catchup=False
)

fetch_task = PythonOperator(
    task_id='fetch_weather',
    python_callable=fetch_kma_weather,
    dag=dag
)
```

---

## 보안 및 인증

### JWT 인증

**Flow**:
```
1. Login:
   POST /api/accounts/login/ {email, password}
   → {access_token, refresh_token}

2. API 요청:
   GET /api/plans/trips/
   Headers: Authorization: Bearer <access_token>

3. Token 갱신:
   POST /api/accounts/token/refresh/ {refresh}
   → {access}
```

**구현**:
```python
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.permissions import IsAuthenticated

class TripViewSet(viewsets.ModelViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Trip.objects.filter(user=self.request.user)
```

### CORS 설정

```python
# config/settings/base.py
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "https://triplan.com",
]

CORS_ALLOW_CREDENTIALS = True
```

### 환경 변수 보호

```python
# .gitignore
.env
*.env

# .env.template (공개)
OPENAI_API_KEY=your_key_here
KAKAO_REST_API_KEY=
```

---

## 성능 및 확장성

### 성능 최적화

1. **Database Query 최적화**:
```python
# Bad: N+1 쿼리
trips = Trip.objects.all()
for trip in trips:
    print(trip.user.email)  # 매번 DB 쿼리

# Good: select_related
trips = Trip.objects.select_related('user').all()
for trip in trips:
    print(trip.user.email)  # 한 번의 JOIN 쿼리
```

2. **Redis 캐싱**:
```python
from django.core.cache import cache

def get_popular_places(region):
    cache_key = f"popular_places:{region}"
    result = cache.get(cache_key)

    if not result:
        result = Place.objects.filter(region_name=region).order_by('-rating')[:10]
        cache.set(cache_key, result, timeout=3600)  # 1시간

    return result
```

3. **pgvector 인덱스**:
```sql
CREATE INDEX place_embedding_hnsw_idx
ON ai_place_embedding
USING hnsw (embedding vector_cosine_ops);
```

### 확장성 전략

1. **수평 확장** (Horizontal Scaling):
   - Frontend: 여러 인스턴스 → Load Balancer
   - Backend: Stateless 설계 → 여러 Gunicorn 워커
   - Database: Read Replica 추가

2. **수직 확장** (Vertical Scaling):
   - EC2 인스턴스 타입 업그레이드
   - PostgreSQL 메모리 증가

3. **캐싱 레이어**:
   - Redis: Session, WebSocket Channels, RAG 검색 결과
   - CDN: 정적 파일 (이미지, CSS, JS)

---

**마지막 업데이트**: 2025-01-19
**문서 버전**: 1.0.0
