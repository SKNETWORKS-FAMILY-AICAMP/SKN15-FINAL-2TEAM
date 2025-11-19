# TriPlan 프로젝트 종합 기술 문서 - Part 2: 백엔드 상세 분석

> **작성일**: 2025-01-20
> **Part 2**: Django 백엔드 아키텍처 및 데이터베이스 설계

---

## 📋 목차

1. [Django 앱 아키텍처](#1-django-앱-아키텍처)
2. [데이터베이스 스키마](#2-데이터베이스-스키마)
3. [API 엔드포인트 전체 목록](#3-api-엔드포인트-전체-목록)
4. [WebSocket 실시간 통신](#4-websocket-실시간-통신)
5. [인증 및 보안](#5-인증-및-보안)
6. [비즈니스 로직 상세](#6-비즈니스-로직-상세)

---

## 1. Django 앱 아키텍처

### 1.1 앱 구조 개요

Django 프로젝트는 **모듈형 앱 구조**로 설계되어 있으며, 각 앱은 독립적인 기능을 담당합니다.

```
backend/apps/
├── accounts/       # 사용자 인증 및 계정 관리
├── plans/          # 여행 계획 CRUD
├── chat/           # 실시간 채팅 및 WebSocket
├── places/         # 장소 정보
├── weather/        # 날씨 정보
├── exchange/       # 환율 정보
├── common/         # 공통 데이터 (국가, 지역)
├── ai/             # AI 추천 기능
├── export/         # 데이터 내보내기
├── worldtime/      # 세계 시간
└── alerts/         # 여행 알림
```

### 1.2 각 앱 상세 분석

---

#### **1.2.1 accounts (사용자 인증)**

**파일 위치**: `/backend/apps/accounts/`

**핵심 기능**:
- 이메일 기반 사용자 인증
- JWT 토큰 발급/갱신
- 커스텀 User 모델
- OAuth 연동 준비 (UserIdentity)

**모델 (models.py)**:

```python
# User 모델
class User(AbstractBaseUser, PermissionsMixin):
    user_idx = models.AutoField(primary_key=True)
    email = models.EmailField(unique=True)  # 로그인 아이디로 사용
    password = models.CharField(max_length=255)  # DB 컬럼: password_hash
    status = models.CharField(
        choices=[('pending', 'Pending'), ('active', 'Active'),
                 ('suspended', 'Suspended'), ('deleted', 'Deleted')],
        default='pending'
    )
    tz = models.CharField(max_length=50, default='UTC')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'  # 이메일로 로그인
```

**특징**:
- `AbstractBaseUser`를 상속하여 커스텀 User 모델 구현
- 비밀번호는 Django의 `set_password()` 메서드로 자동 해싱
- 이메일을 유일 식별자로 사용 (USERNAME_FIELD)
- 사용자 상태 관리 (pending, active, suspended, deleted)

**API 엔드포인트**:
- `POST /api/accounts/register/` - 회원가입
- `POST /api/accounts/login/` - 로그인 (JWT 토큰 발급)
- `POST /api/accounts/logout/` - 로그아웃
- `POST /api/accounts/token/refresh/` - 토큰 갱신
- `GET /api/accounts/me/` - 현재 사용자 정보

**커스텀 인증 백엔드** (`backends.py`):
```python
class EmailBackend(ModelBackend):
    """이메일로 로그인하는 커스텀 백엔드"""
    def authenticate(self, request, username=None, password=None, **kwargs):
        try:
            user = User.objects.get(email=username)
            if user.check_password(password):
                return user
        except User.DoesNotExist:
            return None
```

---

#### **1.2.2 plans (여행 계획)**

**파일 위치**: `/backend/apps/plans/`

**핵심 기능**:
- 여행 계획 CRUD
- 일차별 계획 관리
- 일정 아이템 관리
- 멤버 초대 및 권한 관리
- 초대 코드 생성 및 검증
- 실시간 플래너 동기화 (Redis Pub/Sub)

**모델 구조**:

```
TripPlan (여행)
    ├── TripDay (일차)
    │       └── TripItem (일정 아이템)
    └── TripMember (멤버)
```

**1) TripPlan 모델**:
```python
class TripPlan(models.Model):
    trip_idx = models.AutoField(primary_key=True)
    owner_user_idx = models.ForeignKey(User, on_delete=models.RESTRICT)
    title = models.TextField()
    country_idx = models.ForeignKey(Country, null=True, blank=True)
    region1_idx = models.ForeignKey(Region1, null=True, blank=True)
    region2_idx = models.ForeignKey(Region2, null=True, blank=True)
    start_date = models.DateField()
    end_date = models.DateField()
    party_size = models.IntegerField(null=True, blank=True)
    budget_currency = models.TextField(null=True, blank=True)
    budget_amount = models.DecimalField(max_digits=14, decimal_places=2)
    status = models.CharField(
        choices=[('draft', 'Draft'), ('confirmed', 'Confirmed'),
                 ('archived', 'Archived')],
        default='draft'
    )
    # 초대 코드 기능
    invite_code = models.CharField(max_length=10, unique=True, null=True)
    invite_code_expires_at = models.DateTimeField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def generate_invite_code(self, expiry_hours=24):
        """6자리 초대 코드 생성"""
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        self.invite_code = code
        self.invite_code_expires_at = timezone.now() + timedelta(hours=expiry_hours)
        self.save()
        return code

    def is_invite_code_valid(self):
        """초대 코드 유효성 검사"""
        return (self.invite_code and self.invite_code_expires_at and
                timezone.now() < self.invite_code_expires_at)
```

**2) TripMember 모델 (권한 관리)**:
```python
class TripMember(models.Model):
    trip_member_idx = models.AutoField(primary_key=True)
    trip_idx = models.ForeignKey(TripPlan, on_delete=models.CASCADE)
    user_idx = models.ForeignKey(User, on_delete=models.CASCADE)
    role = models.CharField(
        choices=[('owner', 'Owner'), ('editor', 'Editor'),
                 ('commenter', 'Commenter'), ('viewer', 'Viewer')],
        default='editor'
    )

    class Meta:
        unique_together = [['trip_idx', 'user_idx']]
```

**역할별 권한**:
| 역할 | 초대 코드 생성 | 멤버 초대 | 플래너 수정 | 댓글 | 읽기 |
|------|---------------|-----------|------------|------|------|
| Owner | ✅ | ✅ | ✅ | ✅ | ✅ |
| Editor | ✅ | ✅ | ✅ | ✅ | ✅ |
| Commenter | ❌ | ❌ | ❌ | ✅ | ✅ |
| Viewer | ❌ | ❌ | ❌ | ❌ | ✅ |

**3) TripDay 모델**:
```python
class TripDay(models.Model):
    day_idx = models.AutoField(primary_key=True)
    trip_idx = models.ForeignKey(TripPlan, on_delete=models.CASCADE, related_name='days')
    day_no = models.IntegerField()  # 1, 2, 3...
    date = models.DateField()

    class Meta:
        unique_together = [
            ['trip_idx', 'date'],
            ['trip_idx', 'day_no']
        ]
```

**4) TripItem 모델**:
```python
class TripItem(models.Model):
    item_idx = models.AutoField(primary_key=True)
    day_idx = models.ForeignKey(TripDay, on_delete=models.CASCADE, related_name='items')
    item_type = models.CharField(
        choices=[('place', 'Place'), ('meal', 'Meal'), ('activity', 'Activity'),
                 ('transfer', 'Transfer'), ('rest', 'Rest'), ('custom', 'Custom')]
    )
    place_idx = models.ForeignKey(Place, null=True, blank=True)
    title = models.TextField(null=True, blank=True)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    estimated_cost = models.DecimalField(max_digits=12, decimal_places=2)
    lock_flag = models.BooleanField(default=False)  # 수정 잠금
    notes = models.TextField(null=True, blank=True)
    order_in_day = models.IntegerField(default=0)  # 순서

    class Meta:
        ordering = ['order_in_day']
```

**API 엔드포인트**:

**TripPlan**:
- `GET /api/plans/trips/` - 여행 목록 (내가 속한 여행)
- `POST /api/plans/trips/` - 여행 생성
- `GET /api/plans/trips/{id}/` - 여행 상세
- `PUT /api/plans/trips/{id}/` - 여행 수정
- `DELETE /api/plans/trips/{id}/` - 여행 삭제 (Owner만)
- `POST /api/plans/trips/{id}/invite/` - 멤버 초대
- `POST /api/plans/trips/{id}/generate_invite_code/` - 초대 코드 생성
- `POST /api/plans/trips/join_by_code/` - 초대 코드로 참여
- `GET /api/plans/trips/by-code/{code}/` - 초대 코드로 여행 조회
- `GET /api/plans/trips/{id}/members/` - 멤버 목록
- `POST /api/plans/trips/{id}/remove_member/` - 멤버 제거
- `POST /api/plans/trips/{id}/leave/` - 여행 나가기
- `POST /api/plans/trips/{id}/update_role/` - 멤버 역할 변경

**TripDay**:
- `GET /api/plans/days/` - 일차 목록
- `POST /api/plans/days/` - 일차 생성
- `PUT /api/plans/days/{id}/` - 일차 수정
- `DELETE /api/plans/days/{id}/` - 일차 삭제

**TripItem**:
- `GET /api/plans/items/` - 일정 아이템 목록
- `POST /api/plans/items/` - 아이템 생성
- `PUT /api/plans/items/{id}/` - 아이템 수정
- `DELETE /api/plans/items/{id}/` - 아이템 삭제

**실시간 동기화** ([views.py:63-87](backend/apps/plans/views.py#L63-L87)):
```python
def _broadcast_planner_update(self, trip, update_type='trip', message=None):
    """플래너 업데이트를 WebSocket으로 브로드캐스트"""
    try:
        chat_room = ChatRoom.objects.filter(trip_idx=trip).first()
        if not chat_room:
            return

        channel_layer = get_channel_layer()
        room_group_name = f'trip_chat_{chat_room.room_idx}'

        # Redis Pub/Sub을 통해 모든 연결된 클라이언트에 전송
        async_to_sync(channel_layer.group_send)(
            room_group_name,
            {
                'type': 'planner_updated',
                'updated_by': self.request.user.email,
                'update_type': update_type,  # 'trip', 'day', 'item'
                'trip_idx': trip.trip_idx,
                'message': message
            }
        )
    except Exception as e:
        print(f"Failed to broadcast: {e}")
```

**동작 원리**:
1. 사용자 A가 플래너 데이터 수정 (TripPlan/TripDay/TripItem)
2. ViewSet의 `perform_update()` 메서드에서 `_broadcast_planner_update()` 호출
3. Redis Pub/Sub을 통해 `trip_chat_{room_idx}` 채널에 메시지 발행
4. WebSocket Consumer가 메시지 수신
5. 모든 연결된 사용자(A, B, C)에게 `planner_updated` 이벤트 전송
6. 프론트엔드에서 이벤트 수신 후 데이터 리로드

---

#### **1.2.3 chat (실시간 채팅)**

**파일 위치**: `/backend/apps/chat/`

**핵심 기능**:
- WebSocket 기반 실시간 채팅
- 멤버 입장/퇴장 알림
- 타이핑 인디케이터
- AI 챗봇 통합
- 채팅 기록 저장

**모델**:

**1) ChatRoom**:
```python
class ChatRoom(models.Model):
    room_idx = models.AutoField(primary_key=True)
    trip_idx = models.ForeignKey(TripPlan, on_delete=models.CASCADE)
    title = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
```

**2) ChatMessage**:
```python
class ChatMessage(models.Model):
    message_idx = models.AutoField(primary_key=True)
    room_idx = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name='messages')
    user_idx = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)  # null이면 봇
    msg_type = models.CharField(
        choices=[('text', 'Text'), ('image', 'Image'), ('file', 'File'),
                 ('system', 'System'), ('ai', 'AI')]
    )
    content = models.TextField()
    payload_json = models.JSONField(null=True, blank=True)  # 추가 데이터
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
```

**WebSocket Consumer** ([consumers.py](backend/apps/chat/consumers.py)):

```python
class TripChatConsumer(AsyncWebsocketConsumer):
    """실시간 협업 채팅 WebSocket Consumer"""

    async def connect(self):
        """WebSocket 연결"""
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f'trip_chat_{self.room_id}'
        self.user = self.scope.get('user')

        # 인증 확인
        if not self.user or not self.user.is_authenticated:
            await self.close()
            return

        # 채팅방 접근 권한 확인
        has_access = await self.check_room_access()
        if not has_access:
            await self.close()
            return

        # Redis 채널 그룹에 참여
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

        # 입장 알림 브로드캐스트
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'user_joined',
                'user_email': self.user.email,
                'user_idx': self.user.user_idx
            }
        )

    async def receive(self, text_data):
        """클라이언트로부터 메시지 수신"""
        data = json.loads(text_data)
        message_type = data.get('type', 'chat_message')

        if message_type == 'chat_message':
            await self.handle_chat_message(data)
        elif message_type == 'typing':
            await self.handle_typing(data)

    async def handle_chat_message(self, data):
        """채팅 메시지 처리 및 브로드캐스트"""
        content = data.get('content', '')

        # DB에 저장
        message = await self.save_message(content=content, msg_type='text')

        # 모든 참가자에게 브로드캐스트
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message': {
                    'message_idx': message.message_idx,
                    'user_idx': self.user.user_idx,
                    'user_email': self.user.email,
                    'content': message.content,
                    'msg_type': message.msg_type,
                    'created_at': message.created_at.isoformat()
                }
            }
        )

        # AI 챗봇 트리거 확인
        if '@봇' in content or '@bot' in content.lower():
            await self.trigger_chatbot(content)

    async def planner_updated(self, event):
        """플래너 업데이트 알림 (실시간 동기화)"""
        await self.send(text_data=json.dumps({
            'type': 'planner_updated',
            'updated_by': event.get('updated_by'),
            'update_type': event.get('update_type'),
            'trip_idx': event.get('trip_idx'),
            'message': event.get('message')
        }))
```

**WebSocket 라우팅** ([routing.py](backend/apps/chat/routing.py)):
```python
websocket_urlpatterns = [
    re_path(r'ws/chat/(?P<room_id>\d+)/$', TripChatConsumer.as_asgi()),
]
```

**연결 URL 예시**:
```
ws://localhost:8001/ws/chat/123/
```

**WebSocket 메시지 타입**:
| 타입 | 방향 | 설명 |
|------|------|------|
| `chat_message` | Client → Server | 채팅 메시지 전송 |
| `typing` | Client → Server | 타이핑 상태 전송 |
| `chat_message` | Server → Client | 새 메시지 수신 |
| `user_joined` | Server → Client | 사용자 입장 알림 |
| `user_left` | Server → Client | 사용자 퇴장 알림 |
| `typing_status` | Server → Client | 다른 사용자 타이핑 상태 |
| `bot_message` | Server → Client | AI 봇 응답 |
| `planner_updated` | Server → Client | 플래너 데이터 변경 알림 |
| `member_added` | Server → Client | 새 멤버 추가 알림 |

---

#### **1.2.4 common (공통 데이터)**

**파일 위치**: `/backend/apps/common/`

**핵심 기능**:
- 국가, 지역 정보 제공
- 전기 콘센트 정보

**모델**:

```python
class Country(models.Model):
    """국가"""
    country_idx = models.AutoField(primary_key=True)
    country_name = models.CharField(max_length=100)
    country_code = models.CharField(max_length=3)  # ISO 3166-1 alpha-3

class Region1(models.Model):
    """시/도 (1차 행정구역)"""
    region1_idx = models.AutoField(primary_key=True)
    country_idx = models.ForeignKey(Country, on_delete=models.CASCADE)
    region1_name = models.CharField(max_length=100)

class Region2(models.Model):
    """구/군 (2차 행정구역)"""
    region2_idx = models.AutoField(primary_key=True)
    region1_idx = models.ForeignKey(Region1, on_delete=models.CASCADE)
    region2_name = models.CharField(max_length=100)
```

**API**:
- `GET /api/common/countries/` - 국가 목록
- `GET /api/common/regions/` - 지역 목록
- `GET /api/common/health/` - 헬스 체크

---

#### **1.2.5 weather (날씨 정보)**

**파일 위치**: `/backend/apps/weather/`

**핵심 기능**:
- 일별/월별 날씨 정보 제공
- Airflow로 자동 수집된 데이터 제공

**모델**:
```python
class WeatherDaily(models.Model):
    weather_idx = models.AutoField(primary_key=True)
    region1_idx = models.ForeignKey(Region1, on_delete=models.CASCADE)
    date = models.DateField()
    temp_max = models.DecimalField(max_digits=5, decimal_places=2)
    temp_min = models.DecimalField(max_digits=5, decimal_places=2)
    precipitation = models.DecimalField(max_digits=6, decimal_places=2)
    weather_condition = models.CharField(max_length=50)

class WeatherMonthly(models.Model):
    weather_idx = models.AutoField(primary_key=True)
    region1_idx = models.ForeignKey(Region1, on_delete=models.CASCADE)
    month = models.IntegerField()  # 1-12
    avg_temp_max = models.DecimalField(max_digits=5, decimal_places=2)
    avg_temp_min = models.DecimalField(max_digits=5, decimal_places=2)
    avg_precipitation = models.DecimalField(max_digits=6, decimal_places=2)
```

---

#### **1.2.6 exchange (환율 정보)**

**파일 위치**: `/backend/apps/exchange/`

**모델**:
```python
class ExchangeRate(models.Model):
    exchange_idx = models.AutoField(primary_key=True)
    currency_code = models.CharField(max_length=3)  # USD, JPY, EUR...
    base_currency = models.CharField(max_length=3, default='KRW')
    rate = models.DecimalField(max_digits=15, decimal_places=6)
    collected_at = models.DateTimeField()

    class Meta:
        unique_together = [['currency_code', 'base_currency', 'collected_at']]
```

---

## 2. 데이터베이스 스키마

### 2.1 테이블 목록 (34개)

| 테이블명 | 설명 | 주요 컬럼 |
|---------|------|----------|
| `user_users` | 사용자 | user_idx, email, password_hash, status |
| `user_identities` | OAuth 연동 | identity_idx, user_idx, provider, provider_uid |
| `trip_plans` | 여행 계획 | trip_idx, owner_user_idx, title, start_date, end_date, invite_code |
| `trip_days` | 여행 일차 | day_idx, trip_idx, day_no, date |
| `trip_items` | 일정 아이템 | item_idx, day_idx, item_type, place_idx, start_time, end_time |
| `trip_members` | 여행 멤버 | trip_member_idx, trip_idx, user_idx, role |
| `trip_alerts` | 여행 알림 | alert_idx, user_idx, alert_type, message |
| `chat_rooms` | 채팅방 | room_idx, trip_idx, title |
| `chat_messages` | 채팅 메시지 | message_idx, room_idx, user_idx, content, msg_type |
| `place_places` | 장소 | place_idx, place_name, latitude, longitude |
| `place_photos` | 장소 사진 | photo_idx, place_idx, photo_url |
| `place_place_categories` | 장소 카테고리 연결 | - |
| `common_country` | 국가 | country_idx, country_name, country_code |
| `common_region1` | 1차 행정구역 | region1_idx, country_idx, region1_name |
| `common_region2` | 2차 행정구역 | region2_idx, region1_idx, region2_name |
| `country_electric` | 전기 콘센트 정보 | country_idx, voltage, plug_type |
| `weather_daily` | 일별 날씨 | weather_idx, region1_idx, date, temp_max, temp_min |
| `weather_monthly` | 월별 날씨 | weather_idx, region1_idx, month, avg_temp_max |
| `exchange_rates` | 환율 | exchange_idx, currency_code, rate, collected_at |
| `world_time` | 세계 시간 | time_idx, region1_idx, timezone |
| `export_jobs` | 내보내기 작업 | job_idx, user_idx, status, file_path |
| `rec_events` | 추천 이벤트 | event_idx, title, region1_idx, start_date |
| `rec_applied` | 추천 적용 이력 | - |
| `trip_course_embeddings` | 여행 코스 임베딩 (pgvector) | - |
| `django_*` | Django 시스템 테이블 | - |
| `auth_*` | Django 권한 테이블 | - |

### 2.2 ER 다이어그램 (핵심 테이블)

```
┌─────────────────┐
│   user_users    │
│  (사용자)       │
├─────────────────┤
│ user_idx (PK)   │
│ email           │
│ password_hash   │
│ status          │
│ tz              │
└─────────────────┘
         │
         │ 1:N
         ↓
┌─────────────────────────┐          ┌──────────────────┐
│      trip_plans         │ 1:N      │   trip_members   │
│      (여행 계획)        │←────────→│   (여행 멤버)    │
├─────────────────────────┤          ├──────────────────┤
│ trip_idx (PK)           │          │ trip_member_idx  │
│ owner_user_idx (FK)     │          │ trip_idx (FK)    │
│ title                   │          │ user_idx (FK)    │
│ country_idx (FK)        │          │ role             │
│ region1_idx (FK)        │          └──────────────────┘
│ start_date              │
│ end_date                │          ┌──────────────────┐
│ invite_code             │ 1:1      │   chat_rooms     │
│ invite_code_expires_at  │←────────→│   (채팅방)       │
└─────────────────────────┘          ├──────────────────┤
         │                           │ room_idx (PK)    │
         │ 1:N                       │ trip_idx (FK)    │
         ↓                           │ title            │
┌─────────────────┐                  └──────────────────┘
│   trip_days     │                          │
│   (여행 일차)   │                          │ 1:N
├─────────────────┤                          ↓
│ day_idx (PK)    │                  ┌──────────────────┐
│ trip_idx (FK)   │                  │  chat_messages   │
│ day_no          │                  │  (채팅 메시지)   │
│ date            │                  ├──────────────────┤
└─────────────────┘                  │ message_idx (PK) │
         │                           │ room_idx (FK)    │
         │ 1:N                       │ user_idx (FK)    │
         ↓                           │ content          │
┌─────────────────┐                  │ msg_type         │
│   trip_items    │                  └──────────────────┘
│   (일정 아이템) │
├─────────────────┤
│ item_idx (PK)   │
│ day_idx (FK)    │
│ place_idx (FK)  │
│ item_type       │
│ start_time      │
│ end_time        │
│ estimated_cost  │
│ order_in_day    │
└─────────────────┘
         │
         │ N:1
         ↓
┌─────────────────┐
│  place_places   │
│  (장소)         │
├─────────────────┤
│ place_idx (PK)  │
│ place_name      │
│ latitude        │
│ longitude       │
│ region1_idx(FK) │
└─────────────────┘
```

### 2.3 인덱스 전략

**성능 최적화를 위한 인덱스**:

```sql
-- user_users
CREATE INDEX idx_user_email ON user_users(email);
CREATE INDEX idx_user_status ON user_users(status);
CREATE INDEX idx_user_created_at ON user_users(created_at);

-- trip_plans
CREATE INDEX idx_trip_owner ON trip_plans(owner_user_idx);
CREATE INDEX idx_trip_invite_code ON trip_plans(invite_code);
CREATE INDEX idx_trip_dates ON trip_plans(start_date, end_date);

-- trip_members
CREATE UNIQUE INDEX idx_trip_member_unique ON trip_members(trip_idx, user_idx);

-- chat_messages
CREATE INDEX idx_chat_room ON chat_messages(room_idx);
CREATE INDEX idx_chat_created_at ON chat_messages(created_at);

-- place_places
CREATE INDEX idx_place_location ON place_places(latitude, longitude);
CREATE INDEX idx_place_region ON place_places(region1_idx);
```

---

## 3. API 엔드포인트 전체 목록

### 3.1 인증 (Authentication)

| Method | Endpoint | 설명 | 인증 필요 |
|--------|----------|------|----------|
| POST | `/api/accounts/register/` | 회원가입 | ❌ |
| POST | `/api/accounts/login/` | 로그인 | ❌ |
| POST | `/api/accounts/logout/` | 로그아웃 | ✅ |
| POST | `/api/accounts/token/refresh/` | 토큰 갱신 | ❌ |
| GET | `/api/accounts/me/` | 내 정보 조회 | ✅ |

**Request/Response 예시**:

```json
// POST /api/accounts/register/
{
  "email": "user@example.com",
  "password": "securepassword123",
  "password_confirm": "securepassword123"
}

// Response
{
  "user_idx": 1,
  "email": "user@example.com",
  "status": "active"
}

// POST /api/accounts/login/
{
  "email": "user@example.com",
  "password": "securepassword123"
}

// Response
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "user": {
    "user_idx": 1,
    "email": "user@example.com"
  }
}
```

### 3.2 여행 계획 (Trip Plans)

| Method | Endpoint | 설명 | 권한 |
|--------|----------|------|------|
| GET | `/api/plans/trips/` | 여행 목록 | 로그인 |
| POST | `/api/plans/trips/` | 여행 생성 | 로그인 |
| GET | `/api/plans/trips/{id}/` | 여행 상세 | Member |
| PUT | `/api/plans/trips/{id}/` | 여행 수정 | Editor+ |
| DELETE | `/api/plans/trips/{id}/` | 여행 삭제 | Owner |
| POST | `/api/plans/trips/{id}/invite/` | 이메일로 멤버 초대 | Editor+ |
| POST | `/api/plans/trips/{id}/generate_invite_code/` | 초대 코드 생성 | Editor+ |
| POST | `/api/plans/trips/join_by_code/` | 초대 코드로 참여 | 로그인 |
| GET | `/api/plans/trips/by-code/{code}/` | 초대 코드로 여행 조회 | Member |
| GET | `/api/plans/trips/{id}/members/` | 멤버 목록 | Member |
| POST | `/api/plans/trips/{id}/remove_member/` | 멤버 제거 | Owner |
| POST | `/api/plans/trips/{id}/leave/` | 여행 나가기 | Member |
| POST | `/api/plans/trips/{id}/update_role/` | 역할 변경 | Owner |

### 3.3 일차 및 일정 (Days & Items)

| Method | Endpoint | 설명 | 권한 |
|--------|----------|------|------|
| GET | `/api/plans/days/` | 일차 목록 | Member |
| POST | `/api/plans/days/` | 일차 생성 | Editor+ |
| PUT | `/api/plans/days/{id}/` | 일차 수정 | Editor+ |
| DELETE | `/api/plans/days/{id}/` | 일차 삭제 | Editor+ |
| GET | `/api/plans/items/` | 아이템 목록 | Member |
| POST | `/api/plans/items/` | 아이템 생성 | Editor+ |
| PUT | `/api/plans/items/{id}/` | 아이템 수정 | Editor+ |
| DELETE | `/api/plans/items/{id}/` | 아이템 삭제 | Editor+ |

### 3.4 채팅 (Chat)

| Method | Endpoint | 설명 | 권한 |
|--------|----------|------|------|
| GET | `/api/chat/rooms/` | 채팅방 목록 | 로그인 |
| GET | `/api/chat/rooms/{id}/` | 채팅방 상세 | Member |
| GET | `/api/chat/rooms/{id}/messages/` | 채팅 기록 | Member |
| WS | `/ws/chat/{room_id}/` | WebSocket 연결 | Member |

### 3.5 공통 데이터 (Common)

| Method | Endpoint | 설명 | 권한 |
|--------|----------|------|------|
| GET | `/api/common/countries/` | 국가 목록 | 공개 |
| GET | `/api/common/regions/` | 지역 목록 | 공개 |
| GET | `/api/common/health/` | 헬스 체크 | 공개 |

### 3.6 장소 (Places)

| Method | Endpoint | 설명 | 권한 |
|--------|----------|------|------|
| GET | `/api/places/places/` | 장소 검색 | 로그인 |
| GET | `/api/places/places/{id}/` | 장소 상세 | 로그인 |

### 3.7 날씨 & 환율 (Weather & Exchange)

| Method | Endpoint | 설명 | 권한 |
|--------|----------|------|------|
| GET | `/api/weather/daily/` | 일별 날씨 | 로그인 |
| GET | `/api/weather/monthly/` | 월별 날씨 | 로그인 |
| GET | `/api/exchange/rates/` | 환율 정보 | 로그인 |

---

## 4. WebSocket 실시간 통신

### 4.1 연결 플로우

```
1. 클라이언트가 JWT 토큰과 함께 WebSocket 연결 요청
   ws://localhost:8001/ws/chat/123/?token=eyJ0eXAi...

2. JWTAuthMiddleware에서 토큰 검증
   - 유효: scope['user'] = User 객체
   - 무효: 연결 거부

3. TripChatConsumer.connect() 실행
   - 채팅방 접근 권한 확인
   - Redis 그룹 참여 (trip_chat_{room_id})
   - 입장 알림 브로드캐스트

4. 실시간 통신 시작
   - 메시지 송수신
   - 타이핑 상태 공유
   - 플래너 업데이트 알림 수신
```

### 4.2 Redis Pub/Sub 아키텍처

**동작 원리**:

```
┌───────────────────────────────────────────────────────────┐
│                    Django Channels                         │
│                    (Channel Layer)                         │
└───────────────────────────────────────────────────────────┘
                           │
                           │ uses
                           ↓
┌───────────────────────────────────────────────────────────┐
│                    Redis Pub/Sub                           │
│                                                             │
│  Channel: trip_chat_123                                    │
│  ├─ Subscriber 1 (WebSocket Connection A)                 │
│  ├─ Subscriber 2 (WebSocket Connection B)                 │
│  └─ Subscriber 3 (WebSocket Connection C)                 │
└───────────────────────────────────────────────────────────┘
                           ↑
                           │ group_send()
                           │
┌───────────────────────────────────────────────────────────┐
│  Publisher (Backend ViewSet or Consumer)                   │
│  - TripPlanViewSet._broadcast_planner_update()            │
│  - TripChatConsumer.handle_chat_message()                 │
└───────────────────────────────────────────────────────────┘
```

**설정** ([config/settings/base.py:157-164](backend/config/settings/base.py#L157-L164)):

```python
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            "hosts": [env('REDIS_URL', default='redis://localhost:6379/0')],
        },
    },
}
```

**사용 예시**:

```python
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

channel_layer = get_channel_layer()

# 그룹에 메시지 발행
async_to_sync(channel_layer.group_send)(
    'trip_chat_123',  # 그룹명
    {
        'type': 'planner_updated',  # Consumer의 메서드명
        'data': {...}
    }
)
```

### 4.3 WebSocket 이벤트 타입

**클라이언트 → 서버**:
```json
// 채팅 메시지
{
  "type": "chat_message",
  "content": "안녕하세요!"
}

// 타이핑 상태
{
  "type": "typing",
  "is_typing": true
}
```

**서버 → 클라이언트**:
```json
// 채팅 메시지 수신
{
  "type": "chat_message",
  "message": {
    "message_idx": 456,
    "user_idx": 1,
    "user_email": "user@example.com",
    "content": "안녕하세요!",
    "msg_type": "text",
    "created_at": "2025-01-20T10:30:00Z"
  }
}

// 플래너 업데이트 알림
{
  "type": "planner_updated",
  "updated_by": "user@example.com",
  "update_type": "item",
  "trip_idx": 5,
  "message": "user@example.com님이 일정을 수정했습니다."
}

// 사용자 입장
{
  "type": "user_joined",
  "user_email": "newuser@example.com",
  "user_idx": 2
}
```

---

## 5. 인증 및 보안

### 5.1 JWT 토큰 인증

**설정** ([config/settings/base.py:182-195](backend/config/settings/base.py#L182-L195)):

```python
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),  # 1시간
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),  # 7일
    'ROTATE_REFRESH_TOKENS': False,
    'BLACKLIST_AFTER_ROTATION': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'USER_ID_FIELD': 'user_idx',
    'USER_ID_CLAIM': 'user_id',
}
```

**토큰 갱신 플로우**:

```
1. Access Token 만료 (401 Unauthorized)
2. 프론트엔드 Axios 인터셉터에서 감지
3. Refresh Token으로 /api/accounts/token/refresh/ 호출
4. 새로운 Access Token 발급
5. 원래 요청 재시도
6. Refresh Token도 만료 시 로그인 페이지로 리다이렉트
```

### 5.2 CORS 설정

```python
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_ALL_ORIGINS = True  # 개발 환경
# CORS_ALLOWED_ORIGINS = [
#     'http://localhost:3000',
#     'http://172.24.254.226',
# ]
```

**Nginx CORS 헤더**:
```nginx
add_header Access-Control-Allow-Origin * always;
add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;
```

### 5.3 보안 헤더

**Django**:
```python
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    # ...
]
```

**Nginx**:
```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
```

---

## 6. 비즈니스 로직 상세

### 6.1 초대 코드 시스템

**생성 로직** ([models.py:110-120](backend/apps/plans/models.py#L110-L120)):

```python
def generate_invite_code(self, expiry_hours=24):
    """6자리 랜덤 코드 생성 (대문자 + 숫자)"""
    while True:
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        if not TripPlan.objects.filter(invite_code=code).exists():
            self.invite_code = code
            self.invite_code_expires_at = timezone.now() + timedelta(hours=expiry_hours)
            self.save()
            return code
```

**검증 로직** ([models.py:122-126](backend/apps/plans/models.py#L122-L126)):

```python
def is_invite_code_valid(self):
    """유효성: 코드 존재 + 만료시간 이전"""
    return (self.invite_code and
            self.invite_code_expires_at and
            timezone.now() < self.invite_code_expires_at)
```

**참여 플로우** ([views.py:233-329](backend/apps/plans/views.py#L233-L329)):

1. 초대 코드로 여행 검색
2. 코드 유효성 확인
3. 이미 멤버인지 확인
4. 멤버 추가 (역할: viewer)
5. 채팅방에 시스템 메시지 추가
6. WebSocket으로 입장 알림

### 6.2 권한 관리

**역할 계층**:
```
Owner > Editor > Commenter > Viewer
```

**권한 체크 로직**:

```python
# 예: 멤버 초대 권한
member = trip.members.filter(user_idx=request.user).first()
if not member or member.role not in ['owner', 'editor']:
    return Response({'error': 'Permission denied'}, status=403)

# 예: 여행 삭제 권한 (Owner만)
member = instance.members.filter(user_idx=self.request.user).first()
if not member or member.role != 'owner':
    raise PermissionError('Only owner can delete trip')
```

### 6.3 실시간 동기화 메커니즘

**문제**: 사용자 A가 플래너를 수정할 때, 사용자 B, C도 즉시 변경사항을 볼 수 있어야 함

**해결책**: Redis Pub/Sub + WebSocket

**구현**:

1. **ViewSet에서 브로드캐스트** ([views.py:43-54](backend/apps/plans/views.py#L43-L54)):
```python
def perform_update(self, serializer):
    instance = serializer.save()
    self._broadcast_planner_update(
        trip=instance,
        update_type='trip',
        message=f'{self.request.user.email}님이 여행 정보를 수정했습니다.'
    )
```

2. **Redis를 통해 모든 WebSocket에 전달** ([views.py:63-87](backend/apps/plans/views.py#L63-L87)):
```python
def _broadcast_planner_update(self, trip, update_type, message):
    chat_room = ChatRoom.objects.filter(trip_idx=trip).first()
    channel_layer = get_channel_layer()
    room_group_name = f'trip_chat_{chat_room.room_idx}'

    async_to_sync(channel_layer.group_send)(
        room_group_name,
        {
            'type': 'planner_updated',
            'updated_by': self.request.user.email,
            'update_type': update_type,
            'trip_idx': trip.trip_idx,
            'message': message
        }
    )
```

3. **WebSocket Consumer에서 클라이언트로 전송** ([consumers.py:202-214](backend/apps/chat/consumers.py#L202-L214)):
```python
async def planner_updated(self, event):
    await self.send(text_data=json.dumps({
        'type': 'planner_updated',
        'updated_by': event.get('updated_by'),
        'update_type': event.get('update_type'),
        'trip_idx': event.get('trip_idx'),
        'message': event.get('message')
    }))
```

4. **프론트엔드에서 데이터 리로드** ([frontend/pages/planner.tsx:1453-1457](frontend/pages/planner.tsx#L1453-L1457)):
```typescript
onPlannerUpdate={(data) => {
  console.log('🔄 Planner update received:', data);
  loadDaysData();  // 여행 데이터 다시 로드
}}
```

---

## 📌 다음 파트 안내

**Part 3**: [프론트엔드 및 기술 선택 이유](TECH_DOCS_PART3_FRONTEND_DECISIONS.md)
- Next.js 페이지별 분석
- React 컴포넌트 구조
- 상태 관리 전략
- WebSocket 클라이언트 구현
- 기술 스택 선택 근거 및 아키텍처 의사결정

---

**작성자**: Claude Code (AI Assistant)
**최종 업데이트**: 2025-01-20
