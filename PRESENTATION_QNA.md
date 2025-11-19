# TRIPLAN 프로젝트 발표 Q&A 가이드

발표 시 예상되는 질문들과 답변을 정리한 문서입니다.

---

## 📋 목차

1. [기술 스택 관련](#1-기술-스택-관련)
2. [실시간 통신 관련](#2-실시간-통신-관련)
3. [Redis 관련](#3-redis-관련)
4. [보안 관련 (JWT)](#4-보안-관련-jwt)
5. [데이터베이스 관련](#5-데이터베이스-관련)
6. [아키텍처 관련](#6-아키텍처-관련)
7. [협업 기능 관련](#7-협업-기능-관련)
8. [배포 및 인프라 관련](#8-배포-및-인프라-관련)
9. [AI 기능 관련](#9-ai-기능-관련)
10. [성능 및 최적화 관련](#10-성능-및-최적화-관련)

---

## 1. 기술 스택 관련

### Q1-1: 왜 Next.js를 선택했나요?

**답변:**
Next.js를 선택한 이유는 크게 세 가지입니다.

1. **SSR (Server-Side Rendering)**: 여행 계획 페이지의 SEO 최적화를 위해 SSR이 필요했습니다.
2. **파일 기반 라우팅**: `/pages` 디렉토리 구조로 직관적인 라우팅이 가능합니다.
3. **API Routes**: 백엔드 API와 별도로 간단한 서버 로직을 프론트엔드에서 처리할 수 있습니다.

현재 **Next.js 14.1.0**을 사용하고 있으며, App Router가 아닌 Pages Router를 사용하고 있습니다.

### Q1-2: 왜 Django를 백엔드로 선택했나요?

**답변:**
Django를 선택한 이유는:

1. **Django REST Framework (DRF)**: RESTful API 개발에 최적화된 프레임워크입니다.
2. **Django Channels**: WebSocket 지원이 내장되어 있어 실시간 통신 구현이 용이합니다.
3. **ORM**: 복잡한 여행 데이터 관계를 쉽게 모델링하고 관리할 수 있습니다.
4. **Admin Panel**: 개발 중 데이터 확인 및 관리가 편리합니다.

### Q1-3: PostgreSQL과 pgvector를 선택한 이유는?

**답변:**
1. **PostgreSQL**: 관계형 데이터베이스로 여행 계획의 복잡한 관계(여행 → 일차 → 항목)를 표현하기 적합합니다.
2. **pgvector 확장**: 향후 AI 기반 여행지 추천 시스템을 위해 벡터 검색 기능을 준비했습니다.

```python
# pgvector 활용 예시 (향후 구현 예정)
class Place(models.Model):
    embedding = VectorField(dimensions=1536)  # OpenAI embedding
```

---

## 2. 실시간 통신 관련

### Q2-1: 실시간 통신은 어떻게 구현했나요?

**답변:**
**WebSocket + Django Channels + Redis Pub/Sub** 조합으로 구현했습니다.

**기술 스택:**
- **프론트엔드**: 네이티브 WebSocket API
- **백엔드**: Django Channels 4.x (ASGI 서버)
- **메시지 브로커**: Redis Pub/Sub

**통신 흐름:**
```
사용자 A → WebSocket → Django Channels → Redis Pub/Sub → Django Channels → WebSocket → 사용자 B, C
```

**지연 시간**: 약 100ms 이내

### Q2-2: Socket.IO를 안 쓰나요?

**답변:**
아니요, **Socket.IO를 사용하지 않습니다**.

`package.json`에 `socket.io-client`가 설치되어 있지만, 실제로는 **네이티브 WebSocket**을 사용합니다.

```typescript
// frontend/src/hooks/useCollaborativeChat.ts:67
const ws = new WebSocket(wsUrl);  // 네이티브 WebSocket 사용
```

Socket.IO는 하위 호환성과 자동 재연결 기능을 제공하지만, 우리는:
1. 최신 브라우저만 타겟으로 하므로 WebSocket 네이티브 지원 보장
2. 직접 재연결 로직 구현으로 더 세밀한 제어
3. 번들 크기 절감 (Socket.IO는 ~62KB)

### Q2-3: Long Polling은 뭐고 왜 안 썼나요?

**답변:**
**Long Polling**은 HTTP 기반 실시간 통신 방식입니다.

**작동 방식:**
```
1. 클라이언트 → 서버: HTTP 요청 전송
2. 서버: 새 데이터 있을 때까지 응답 지연 (최대 30초)
3. 새 데이터 발생 → 서버: HTTP 응답 반환
4. 클라이언트: 즉시 다시 HTTP 요청 전송 (반복)
```

**WebSocket과 비교:**

| 항목 | Long Polling | WebSocket |
|------|--------------|-----------|
| **연결 방식** | HTTP 반복 요청 | 지속적 양방향 연결 |
| **지연 시간** | 200-500ms | 50-100ms |
| **서버 부하** | 높음 (매 요청마다 연결) | 낮음 (1회 연결 유지) |
| **실시간성** | 낮음 | 높음 |
| **방화벽 호환** | 높음 | 낮음 (일부 차단) |

**WebSocket을 선택한 이유:**
- 여행 계획 협업에서는 **즉각적인 동기화**가 중요
- 최신 브라우저 환경에서는 WebSocket 지원 보장
- 서버 리소스 효율적 사용

### Q2-4: 채팅 메시지는 어떻게 전달되나요?

**답변:**
**Django Channels의 Channel Groups**를 사용합니다.

```python
# backend/apps/chats/consumers.py
class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f'trip_chat_{room_id}'

        # 그룹에 참가
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
```

**메시지 전송 흐름:**
```
1. 사용자 A가 채팅 전송
2. ChatConsumer.receive() → DB 저장
3. channel_layer.group_send('trip_chat_123', {...})
4. Redis Pub/Sub로 메시지 브로드캐스트
5. 같은 그룹의 모든 연결된 사용자에게 전달
```

---

## 3. Redis 관련

### Q3-1: Redis를 왜 사용하나요?

**답변:**
Redis는 TRIPLAN에서 **두 가지 핵심 역할**을 합니다:

1. **Django Channels의 Channel Layer (메시지 브로커)**
2. **캐싱 시스템**

### Q3-2: Redis Channel Layer가 뭔가요?

**답변:**
**Channel Layer**는 Django Channels에서 여러 서버 간 메시지를 전달하는 메시지 브로커입니다.

**왜 필요한가?**
- Django Channels는 여러 개의 ASGI 서버 인스턴스로 실행됩니다.
- 사용자 A가 서버 1에 연결, 사용자 B가 서버 2에 연결된 경우:
  - **Redis 없으면**: 서버 간 메시지 전달 불가 ❌
  - **Redis 있으면**: Pub/Sub으로 모든 서버에 메시지 브로드캐스트 ✅

**설정 코드:**
```python
# backend/config/settings/base.py
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [("redis", 6379)],
        },
    },
}
```

### Q3-3: Redis Pub/Sub의 작동 방식은?

**답변:**
**Pub/Sub (Publish/Subscribe)**: 발행/구독 패턴의 메시징 시스템입니다.

**작동 흐름:**
```
1. Subscriber들이 특정 채널(channel)을 구독
   예: 'trip_chat_123' 채널 구독

2. Publisher가 메시지를 채널에 발행
   예: PUBLISH trip_chat_123 "새로운 채팅 메시지"

3. Redis가 해당 채널을 구독한 모든 Subscriber에게 메시지 전달
```

**Django Channels에서의 활용:**
```python
# 메시지 발행 (group_send)
await self.channel_layer.group_send(
    'trip_chat_123',  # Redis channel name
    {
        'type': 'chat_message',
        'message': '안녕하세요',
        'user': 'test@example.com'
    }
)

# 메시지 구독 (group_add)
await self.channel_layer.group_add(
    'trip_chat_123',
    self.channel_name  # 각 WebSocket 연결의 고유 이름
)
```

### Q3-4: Redis 캐싱은 어디에 사용하나요?

**답변:**
현재는 **Channel Layer 전용**으로 사용 중이지만, 향후 다음 용도로 확장 예정:

1. **API 응답 캐싱**: 자주 조회되는 여행지 정보
2. **세션 저장소**: JWT 블랙리스트 (로그아웃된 토큰)
3. **Rate Limiting**: API 요청 제한

```python
# 향후 구현 예정
from django.core.cache import cache

# 여행지 정보 캐싱 (5분)
place_data = cache.get(f'place_{place_id}')
if not place_data:
    place_data = Place.objects.get(pk=place_id)
    cache.set(f'place_{place_id}', place_data, 300)
```

### Q3-5: Redis가 없으면 어떻게 되나요?

**답변:**
**실시간 통신이 완전히 작동하지 않습니다.**

- **단일 서버 환경**: 같은 서버에 연결된 사용자끼리만 채팅 가능
- **다중 서버 환경**: 서버 간 메시지 전달 불가능
- **확장성**: 수평적 확장(Scale-out) 불가능

**대안:**
1. **In-Memory Channel Layer**: 개발 환경에서만 사용 (단일 서버)
2. **RabbitMQ**: Redis 대신 사용 가능 (더 복잡)

---

## 4. 보안 관련 (JWT)

### Q4-1: JWT 인증은 어떻게 작동하나요?

**답변:**
**JWT (JSON Web Token)**: 사용자 인증 정보를 암호화된 토큰으로 저장하는 방식입니다.

**로그인 플로우:**
```
1. 사용자: 이메일 + 비밀번호 전송
2. 서버: 인증 성공 → Access Token (1시간) + Refresh Token (7일) 발급
3. 클라이언트: localStorage에 토큰 저장
4. 이후 모든 API 요청: Authorization: Bearer {access_token}
```

**토큰 구조:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9  ← Header (알고리즘)
.eyJ1c2VyX2lkIjo0LCJleHAiOjE3NjExMDI3ODR9  ← Payload (사용자 정보)
.vyT54pGgVSL1TO8NkXLS8yEUNJilacjxVzAnazfLvb4  ← Signature (서명)
```

### Q4-2: Access Token이 1시간, Refresh Token이 7일인 이유는?

**답변:**
**보안 vs 사용자 경험의 균형**입니다.

**Access Token (1시간):**
- 짧은 수명으로 토큰 탈취 시 피해 최소화
- 매 API 요청마다 전송되므로 노출 위험 높음
- 탈취되어도 1시간 후 자동 만료

**Refresh Token (7일):**
- Access Token 재발급 전용
- 안전하게 저장 (httpOnly 쿠키 권장)
- 7일 동안 재로그인 불필요

**자동 갱신 플로우:**
```typescript
// frontend/src/utils/axios.ts
axios.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      // Access Token 만료 → Refresh Token으로 재발급
      const newToken = await refreshAccessToken();
      error.config.headers.Authorization = `Bearer ${newToken}`;
      return axios.request(error.config);  // 재시도
    }
  }
);
```

### Q4-3: 두 토큰의 차이는 무엇인가요?

**답변:**

| 구분 | Access Token | Refresh Token |
|------|--------------|---------------|
| **역할** | API 요청 인증 (입장권) | Access Token 재발급 (재발급권) |
| **수명** | 1시간 | 7일 |
| **저장 위치** | localStorage | localStorage (권장: httpOnly 쿠키) |
| **사용 빈도** | 매 API 요청마다 | Access Token 만료 시에만 |
| **노출 위험** | 높음 | 낮음 |
| **탈취 시 피해** | 1시간 내 제한적 | 7일간 심각 |

**비유:**
- **Access Token**: 놀이공원 입장권 (자주 제시, 1일 유효)
- **Refresh Token**: 연간 회원권 (필요할 때만 제시, 1년 유효)

### Q4-4: JWT의 단점은 없나요?

**답변:**
있습니다. 주요 단점과 해결 방안:

**1. 토큰 무효화 불가능**
- 문제: 발급된 JWT는 만료 전까지 강제 무효화 불가
- 해결: Redis에 블랙리스트 저장 (로그아웃 시 토큰 등록)

**2. 토큰 크기**
- 문제: Session ID(32 bytes)보다 크기 큼 (200-500 bytes)
- 해결: 필요한 정보만 Payload에 포함

**3. 중간에 수정 불가**
- 문제: 권한 변경 시 토큰 재발급 필요
- 해결: Access Token 수명을 짧게 설정 (1시간)

---

## 5. 데이터베이스 관련

### Q5-1: 데이터베이스 스키마는 어떻게 설계했나요?

**답변:**
**계층적 구조**로 설계했습니다:

```
User (사용자)
  ↓ 1:N
Trip (여행 계획)
  ↓ 1:N
Day (일차)
  ↓ 1:N
Item (일정 항목)

Trip ← N:M → User (TripMember로 연결)
```

**핵심 테이블:**
```python
# Trip (여행 계획)
- trip_idx: PK
- name: 여행 제목
- start_date, end_date: 여행 기간
- invite_code: 초대 코드 (6자리)

# Day (일차별 계획)
- day_idx: PK
- trip_idx: FK → Trip
- day_no: 1일차, 2일차, ...
- date: 날짜

# Item (일정 항목)
- item_idx: PK
- day_idx: FK → Day
- place_idx: FK → Place
- start_time: 시작 시간
- notes: 메모
```

### Q5-2: pgvector는 어떻게 활용하나요?

**답변:**
**향후 AI 기반 추천 시스템**을 위해 준비했습니다.

**활용 시나리오:**
```python
# 1. 여행지 설명을 벡터로 변환 (OpenAI Embedding API)
place.embedding = openai.Embedding.create(
    input=place.description,
    model="text-embedding-3-small"
)

# 2. 유사한 여행지 검색
similar_places = Place.objects.filter(
    embedding__cosine_distance__lt=0.3
).order_by('embedding <-> query_vector')[:5]
```

**현재 상태:**
- pgvector 확장 설치 완료
- VectorField 정의 완료
- 실제 벡터 생성 로직은 미구현 (MVP 범위 외)

### Q5-3: 데이터베이스 마이그레이션은 어떻게 관리하나요?

**답변:**
**Django ORM의 마이그레이션 시스템**을 사용합니다.

```bash
# 1. 모델 변경 후 마이그레이션 파일 생성
python manage.py makemigrations

# 2. 데이터베이스에 적용
python manage.py migrate

# 3. Docker 환경에서는 자동 실행
docker-compose up  # migrate 자동 실행됨
```

**마이그레이션 파일 예시:**
```python
# backend/apps/plans/migrations/0001_initial.py
class Migration(migrations.Migration):
    dependencies = []

    operations = [
        migrations.CreateModel(
            name='Trip',
            fields=[
                ('trip_idx', models.AutoField(primary_key=True)),
                ('name', models.CharField(max_length=200)),
                ('start_date', models.DateField()),
            ],
        ),
    ]
```

---

## 6. 아키텍처 관련

### Q6-1: 전체 시스템 아키텍처를 설명해주세요.

**답변:**
**3계층 아키텍처 + 마이크로서비스 패턴**을 적용했습니다.

```
[사용자]
   ↓
[Nginx (Reverse Proxy)] ← Presentation Layer
   ↓
   ├─→ [Next.js Frontend:3000]
   ├─→ [Django REST API:8000]  ← Application Layer
   ├─→ [Django WebSocket:8001]
   └─→ [Airflow:8080]
         ↓
   ├─→ [PostgreSQL:5432]  ← Data Layer
   └─→ [Redis:6379]
```

**계층별 역할:**

1. **Presentation Layer (Nginx)**
   - 정적 파일 서빙
   - 리버스 프록시
   - SSL/TLS 종료

2. **Application Layer**
   - Next.js: UI 렌더링, SSR
   - Django: 비즈니스 로직, API
   - Daphne: WebSocket 처리
   - Airflow: 배치 작업 (데이터 수집)

3. **Data Layer**
   - PostgreSQL: 영구 데이터 저장
   - Redis: 실시간 메시징, 캐싱

### Q6-2: 왜 Django를 Gunicorn과 Daphne로 나눴나요?

**답변:**
**WSGI (Gunicorn)와 ASGI (Daphne)의 역할이 다르기 때문**입니다.

**Gunicorn (WSGI 서버):**
- REST API 처리 (동기 요청)
- 높은 처리량
- Worker 프로세스 4개

```yaml
# docker-compose.yml
backend:
  command: gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 4
  ports:
    - "8000:8000"
```

**Daphne (ASGI 서버):**
- WebSocket 처리 (비동기 연결)
- 장시간 연결 유지
- 이벤트 기반 처리

```yaml
websocket:
  command: daphne -b 0.0.0.0 -p 8001 config.asgi:application
  ports:
    - "8001:8001"
```

**분리 이유:**
- WSGI와 ASGI는 호환되지 않음
- 각 서버를 최적화된 설정으로 실행
- 부하 분산 (API ≠ WebSocket)

### Q6-3: Nginx는 왜 필요한가요?

**답변:**
**리버스 프록시 + 로드 밸런서** 역할입니다.

**주요 기능:**

1. **리버스 프록시**
```nginx
# nginx/nginx.conf
location /api/ {
    proxy_pass http://backend:8000;
}

location /ws/ {
    proxy_pass http://websocket:8001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

2. **정적 파일 서빙**
```nginx
location /static/ {
    alias /static/;
}
```

3. **SSL/TLS 종료점**
```nginx
server {
    listen 443 ssl;
    ssl_certificate /etc/ssl/certs/cert.pem;
    ssl_certificate_key /etc/ssl/private/key.pem;
}
```

4. **로드 밸런싱**
```nginx
upstream backend_servers {
    server backend1:8000;
    server backend2:8000;
    server backend3:8000;
}
```

---

## 7. 협업 기능 관련

### Q7-1: 여행 계획 동시 편집은 어떻게 동기화되나요?

**답변:**
**WebSocket 브로드캐스트 + Optimistic Update** 방식입니다.

**플로우:**
```
1. 사용자 A: 일정 추가 (UI 즉시 업데이트)
2. 서버: DB 저장 + WebSocket 브로드캐스트
3. 사용자 B, C: WebSocket 메시지 수신 → UI 업데이트
```

**코드 구현:**
```python
# backend/apps/plans/views.py
def perform_create(self, serializer):
    instance = serializer.save()

    # 실시간 브로드캐스트
    chat_room = ChatRoom.objects.filter(trip_idx=instance.trip_idx).first()
    channel_layer = get_channel_layer()

    async_to_sync(channel_layer.group_send)(
        f'trip_chat_{chat_room.room_idx}',
        {
            'type': 'planner_updated',
            'updated_by': self.request.user.email,
            'trip_idx': instance.trip_idx.trip_idx,
            'message': f'{self.request.user.email}님이 일정을 추가했습니다.'
        }
    )
```

### Q7-2: 초대 코드 시스템은 어떻게 작동하나요?

**답변:**
**6자리 영숫자 코드**를 자동 생성합니다.

**생성 로직:**
```python
# backend/apps/plans/models.py
import random
import string

def generate_invite_code():
    characters = string.ascii_uppercase + string.digits
    while True:
        code = ''.join(random.choices(characters, k=6))
        if not Trip.objects.filter(invite_code=code).exists():
            return code

class Trip(models.Model):
    invite_code = models.CharField(
        max_length=6,
        unique=True,
        default=generate_invite_code
    )
```

**참여 플로우:**
```
1. 사용자 B: 초대 코드 입력 (예: "8BJQ67")
2. 서버: Trip 조회 + TripMember 생성
3. 서버: ChatRoom 멤버로 추가
4. WebSocket: 기존 멤버들에게 "새 멤버 참여" 알림
```

### Q7-3: 동시에 같은 일정을 수정하면 어떻게 되나요?

**답변:**
**마지막 저장이 우선 (Last Write Wins)** 방식입니다.

**현재 구현:**
- 낙관적 업데이트 (Optimistic Update)
- 충돌 감지 없음
- 마지막 저장 내용으로 덮어쓰기

**향후 개선 계획:**
1. **버전 관리 (Optimistic Locking)**
```python
class Item(models.Model):
    version = models.IntegerField(default=1)

    def save(self, *args, **kwargs):
        if self.pk:
            # 버전 충돌 확인
            current = Item.objects.get(pk=self.pk)
            if current.version != self.version:
                raise ConflictError("다른 사용자가 수정했습니다.")
            self.version += 1
        super().save(*args, **kwargs)
```

2. **실시간 잠금 표시**
```
사용자 A가 "Day 1 - 09:00" 편집 중
→ 사용자 B에게 "🔒 수정 중..." 표시
```

---

## 8. 배포 및 인프라 관련

### Q8-1: Docker Compose를 사용한 이유는?

**답변:**
**로컬 개발 환경과 운영 환경의 일관성**을 위해서입니다.

**장점:**
1. **환경 통일**: 모든 팀원이 동일한 환경에서 개발
2. **간편한 실행**: `docker-compose up` 한 번에 모든 서비스 시작
3. **의존성 관리**: 서비스 간 네트워크, 볼륨 자동 설정
4. **배포 간소화**: 같은 구성으로 운영 서버 배포

**서비스 구성:**
```yaml
services:
  - postgres (DB)
  - redis (메시지 브로커)
  - backend (Django REST API)
  - websocket (Django WebSocket)
  - frontend (Next.js)
  - nginx (리버스 프록시)
  - airflow-webserver (배치 작업)
  - airflow-scheduler
```

### Q8-2: 컨테이너 간 통신은 어떻게 하나요?

**답변:**
**Docker 네트워크**를 사용합니다.

```yaml
# docker-compose.yml
networks:
  triplan-network:
    driver: bridge

services:
  backend:
    networks:
      - triplan-network
    environment:
      - DATABASE_URL=postgresql://postgres:lecun123!@#@postgres:5432/lecun2
      #                                                  ^^^^^^^^ 서비스명으로 접근
```

**특징:**
- 서비스명을 hostname으로 사용
- 내부 DNS 자동 설정
- 외부 네트워크와 격리

### Q8-3: 데이터 영속성은 어떻게 보장하나요?

**답변:**
**Docker Volume**을 사용합니다.

```yaml
services:
  postgres:
    volumes:
      - ./data/postgres:/var/lib/postgresql/data  # 호스트에 저장

  redis:
    volumes:
      - ./data/redis:/data
```

**장점:**
- 컨테이너 재시작/삭제해도 데이터 유지
- 호스트 파일시스템에 직접 저장
- 백업 및 복구 용이

---

## 9. AI 기능 관련

### Q9-1: OpenAI API는 어떻게 활용하나요?

**답변:**
현재는 **사용 준비만 완료**된 상태이며, 향후 다음 기능 구현 예정:

1. **여행지 추천**
```python
# 사용자 선호도 기반 추천
user_preference = "자연 경관, 조용한 분위기"
recommendations = openai.ChatCompletion.create(
    model="gpt-4",
    messages=[{
        "role": "user",
        "content": f"제주도에서 {user_preference}에 맞는 여행지 추천"
    }]
)
```

2. **일정 자동 생성**
```python
# 3일 여행 일정 자동 생성
itinerary = openai.ChatCompletion.create(
    model="gpt-4",
    messages=[{
        "role": "user",
        "content": "제주도 2박3일 여행 일정 생성 (가족 여행, 렌터카 이용)"
    }]
)
```

3. **벡터 검색 (Embedding API)**
```python
# 유사 여행지 검색
embedding = openai.Embedding.create(
    input=place.description,
    model="text-embedding-3-small"
)
similar_places = Place.objects.order_by(
    embedding__cosine_distance(embedding)
)[:5]
```

### Q9-2: Airflow는 무엇에 사용하나요?

**답변:**
**배치 작업 스케줄링**을 위해 사용합니다.

**현재 DAG (Directed Acyclic Graph):**
1. **Google Places API 데이터 수집**
   - 매일 새벽 2시 실행
   - 새로운 여행지 정보 크롤링
   - PostgreSQL에 저장

2. **향후 추가 예정:**
   - 여행지 리뷰 수집
   - 인기 여행지 랭킹 계산
   - 오래된 데이터 아카이빙

**Airflow 구성:**
```python
# airflow/dags/collect_places.py
from airflow import DAG
from datetime import datetime, timedelta

dag = DAG(
    'collect_places',
    schedule_interval='0 2 * * *',  # 매일 새벽 2시
    start_date=datetime(2025, 1, 1)
)

task1 = PythonOperator(
    task_id='fetch_google_places',
    python_callable=fetch_places_from_google,
    dag=dag
)
```

---

## 10. 성능 및 최적화 관련

### Q10-1: API 성능 최적화는 어떻게 했나요?

**답변:**
주요 최적화 기법:

1. **Django ORM Select Related**
```python
# N+1 쿼리 방지
trips = Trip.objects.select_related('creator').prefetch_related('members')
```

2. **Pagination**
```python
# DRF Pagination
class PlaceViewSet(viewsets.ModelViewSet):
    pagination_class = PageNumberPagination
    page_size = 20
```

3. **Database Indexing**
```python
class Trip(models.Model):
    invite_code = models.CharField(max_length=6, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
```

### Q10-2: 프론트엔드 성능 최적화는?

**답변:**

1. **Next.js SSR/SSG**
```tsx
// Static Site Generation
export async function getStaticProps() {
  const places = await fetchPlaces();
  return { props: { places } };
}
```

2. **코드 스플리팅**
```tsx
import dynamic from 'next/dynamic';

const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,  // 클라이언트에서만 로드
});
```

3. **이미지 최적화**
```tsx
import Image from 'next/image';

<Image
  src="/place.jpg"
  width={500}
  height={300}
  alt="Place"
  loading="lazy"  // Lazy loading
/>
```

### Q10-3: WebSocket 연결 수가 많아지면 어떻게 대응하나요?

**답변:**

1. **수평적 확장 (Scale-out)**
```yaml
# docker-compose.yml
websocket:
  deploy:
    replicas: 3  # WebSocket 서버 3개
```

2. **Redis Cluster**
```python
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [
                ("redis1", 6379),
                ("redis2", 6379),
                ("redis3", 6379),
            ],
        },
    },
}
```

3. **Connection Pooling**
```python
# Django DB Connection Pool
DATABASES = {
    'default': {
        'CONN_MAX_AGE': 600,  # 10분 동안 연결 재사용
    }
}
```

### Q10-4: 데이터베이스 쿼리 최적화는?

**답변:**

1. **쿼리 개수 확인**
```python
from django.db import connection
print(len(connection.queries))  # 실행된 쿼리 개수
```

2. **Explain Analyze**
```sql
EXPLAIN ANALYZE
SELECT * FROM plans_trip
WHERE invite_code = '8BJQ67';
```

3. **복합 인덱스**
```python
class Item(models.Model):
    class Meta:
        indexes = [
            models.Index(fields=['day_idx', 'start_time']),  # 복합 인덱스
        ]
```

---

## 11. 추가 질문

### Q11-1: 테스트는 어떻게 하나요?

**답변:**

**백엔드 테스트:**
```python
# backend/apps/plans/tests.py
from django.test import TestCase

class TripTestCase(TestCase):
    def test_create_trip(self):
        trip = Trip.objects.create(
            name="제주도 여행",
            start_date="2025-01-20",
            end_date="2025-01-22"
        )
        self.assertEqual(trip.name, "제주도 여행")
```

**프론트엔드 테스트 (향후):**
```tsx
// Jest + React Testing Library
import { render, screen } from '@testing-library/react';

test('renders trip name', () => {
  render(<TripCard trip={mockTrip} />);
  expect(screen.getByText('제주도 여행')).toBeInTheDocument();
});
```

### Q11-2: 에러 처리는 어떻게 하나요?

**답변:**

**백엔드:**
```python
# Django REST Framework Exception Handler
from rest_framework.views import exception_handler

def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is not None:
        response.data['status_code'] = response.status_code

    return response
```

**프론트엔드:**
```typescript
// Axios Interceptor
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 500) {
      toast.error('서버 오류가 발생했습니다.');
    }
    return Promise.reject(error);
  }
);
```

### Q11-3: 로깅은 어떻게 관리하나요?

**답변:**

**Django 로깅:**
```python
# settings.py
LOGGING = {
    'version': 1,
    'handlers': {
        'file': {
            'class': 'logging.FileHandler',
            'filename': 'django.log',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['file'],
            'level': 'INFO',
        },
    },
}
```

**사용:**
```python
import logging
logger = logging.getLogger(__name__)

logger.info(f"User {user.email} created a trip")
logger.error(f"Failed to create trip: {str(e)}")
```

---

## 📌 발표 팁

1. **기술 용어 설명 준비**
   - WebSocket, Redis Pub/Sub, JWT 등 핵심 개념 설명 가능하도록

2. **실제 코드 보여주기**
   - 질문 받으면 실제 코드 화면 공유

3. **트레이드오프 이해**
   - "왜 Socket.IO 안 썼나요?" → 번들 크기 vs 기능
   - "왜 1시간/7일인가요?" → 보안 vs UX

4. **향후 계획 언급**
   - 현재 미구현 기능도 솔직히 공유
   - 개선 방향 제시

5. **데모 시나리오**
   - 실시간 협업 기능 직접 시연
   - 두 개 브라우저로 동시 편집 테스트

---

**작성일**: 2025-01-24
**버전**: 1.0
**관련 문서**: IMPLEMENTATION_SUMMARY.md, COLLABORATIVE_CHAT_SETUP.md
