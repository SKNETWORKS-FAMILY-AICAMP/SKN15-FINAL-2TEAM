# TriPlan 프로젝트 종합 기술 문서 - Part 1: 아키텍처 및 개요

> **작성일**: 2025-01-20
> **프로젝트**: TriPlan - 협업 여행 플래너
> **버전**: 1.0.0

---

## 📋 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [전체 시스템 아키텍처](#2-전체-시스템-아키텍처)
3. [기술 스택 총정리](#3-기술-스택-총정리)
4. [디렉토리 구조](#4-디렉토리-구조)
5. [인프라 아키텍처](#5-인프라-아키텍처)

---

## 1. 프로젝트 개요

### 1.1 프로젝트 소개

**TriPlan**은 실시간 협업 기능을 갖춘 여행 계획 플랫폼입니다. 여러 사용자가 동시에 여행 계획을 작성하고, 실시간 채팅을 통해 소통하며, AI 챗봇의 도움을 받아 최적의 여행 일정을 만들 수 있습니다.

### 1.2 핵심 기능

#### 🗓️ **여행 계획 관리**
- 다중 여행 생성 및 관리
- 일차별 상세 일정 작성
- 장소, 식사, 활동, 이동 등 다양한 일정 타입 지원
- 예산 관리 및 비용 추적
- 초대 코드를 통한 간편한 멤버 추가

#### 👥 **실시간 협업**
- WebSocket 기반 실시간 채팅
- 플래너 데이터 실시간 동기화 (Redis Pub/Sub)
- 멤버 입장/퇴장 알림
- 타이핑 인디케이터
- 역할 기반 권한 관리 (Owner, Editor, Commenter, Viewer)

#### 🤖 **AI 챗봇 지원**
- OpenAI API 기반 여행 추천
- 대화 컨텍스트 인식
- 여행 정보 기반 맞춤형 응답

#### 📊 **데이터 수집 자동화**
- Apache Airflow를 통한 ETL 파이프라인
- 날씨 정보 자동 수집 (6시간마다)
- 환율 정보 자동 수집 (매일 오전 9시)

#### 🌍 **지도 및 위치 정보**
- Kakao Map API 통합
- 장소 검색 및 표시
- 여행지 정보 시각화

#### 🔐 **인증 및 보안**
- JWT 토큰 기반 인증
- 이메일 기반 사용자 관리
- 자동 토큰 갱신 (Refresh Token)
- CORS 설정 및 보안 헤더

---

## 2. 전체 시스템 아키텍처

### 2.1 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Web Browser (Next.js Frontend)                          │  │
│  │  - React Components                                       │  │
│  │  - WebSocket Client                                       │  │
│  │  - Kakao Map Integration                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓ HTTP/HTTPS/WS
┌─────────────────────────────────────────────────────────────────┐
│                      Presentation Layer                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Nginx (Reverse Proxy)                                    │  │
│  │  - Load Balancing                                         │  │
│  │  - SSL Termination                                        │  │
│  │  - Static File Serving                                    │  │
│  │  - Request Routing                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                    ↓                    ↓                    ↓
     ┌──────────────┴──────────┬─────────┴──────────┬────────┘
     ↓                         ↓                    ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Application Layer                             │
│  ┌─────────────┐    ┌─────────────┐    ┌──────────────────┐   │
│  │  Frontend   │    │   Backend   │    │   WebSocket      │   │
│  │  (Next.js)  │    │   (Django)  │    │   (Daphne)       │   │
│  │             │    │             │    │                  │   │
│  │  Port 3000  │    │  Port 8000  │    │   Port 8001      │   │
│  │             │    │             │    │                  │   │
│  │  - SSR/CSR  │    │  - REST API │    │  - WebSocket     │   │
│  │  - UI Logic │    │  - Business │    │  - Real-time     │   │
│  │             │    │    Logic    │    │    Chat          │   │
│  └─────────────┘    └─────────────┘    └──────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Data Layer                                  │
│  ┌─────────────────┐              ┌─────────────────┐          │
│  │  PostgreSQL     │              │     Redis       │          │
│  │  (pgvector)     │              │                 │          │
│  │                 │              │  - Channel      │          │
│  │  Port 5432      │              │    Layer        │          │
│  │                 │              │  - Cache        │          │
│  │  - Trip Data    │              │  - Pub/Sub      │          │
│  │  - User Data    │              │                 │          │
│  │  - Messages     │              │  Port 6379      │          │
│  │  - Vector Data  │              │                 │          │
│  └─────────────────┘              └─────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Data Processing Layer                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Apache Airflow                                           │  │
│  │                                                            │  │
│  │  ┌─────────────────┐        ┌─────────────────┐         │  │
│  │  │  Webserver      │        │   Scheduler     │         │  │
│  │  │  Port 8080      │        │                 │         │  │
│  │  └─────────────────┘        └─────────────────┘         │  │
│  │                                                            │  │
│  │  DAGs:                                                     │  │
│  │  - weather_collector (6시간마다)                         │  │
│  │  - exchange_rate_collector (매일 09:00)                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

External Services:
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│  OpenAI API    │  │  Kakao Map API │  │  Weather APIs  │
│  (Chatbot)     │  │  (Maps)        │  │  (Data Source) │
└────────────────┘  └────────────────┘  └────────────────┘
```

### 2.2 아키텍처 레이어 설명

#### **Layer 1: Client Layer (클라이언트 계층)**
- **역할**: 사용자 인터페이스 제공
- **기술**: Next.js, React, Material-UI
- **책임**:
  - 사용자 입력 처리
  - 화면 렌더링 (SSR/CSR)
  - WebSocket 연결 관리
  - 로컬 상태 관리

#### **Layer 2: Presentation Layer (프레젠테이션 계층)**
- **역할**: 요청 라우팅 및 로드 밸런싱
- **기술**: Nginx
- **책임**:
  - 리버스 프록시
  - SSL/TLS 종료
  - 정적 파일 서빙
  - 요청 분산
  - 보안 헤더 추가
  - Rate Limiting

#### **Layer 3: Application Layer (애플리케이션 계층)**
- **역할**: 비즈니스 로직 처리
- **기술**:
  - Frontend: Next.js (Port 3000)
  - Backend API: Django + Gunicorn (Port 8000)
  - WebSocket Server: Django Channels + Daphne (Port 8001)
- **책임**:
  - RESTful API 제공
  - WebSocket 연결 관리
  - 비즈니스 규칙 적용
  - 데이터 검증
  - 인증/인가

#### **Layer 4: Data Layer (데이터 계층)**
- **역할**: 데이터 저장 및 캐싱
- **기술**:
  - PostgreSQL with pgvector (Port 5432)
  - Redis (Port 6379)
- **책임**:
  - 영구 데이터 저장
  - 트랜잭션 관리
  - 실시간 메시지 브로커 (Redis Pub/Sub)
  - 캐싱
  - Vector 검색 (pgvector)

#### **Layer 5: Data Processing Layer (데이터 처리 계층)**
- **역할**: 배치 데이터 수집 및 처리
- **기술**: Apache Airflow
- **책임**:
  - ETL 파이프라인 실행
  - 스케줄링
  - 외부 API 호출
  - 데이터 변환 및 저장
  - 작업 모니터링

---

## 3. 기술 스택 총정리

### 3.1 프론트엔드

| 기술 | 버전 | 용도 | 선택 이유 |
|------|------|------|----------|
| **Next.js** | 14.1.0 | React 프레임워크 | SSR/CSR 지원, 파일 기반 라우팅, API Routes, 최적화된 빌드 |
| **React** | 18.x | UI 라이브러리 | 컴포넌트 기반 개발, 풍부한 생태계, Virtual DOM |
| **TypeScript** | 5.x | 타입 안전성 | 컴파일 타임 오류 검증, IDE 지원 강화, 코드 품질 향상 |
| **Material-UI (MUI)** | 5.x | UI 컴포넌트 | 프로페셔널한 디자인, 접근성, 커스터마이징 용이 |
| **Axios** | 1.x | HTTP 클라이언트 | 인터셉터 지원, 자동 JSON 변환, 취소 토큰 |
| **Kakao Map SDK** | Latest | 지도 서비스 | 한국 지도 최적화, 무료 API, 풍부한 기능 |

**프론트엔드 주요 기능**:
- **SSR (Server-Side Rendering)**: 초기 로딩 속도 향상, SEO 최적화
- **CSR (Client-Side Rendering)**: 동적 상호작용, SPA 경험
- **Code Splitting**: 페이지별 번들 분리로 로딩 최적화
- **WebSocket 클라이언트**: 실시간 채팅 및 데이터 동기화
- **토큰 자동 갱신**: Axios 인터셉터를 통한 무중단 인증

### 3.2 백엔드

| 기술 | 버전 | 용도 | 선택 이유 |
|------|------|------|----------|
| **Django** | 5.0+ | 웹 프레임워크 | Admin 패널, ORM, 보안 기능, 빠른 개발 |
| **Django REST Framework** | 3.14+ | REST API | Serializer, ViewSet, 권한 관리, Browsable API |
| **Django Channels** | 4.x | WebSocket | 비동기 처리, 채널 레이어, 프로토콜 라우팅 |
| **Daphne** | 4.x | ASGI 서버 | WebSocket 지원, HTTP/2, 비동기 처리 |
| **Gunicorn** | 21.x | WSGI 서버 | 프로덕션 배포, 워커 프로세스 관리, 안정성 |
| **PostgreSQL** | 15 | 관계형 DB | ACID, JSON 지원, Full-text search, 확장성 |
| **pgvector** | Latest | Vector DB 확장 | AI 임베딩 검색, 유사도 검색, ML 통합 |
| **Redis** | 7 | 인메모리 DB | 캐싱, Pub/Sub, 세션 저장, 빠른 속도 |
| **channels-redis** | 4.x | 채널 백엔드 | Redis를 채널 레이어로 사용 |
| **simplejwt** | 5.x | JWT 인증 | 토큰 기반 인증, 자동 갱신, 보안 |

**백엔드 아키텍처 특징**:
- **분리된 서버 구조**:
  - API 서버 (Gunicorn): RESTful API 처리
  - WebSocket 서버 (Daphne): 실시간 통신 처리
- **비동기 처리**: Django Channels를 통한 비동기 WebSocket 처리
- **Redis Pub/Sub**: 실시간 플래너 동기화
- **Custom User Model**: 이메일 기반 인증
- **역할 기반 권한**: Owner/Editor/Commenter/Viewer

### 3.3 데이터 처리

| 기술 | 버전 | 용도 | 선택 이유 |
|------|------|------|----------|
| **Apache Airflow** | 2.8+ | 워크플로우 관리 | DAG 기반 스케줄링, 모니터링, 확장성 |
| **PostgreSQL** | 15 | Airflow 메타DB | Airflow 자체 메타데이터 저장 |

**Airflow DAGs**:
1. **weather_collector**: 6시간마다 날씨 정보 수집
2. **exchange_rate_collector**: 매일 09:00 환율 정보 수집

### 3.4 인프라 및 DevOps

| 기술 | 버전 | 용도 | 선택 이유 |
|------|------|------|----------|
| **Docker** | 24+ | 컨테이너화 | 환경 일관성, 배포 간소화, 격리 |
| **Docker Compose** | 2.x | 오케스트레이션 | 멀티 컨테이너 관리, 네트워크 구성 |
| **Nginx** | 1.29+ | 리버스 프록시 | 로드 밸런싱, SSL, 정적 파일 서빙 |

**Docker 컨테이너 구성**:
1. `triplan-nginx`: Reverse Proxy (Port 80, 443)
2. `triplan-frontend`: Next.js Dev Server (Port 3000)
3. `triplan-backend`: Django API (Port 8000)
4. `triplan-websocket`: Daphne WebSocket (Port 8001)
5. `triplan-db`: PostgreSQL with pgvector (Port 5432)
6. `triplan-redis`: Redis (Port 6379)
7. `triplan-airflow-db`: Airflow PostgreSQL (Port 5432)
8. `triplan-airflow-webserver`: Airflow UI (Port 8080)
9. `triplan-airflow-scheduler`: Airflow Scheduler

### 3.5 외부 API 및 서비스

| 서비스 | 용도 | 이유 |
|--------|------|------|
| **OpenAI API** | AI 챗봇 | GPT 모델, 자연어 처리, 여행 추천 |
| **Kakao Map API** | 지도 서비스 | 한국 지도 데이터, 장소 검색 |
| **Weather APIs** | 날씨 정보 | 여행지 날씨 예보 |
| **Exchange Rate APIs** | 환율 정보 | 예산 계산 |

---

## 4. 디렉토리 구조

```
SKN15-FINAL-2TEAM/
├── backend/                      # Django 백엔드
│   ├── config/                   # 프로젝트 설정
│   │   ├── settings/
│   │   │   ├── base.py          # 기본 설정
│   │   │   ├── development.py   # 개발 환경
│   │   │   └── production.py    # 프로덕션 환경
│   │   ├── asgi.py              # ASGI 설정 (WebSocket)
│   │   ├── wsgi.py              # WSGI 설정 (HTTP)
│   │   └── urls.py              # 루트 URL 설정
│   ├── apps/                     # Django 앱들
│   │   ├── accounts/            # 사용자 인증
│   │   │   ├── models.py        # User, UserIdentity
│   │   │   ├── views.py         # 회원가입, 로그인, 로그아웃
│   │   │   ├── serializers.py   # 직렬화
│   │   │   └── backends.py      # 커스텀 인증 백엔드
│   │   ├── plans/               # 여행 계획
│   │   │   ├── models.py        # TripPlan, TripDay, TripItem, TripMember
│   │   │   ├── views.py         # CRUD API, 초대 코드
│   │   │   └── serializers.py
│   │   ├── chat/                # 실시간 채팅
│   │   │   ├── models.py        # ChatRoom, ChatMessage
│   │   │   ├── consumers.py     # WebSocket Consumer
│   │   │   ├── routing.py       # WebSocket 라우팅
│   │   │   └── services.py      # 챗봇 서비스
│   │   ├── places/              # 장소 정보
│   │   │   └── models.py        # Place, PlaceCategory
│   │   ├── weather/             # 날씨 정보
│   │   │   ├── models.py        # WeatherForecast
│   │   │   └── views.py         # 날씨 API
│   │   ├── exchange/            # 환율 정보
│   │   │   ├── models.py        # ExchangeRate
│   │   │   └── views.py         # 환율 API
│   │   ├── common/              # 공통 데이터
│   │   │   └── models.py        # Country, Region1, Region2
│   │   ├── ai/                  # AI 기능
│   │   │   └── views.py         # AI 추천 API
│   │   ├── export/              # 데이터 내보내기
│   │   │   └── views.py         # PDF/Excel 변환
│   │   ├── worldtime/           # 세계 시간
│   │   │   └── views.py         # 타임존 API
│   │   └── alerts/              # 알림
│   │       └── models.py        # TravelAlert
│   ├── manage.py                # Django 관리 명령
│   ├── requirements.txt         # Python 패키지
│   └── Dockerfile               # Docker 이미지 빌드
│
├── frontend/                     # Next.js 프론트엔드
│   ├── pages/                    # 페이지 라우팅
│   │   ├── _app.tsx             # 앱 래퍼
│   │   ├── _document.tsx        # HTML 문서
│   │   ├── index.tsx            # 홈페이지
│   │   ├── login.tsx            # 로그인
│   │   ├── signup.tsx           # 회원가입
│   │   ├── planner.tsx          # 플래너 메인
│   │   ├── trips.tsx            # 여행 목록
│   │   └── mypage.tsx           # 마이페이지
│   ├── src/
│   │   ├── components/          # React 컴포넌트
│   │   │   ├── Header.tsx       # 헤더
│   │   │   └── planner/         # 플래너 컴포넌트
│   │   │       ├── Calendar.tsx
│   │   │       ├── DayPlanningCard.tsx
│   │   │       ├── TimelineView.tsx
│   │   │       ├── WeatherWidget.tsx
│   │   │       ├── KakaoMap.tsx
│   │   │       ├── UnifiedChatWidget.tsx
│   │   │       ├── InviteCodeModal.tsx
│   │   │       └── ScheduleModal.tsx
│   │   ├── hooks/               # Custom Hooks
│   │   │   ├── useAuth.ts       # 인증 훅
│   │   │   └── useCollaborativeChat.ts  # 채팅 WebSocket 훅
│   │   ├── services/            # API 서비스
│   │   │   ├── api.ts           # Axios 인스턴스
│   │   │   ├── tripAPI.ts       # 여행 API
│   │   │   ├── chatAPI.ts       # 채팅 API
│   │   │   ├── placesAPI.ts     # 장소 API
│   │   │   └── commonAPI.ts     # 공통 API
│   │   ├── types/               # TypeScript 타입
│   │   │   └── planner.ts
│   │   ├── theme/               # MUI 테마
│   │   │   └── theme.ts
│   │   └── utils/               # 유틸리티
│   │       └── plannerStorage.ts
│   ├── package.json             # NPM 패키지
│   ├── tsconfig.json            # TypeScript 설정
│   ├── next.config.js           # Next.js 설정
│   └── Dockerfile               # Docker 이미지
│
├── airflow/                      # Apache Airflow
│   ├── dags/                     # DAG 정의
│   │   ├── weather_collector.py
│   │   └── exchange_rate_collector.py
│   ├── logs/                     # 로그
│   ├── plugins/                  # 커스텀 플러그인
│   └── Dockerfile
│
├── nginx/                        # Nginx 설정
│   ├── nginx.conf               # 메인 설정
│   └── Dockerfile
│
├── database/                     # DB 초기화 스크립트
│   ├── init.sql                 # 초기 스키마
│   └── pgvector-setup.sql       # pgvector 설정
│
├── data/                         # 데이터 볼륨
│   ├── postgres/                # PostgreSQL 데이터
│   ├── redis/                   # Redis 데이터
│   ├── static/                  # Django static 파일
│   ├── media/                   # 업로드 파일
│   └── exports/                 # 내보내기 파일
│
├── docker-compose.yml           # Docker Compose 설정
├── .env                         # 환경 변수
├── .gitignore
└── README.md
```

---

## 5. 인프라 아키텍처

### 5.1 Docker Compose 네트워크

**네트워크 이름**: `triplan-network` (Bridge Driver)

**컨테이너 간 통신**:
```
┌─────────────────────────────────────────────────────┐
│          triplan-network (Bridge)                    │
│                                                       │
│  ┌──────────┐    ┌──────────┐    ┌─────────────┐  │
│  │  nginx   │───→│ frontend │    │  backend    │  │
│  │  :80     │    │  :3000   │    │  :8000      │  │
│  └──────────┘    └──────────┘    └─────────────┘  │
│       │                                 │            │
│       └────────────┬───────────────────┤            │
│                    ↓                   ↓            │
│            ┌──────────────┐    ┌─────────────┐    │
│            │  websocket   │    │  postgres   │    │
│            │  :8001       │    │  :5432      │    │
│            └──────────────┘    └─────────────┘    │
│                    │                   │            │
│                    ↓                   │            │
│            ┌──────────────┐           │            │
│            │    redis     │←──────────┘            │
│            │    :6379     │                        │
│            └──────────────┘                        │
└─────────────────────────────────────────────────────┘
```

### 5.2 포트 매핑

| 컨테이너 | 내부 포트 | 외부 포트 | 프로토콜 | 용도 |
|----------|-----------|-----------|---------|------|
| nginx | 80 | 80 | HTTP | 웹 서버 |
| nginx | 443 | 443 | HTTPS | 보안 웹 서버 |
| frontend | 3000 | 3000 | HTTP | Next.js Dev Server |
| backend | 8000 | 8000 | HTTP | Django API |
| websocket | 8001 | 8001 | WS/HTTP | WebSocket |
| postgres | 5432 | 5432 | TCP | PostgreSQL |
| redis | 6379 | 6379 | TCP | Redis |
| airflow-webserver | 8080 | 8080 | HTTP | Airflow UI |

### 5.3 Nginx 라우팅 규칙

```nginx
# Frontend (Next.js)
location / {
    proxy_pass http://frontend:3000;
}

# Backend API
location /api/ {
    proxy_pass http://backend:8000;
}

# WebSocket
location /ws/ {
    proxy_pass http://websocket:8001;
    # WebSocket 헤더
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}

# Django Admin
location /admin/ {
    proxy_pass http://backend:8000;
}

# Static Files
location /static/ {
    alias /static/;
}

# Media Files
location /media/ {
    alias /media/;
}
```

### 5.4 환경 변수 관리

**.env 파일**:
```bash
# Database
POSTGRES_DB=lecun2
POSTGRES_USER=postgres
POSTGRES_PASSWORD=lecun123!@#
DATABASE_URL=postgresql://postgres:lecun123!@#@postgres:5432/lecun2

# Redis
REDIS_URL=redis://redis:6379/0

# Django
SECRET_KEY=django-insecure-temp-secret-key
DEBUG=True
ALLOWED_HOSTS=*

# API Keys
OPENAI_API_KEY=sk-...
KAKAO_API_KEY=...
KAKAO_MAP_API_KEY=...

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
NEXT_PUBLIC_KAKAO_API_KEY=...

# Airflow
AIRFLOW_FERNET_KEY=...
AIRFLOW_WEBSERVER_SECRET_KEY=...
AIRFLOW_USERNAME=admin
AIRFLOW_PASSWORD=admin
```

### 5.5 볼륨 마운트

**영구 데이터 저장**:
```yaml
volumes:
  # Database data
  - ./data/postgres:/var/lib/postgresql/data

  # Redis data
  - ./data/redis:/data

  # Static files
  - ./data/static:/app/staticfiles

  # Media uploads
  - ./data/media:/app/media

  # Export files
  - ./data/exports:/app/exports

  # Airflow
  - ./airflow/dags:/opt/airflow/dags
  - ./airflow/logs:/opt/airflow/logs

  # Development hot reload (frontend)
  - ./frontend:/app
  - /app/node_modules  # Anonymous volume
  - /app/.next         # Anonymous volume
```

---

## 📌 다음 파트 안내

**Part 2**: [백엔드 상세 분석](TECH_DOCS_PART2_BACKEND.md)
- Django 앱별 상세 코드 분석
- 데이터베이스 모델 설계
- API 엔드포인트 전체 목록
- WebSocket 실시간 통신 구현

**Part 3**: [프론트엔드 및 기술 선택 이유](TECH_DOCS_PART3_FRONTEND_DECISIONS.md)
- Next.js 페이지별 분석
- 컴포넌트 구조
- 상태 관리 전략
- 기술 스택 선택 근거
- 아키텍처 의사결정

---

**작성자**: Claude Code (AI Assistant)
**최종 업데이트**: 2025-01-20
