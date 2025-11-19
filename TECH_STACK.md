# Triplan 프로젝트 - 기술 스택 및 아키텍처

## 목차
1. [프로젝트 개요](#프로젝트-개요)
2. [시스템 아키텍처](#시스템-아키텍처)
3. [기술 스택 및 선택 근거](#기술-스택-및-선택-근거)
4. [데이터베이스 설계](#데이터베이스-설계)
5. [성능 최적화](#성능-최적화)
6. [보안 설계](#보안-설계)

---

## 프로젝트 개요

**Triplan** - AI 기반 실시간 협업 여행 플래너

### 핵심 기능
- 여행 계획 작성 및 관리
- AI 기반 여행지 추천 (LangChain + OpenAI GPT + pgvector)
- 실시간 채팅 및 협업 편집 (WebSocket)
- 카카오맵 연동 장소 검색
- 초대 코드 기반 여행 공유

### 아키텍처 타입
마이크로서비스 기반 클라우드 네이티브 애플리케이션

---

## 시스템 아키텍처

### 전체 구조
```
[클라이언트 - 브라우저]
React 18 + Next.js 14 + TypeScript
            |
            | HTTP/WebSocket
            v
[Nginx - 리버스 프록시]
포트 80/443 - 외부 진입점
            |
    +-------+-------+
    |               |
    v               v
[Backend API]   [WebSocket Server]
Django+Gunicorn Django+Daphne
포트 8000       포트 8001
    |               |
    +-------+-------+
            |
    +-------+-------+-------+
    |       |       |       |
    v       v       v       v
[PostgreSQL][Redis][Airflow]
 +pgvector  캐시   데이터ETL
```

### 서비스 구성 (9개 컨테이너)
1. **postgres** - PostgreSQL + pgvector (5432)
2. **redis** - Redis (6379)
3. **backend** - Django + Gunicorn (8000)
4. **websocket** - Django Channels + Daphne (8001)
5. **frontend** - Next.js (3000)
6. **nginx** - Nginx (80, 443)
7. **airflow-postgres** - Airflow 메타데이터 DB
8. **airflow-webserver** - Airflow UI (8080)
9. **airflow-scheduler** - Airflow 스케줄러

---

## 기술 스택 및 선택 근거

### Frontend

#### 1. React 18.2.0
**선택 근거**
- 가상 DOM으로 높은 렌더링 성능
- 풍부한 생태계 - 컴포넌트 라이브러리, UI 프레임워크
- 컴포넌트 기반 재사용성 - DayPlanningCard, TimelineView 등
- Hooks API - useState, useEffect로 상태 관리 단순화
- 대규모 커뮤니티 - 문제 해결 용이

**사용 사례**
- 플래너 페이지 동적 UI
- 실시간 채팅 위젯
- 캘린더, 타임라인 컴포넌트

#### 2. Next.js 14.1.0
**선택 근거**
- SSR (Server-Side Rendering) - SEO 최적화, 초기 로딩 속도 개선
- 파일 기반 라우팅 - pages/planner.tsx → /planner 자동 매핑
- API Routes - /api/* 엔드포인트 쉽게 구현 가능
- Image Optimization - 자동 이미지 최적화
- Hot Reload - 개발 생산성 향상 (코드 변경 즉시 반영)
- Code Splitting - 자동 번들 최적화

**사용 사례**
- pages/planner.tsx - 플래너 페이지
- pages/mypage.tsx - 마이페이지
- pages/index.tsx - 랜딩 페이지

**개발 환경 설정**
```yaml
# docker-compose.yml - Hot Reload 활성화
volumes:
  - ./frontend:/app          # 로컬 코드 마운트
command: npm run dev         # 개발 서버 실행
```

#### 3. TypeScript 5.3.3
**선택 근거**
- 정적 타입 검사 - 런타임 에러 사전 방지
- IntelliSense 지원 - 자동완성, 리팩토링 용이
- 인터페이스 정의 - TripPlan, DayPlan, ScheduleItem 등 명확한 타입
- 대규모 프로젝트 유지보수성 향상

**사용 사례**
```typescript
// src/services/tripAPI.ts
export interface TripPlan {
  trip_idx: number;
  title: string;
  start_date: string;
  end_date: string;
  country_idx?: number;
  region1_idx?: number;
}
```

#### 4. Material-UI (MUI) 5.15.6
**선택 근거**
- Material Design - 구글의 검증된 디자인 시스템
- 풍부한 컴포넌트 - Button, Select, Modal, Dialog 등 200+ 컴포넌트
- 커스터마이징 용이 - sx props로 인라인 스타일링
- 반응형 디자인 - Grid, Box 시스템
- 접근성 (a11y) - WAI-ARIA 표준 준수

**사용 사례**
- 플래너 폼 UI (Select, TextField, Button)
- 모달/다이얼로그
- 네비게이션 바

#### 5. Recoil 0.7.7
**선택 근거**
- React 친화적 - Hooks 기반 API
- 간결한 전역 상태 관리 - Redux보다 보일러플레이트 적음
- Atom/Selector 패턴 - 상태 분리 및 조합 용이
- 비동기 상태 지원 - API 호출 결과 캐싱

**사용 사례**
```typescript
// src/recoil/atoms.ts
export const userState = atom<User | null>({
  key: 'userState',
  default: null,
});
```

#### 6. Socket.IO Client 4.6.1
**선택 근거**
- 실시간 양방향 통신 - 채팅, 협업 편집
- 자동 재연결 - 네트워크 끊김 시 자동 복구
- Room 기능 - 여행 코드별 채팅방 구현
- Fallback 지원 - WebSocket 불가 시 Long Polling

**사용 사례**
- 실시간 채팅
- 협업 편집 동기화
- 초대 알림

#### 7. Axios 1.6.5
**선택 근거**
- Promise 기반 HTTP 클라이언트
- Interceptor - JWT 토큰 자동 추가
- 에러 핸들링 - 통일된 에러 처리
- 타임아웃 설정

**사용 사례**
```typescript
// src/services/api.ts
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

#### 8. react-kakao-maps-sdk 1.1.24
**선택 근거**
- 카카오맵 API React Wrapper - Hooks 기반 사용
- 장소 검색 연동
- 마커, 인포윈도우 지원

**사용 사례**
- 여행지 검색 및 지도 표시
- 장소 위치 시각화

#### 9. SWR 2.2.4
**선택 근거**
- 데이터 페칭 & 캐싱 - Stale-While-Revalidate 전략
- 자동 갱신 - 포커스 시 자동 리페치
- 낙관적 UI 업데이트
- Revalidation - 주기적 데이터 동기화

**사용 사례**
- 여행 목록 조회 캐싱
- 장소 데이터 페칭

---

### Backend

#### 1. Django 4.2.9
**선택 근거**
- Python 웹 프레임워크 표준 - MTV 패턴
- 강력한 ORM - 복잡한 쿼리도 Python 코드로 작성
- Admin 패널 - 관리자 페이지 자동 생성
- 보안 - CSRF, XSS, SQL Injection 기본 방어
- Django Channels 연동 - WebSocket 지원

**사용 사례**
- REST API 서버
- 데이터베이스 ORM
- 관리자 페이지

#### 2. Django REST Framework 3.14.0
**선택 근거**
- RESTful API 구축 프레임워크
- Serializer - 데이터 직렬화/역직렬화
- ViewSet - CRUD 자동 생성
- 권한 관리 - Permission Classes
- Pagination - 페이지네이션 자동 처리
- API Browsable UI - 개발 시 API 테스트 용이

**사용 사례**
```python
# backend/apps/plans/views.py
class TripViewSet(viewsets.ModelViewSet):
    queryset = Trip.objects.all()
    serializer_class = TripSerializer
    permission_classes = [IsAuthenticated]
```

#### 3. PostgreSQL 15 + pgvector 0.2.4
**선택 근거**
- 관계형 데이터베이스 (RDBMS) - ACID 트랜잭션 보장
- pgvector 확장 - 벡터 유사도 검색 (AI 추천 시스템)
- JSON 타입 지원 - 유연한 데이터 저장
- Full-Text Search - 텍스트 검색 최적화
- 고급 인덱싱 - GIN, GiST, IVFFlat 인덱스

**사용 사례**
```sql
-- 벡터 유사도 검색 (AI 추천)
SELECT * FROM places
ORDER BY embedding <-> query_vector
LIMIT 10;
```

**DB 구조**
- common_country → common_region1 → common_region2 (3단계 지역)
- Trip → Day → Item (여행 계획)
- Place (장소 정보 + 벡터 임베딩)

#### 4. Redis 7
**선택 근거**
- In-Memory 데이터 저장소 - 초고속 읽기/쓰기
- Django Channels Layer - WebSocket 메시지 브로커
- 세션 캐싱 - 사용자 세션 저장
- API 응답 캐싱 - 반복 쿼리 성능 향상
- Pub/Sub - 실시간 메시지 전달

**사용 사례**
- WebSocket 메시지 브로커
- API 응답 캐싱 (TTL 설정)
- 사용자 세션 저장

#### 5. Django Channels 4.0.0 + Daphne 4.0.0
**선택 근거**
- WebSocket 지원 - Django에서 실시간 통신
- ASGI 표준 - 비동기 처리
- Channel Layer - Redis 기반 메시지 전달
- Consumer - WebSocket 이벤트 핸들러
- Routing - WebSocket URL 라우팅

**아키텍처**
```
Client A ---+
Client B ---+---> WebSocket Server (Daphne) ---> Redis Channel Layer
Client C ---+                                           |
                                                        v
                                              Pub/Sub 메시지 전달
```

**사용 사례**
```python
# backend/apps/chat/consumers.py
class ChatConsumer(AsyncWebsocketConsumer):
    async def receive(self, text_data):
        # 메시지 수신 -> Redis Pub/Sub -> 모든 클라이언트에게 전달
        await self.channel_layer.group_send(
            self.room_group_name,
            {'type': 'chat_message', 'message': message}
        )
```

#### 6. Gunicorn 21.2.0
**선택 근거**
- WSGI 서버 - Django 프로덕션 배포
- Multi-worker - 4 workers로 동시 요청 처리
- 안정성 - 검증된 프로덕션 서버
- 로드 밸런싱 - Worker 간 자동 분배

**설정**
```yaml
command: gunicorn config.wsgi:application
  --bind 0.0.0.0:8000
  --workers 4
  --timeout 300
```

#### 7. djangorestframework-simplejwt 5.3.1
**선택 근거**
- JWT 토큰 인증 - Stateless 인증 (세션 불필요)
- Access Token + Refresh Token - 보안성 향상
- 자동 갱신 - Refresh Token으로 재발급
- Blacklist - 토큰 무효화 지원

**인증 흐름**
```
Login -> Access Token (15분) + Refresh Token (7일)
       |
       v
API 요청 시 Access Token 검증
       |
       v
만료 시 Refresh Token으로 재발급
```

---

### AI/ML

#### 1. LangChain 0.1.0 + LangGraph 0.0.20
**선택 근거**
- LLM 애플리케이션 프레임워크 - 복잡한 AI 워크플로우 구축
- Chain 패턴 - 여러 AI 작업 연결
- Agent - 자율적인 의사결정
- Memory - 대화 컨텍스트 유지
- LangGraph - 복잡한 그래프 기반 워크플로우

**사용 사례**
```
사용자 쿼리 -> LangChain Agent -> pgvector 검색 -> GPT 응답 생성
```

#### 2. OpenAI GPT-4 (openai 1.7.2)
**선택 근거**
- 자연어 이해 - 사용자 의도 파악
- 텍스트 생성 - 여행 추천 설명문 생성
- 대화형 AI - 챗봇 기능
- 고품질 응답 - GPT-4의 높은 정확도

**사용 사례**
- "부산에서 가볼만한 카페 추천해줘" -> GPT-4가 컨텍스트 이해 후 응답 생성

#### 3. Sentence Transformers 2.2.2
**선택 근거**
- 텍스트 임베딩 - 문장을 벡터로 변환
- 의미적 유사도 검색 - pgvector와 연동
- 다국어 지원 - 한국어 모델 사용 가능
- 빠른 추론 속도

**워크플로우**
```
장소 설명 텍스트 -> Sentence Transformer -> 벡터(512차원)
                                              |
                                              v
                                         pgvector 저장
                                              |
                                              v
사용자 쿼리 -> 벡터 변환 -> 유사도 검색 -> 추천 결과
```

#### 4. PyTorch 2.1.2
**선택 근거**
- 딥러닝 프레임워크 - Transformers 모델 실행
- GPU 가속 - 빠른 추론 속도
- 풍부한 생태계 - Hugging Face와 연동

---

### 데이터 파이프라인

#### Apache Airflow
**선택 근거**
- 워크플로우 자동화 - DAG (Directed Acyclic Graph) 기반
- 스케줄링 - Cron 표현식으로 주기적 실행
- 의존성 관리 - Task 간 순서 제어
- 모니터링 - Web UI로 실행 상태 확인
- 확장성 - 대규모 데이터 처리 가능

**DAG 예시**
```python
# airflow/dags/update_embeddings.py
dag = DAG(
    'update_place_embeddings',
    schedule_interval='0 3 * * *',  # 매일 03:00 실행
    default_args={'owner': 'triplan'}
)

# Task 1: 장소 데이터 조회
fetch_places = PythonOperator(...)

# Task 2: 임베딩 생성
generate_embeddings = PythonOperator(...)

# Task 3: pgvector 업데이트
update_db = PostgresOperator(...)

fetch_places >> generate_embeddings >> update_db
```

---

### Infrastructure

#### 1. Docker + Docker Compose
**선택 근거**
- 컨테이너화 - 환경 일관성 보장
- 마이크로서비스 관리 - 9개 컨테이너 통합 관리
- 개발/프로덕션 환경 통일
- 빠른 배포 - 이미지 기반 배포
- 격리 - 서비스 간 독립성

**컨테이너 구성**
```
1. postgres     - PostgreSQL + pgvector
2. redis        - Redis
3. backend      - Django + Gunicorn
4. websocket    - Django + Daphne
5. frontend     - Next.js
6. nginx        - 리버스 프록시
7. airflow-postgres - Airflow 메타 DB
8. airflow-webserver
9. airflow-scheduler
```

#### 2. Nginx
**선택 근거**
- 리버스 프록시 - 외부 요청 라우팅
- 로드 밸런싱 - 여러 백엔드 인스턴스 분산
- 정적 파일 서빙 - Static/Media 파일 캐싱
- SSL/TLS 종료 - HTTPS 처리
- Gzip 압축 - 전송 데이터 크기 감소

**라우팅**
```
http://domain/       -> Frontend (3000)
http://domain/api/   -> Backend (8000)
http://domain/ws/    -> WebSocket (8001)
http://domain/static -> Nginx 직접 서빙
```

#### 3. AWS EC2 (7개 인스턴스)
**선택 근거**
- 마이크로서비스 분리 - 서비스별 독립 배포
- 확장성 - 트래픽 증가 시 인스턴스 추가
- 보안 - VPC Private Subnet 격리
- 비용 효율 - 필요한 만큼만 사용

**인스턴스 구성**
```
1. EC2 (t3.micro)   - Nginx
2. EC2 (t3.small)   - Frontend
3. EC2 (t3.medium)  - Backend
4. EC2 (t3.small)   - WebSocket
5. EC2 (t3.micro)   - Redis
6. EC2 (t3.medium)  - PostgreSQL
7. EC2 (t3.medium)  - Airflow

예상 비용: 월 $150-200
```

---

## 데이터베이스 설계

### ERD (핵심 테이블)

```
[User]                    [Trip]
user_idx (PK) ------+     trip_idx (PK)
email               |     user_idx (FK)
password_hash       |     title
nickname            |     start_date
                    |     end_date
                    +---> country_idx
                          region1_idx
                               |
                               | 1:N
                               v
                          [Day]
                          day_idx (PK)
                          trip_idx (FK)
                          day_no
                          date
                               |
                               | 1:N
                               v
                          [Item]
                          item_idx (PK)
                          day_idx (FK)
                          place_idx (FK)
                          start_time
                          title
                          notes

[Country] --1:N--> [Region1] --1:N--> [Region2]
country_idx        region1_idx        region2_idx
country_name       country_idx (FK)   region1_idx (FK)
country_code       city_name          region2_name

[Place]
place_idx (PK)
name
address
latitude
longitude
embedding (vector)  <- pgvector
```

### 주요 테이블 설명

**1. User 테이블**
- 사용자 인증 정보
- bcrypt 해시된 비밀번호

**2. Trip 테이블**
- 여행 계획의 기본 정보
- country_idx, region1_idx로 여행지 참조

**3. Day 테이블**
- 여행의 일차별 정보
- trip_idx로 특정 여행과 연결

**4. Item 테이블**
- 일정의 상세 항목 (장소, 시간, 메모)
- day_idx로 특정 날짜와 연결
- place_idx로 장소 정보 참조

**5. Country/Region1/Region2 테이블**
- 3단계 지역 계층 구조
- 국가 -> 도시 -> 상세 지역

**6. Place 테이블**
- 장소 정보 (이름, 주소, 좌표)
- embedding 컬럼에 벡터 저장 (AI 추천용)

---

## 성능 최적화

### Frontend 최적화
- **Code Splitting** - Next.js 자동 번들 분할
- **SWR 캐싱** - API 응답 캐싱 및 자동 갱신
- **Image Optimization** - next/image 사용
- **Lazy Loading** - 컴포넌트 지연 로딩

### Backend 최적화
- **Redis 캐싱** - 반복 쿼리 캐싱 (TTL 설정)
- **DB 인덱싱** - 복합 인덱스, pgvector IVFFlat 인덱스
- **Gunicorn Multi-worker** - 4 workers로 동시 처리
- **Connection Pooling** - DB 연결 재사용
- **select_related / prefetch_related** - N+1 쿼리 문제 해결

### Database 최적화
- **pgvector 인덱싱** - IVFFlat 인덱스로 벡터 검색 가속
- **Query 최적화** - Explain Analyze로 쿼리 분석
- **적절한 인덱스** - 자주 조회되는 컬럼에 인덱스 생성

### Infrastructure 최적화
- **Nginx 캐싱** - 정적 파일 캐싱
- **Gzip 압축** - 전송 데이터 압축
- **CDN** - 정적 자산 배포 (확장 시)

---

## 보안 설계

### 인증/인가
- **JWT 토큰** - Stateless 인증
- **Access Token (15분) + Refresh Token (7일)**
- **HTTP Only Cookie** - XSS 방어
- **Token Blacklist** - 로그아웃 시 토큰 무효화

### 데이터 보호
- **비밀번호 해싱** - bcrypt (Cost Factor 12)
- **HTTPS** - SSL/TLS 암호화
- **CORS 정책** - 허용된 도메인만 접근
- **SQL Injection 방어** - Django ORM 사용
- **XSS 방어** - 입력값 sanitization

### 인프라 보안
- **VPC Private Subnet** - DB, Redis 외부 접근 차단
- **Security Group** - 포트별 접근 제어
  - Nginx: 80, 443 (Public)
  - Frontend: 3000 (Nginx만 허용)
  - Backend: 8000 (Nginx만 허용)
  - WebSocket: 8001 (Nginx만 허용)
  - Redis: 6379 (Backend, WebSocket만)
  - PostgreSQL: 5432 (Backend, WebSocket, Airflow만)
- **SSH 키 페어** - 서버 접근 인증
- **.env 파일 분리** - 민감 정보 격리 (Git 제외)

### 모니터링
- **Sentry** - 에러 트래킹 및 알림
- **CloudWatch** - AWS 리소스 모니터링 (옵션)
- **Docker Logs** - 컨테이너 로그 수집

---

## 핵심 설계 결정 요약

### 1. 왜 마이크로서비스 아키텍처인가?
- Backend API와 WebSocket 서버 분리 -> 독립적 확장
- 서비스별 장애 격리
- 기술 스택 유연성 (각 서비스마다 다른 기술 선택 가능)

### 2. 왜 PostgreSQL + pgvector인가?
- 관계형 데이터 + 벡터 검색을 **하나의 DB에서 처리**
- 별도 벡터 DB (Pinecone, Weaviate) 불필요 -> 비용 절감
- ACID 트랜잭션 보장

### 3. 왜 Redis를 사용하는가?
- WebSocket 메시지 브로커 (Django Channels Layer)
- API 응답 캐싱 -> DB 부하 감소
- 세션 저장 -> 빠른 인증 처리

### 4. 왜 Next.js인가?
- SSR로 SEO 최적화 (여행 후기 페이지 검색 노출)
- 파일 기반 라우팅으로 개발 속도 향상
- Hot Reload로 개발 생산성 극대화

### 5. 왜 LangChain + OpenAI GPT인가?
- 복잡한 AI 워크플로우 구축 (pgvector 검색 -> GPT 응답 생성)
- 자연어 질의 처리
- 컨텍스트 기반 추천

---

## 확장 계획

### 현재 아키텍처
- Single Instance per Service
- Docker Compose 기반 배포

### 향후 확장 계획

**1. 컨테이너 오케스트레이션**
- Docker Compose -> **Kubernetes (EKS)** 또는 **ECS**
- Auto Scaling - 트래픽 기반 Pod/Task 자동 확장

**2. 로드 밸런서**
- Nginx -> **AWS ALB/NLB**
- 여러 Backend/Frontend 인스턴스 분산

**3. 데이터베이스 고가용성**
- PostgreSQL Single -> **RDS Multi-AZ**
- Read Replica 추가
- Redis Single -> **ElastiCache Cluster**

**4. CI/CD 파이프라인**
- **GitHub Actions** - 자동 테스트 및 배포
- Blue-Green Deployment

**5. 모니터링 강화**
- **Prometheus + Grafana** - 메트릭 수집 및 시각화
- **ELK Stack** - 로그 중앙화

**6. CDN**
- **CloudFront** - 정적 자산 캐싱 및 배포

---

## 결론

이 기술 스택은 **확장성, 성능, 보안, 개발 생산성**을 모두 고려하여 선택되었으며, 실시간 협업과 AI 추천 기능을 제공하는 현대적인 여행 플래너 서비스를 구현하기에 최적화되어 있습니다.

**주요 특징**
- 마이크로서비스 기반 확장 가능한 아키텍처
- AI 기반 추천 시스템 (LangChain + GPT + pgvector)
- 실시간 협업 기능 (WebSocket + Redis)
- 클라우드 네이티브 배포 (Docker + AWS EC2)
- 높은 개발 생산성 (TypeScript + Next.js + Django)
