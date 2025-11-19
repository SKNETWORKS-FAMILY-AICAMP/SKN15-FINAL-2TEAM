# TriPlan 프로젝트 종합 기술 문서

> **실시간 협업 여행 플래너** - 완전한 기술 분석 및 아키텍처 문서

---

## 📚 문서 구성

이 프로젝트의 모든 소스 코드와 기술 스택이 3개의 상세 문서로 정리되어 있습니다.

### 📖 Part 1: 아키텍처 및 개요
**파일**: [TECH_DOCS_PART1_ARCHITECTURE.md](TECH_DOCS_PART1_ARCHITECTURE.md)

**내용**:
- 프로젝트 개요 및 핵심 기능
- 전체 시스템 아키텍처 (5계층 구조)
- 기술 스택 총정리 (프론트엔드/백엔드/인프라/외부 서비스)
- 디렉토리 구조 상세 분석
- Docker 인프라 아키텍처
- 네트워크 구성 및 포트 매핑
- 환경 변수 관리

**주요 다이어그램**:
```
Client Layer (Next.js)
    ↓
Presentation Layer (Nginx)
    ↓
Application Layer (Django + Daphne)
    ↓
Data Layer (PostgreSQL + Redis)
    ↓
Data Processing Layer (Airflow)
```

---

### 🔧 Part 2: 백엔드 상세 분석
**파일**: [TECH_DOCS_PART2_BACKEND.md](TECH_DOCS_PART2_BACKEND.md)

**내용**:
- Django 앱 구조 (10개 앱 상세 분석)
  - accounts: 사용자 인증 (JWT)
  - plans: 여행 계획 CRUD
  - chat: 실시간 채팅 (WebSocket)
  - places, weather, exchange, common, ai, export, worldtime, alerts
- 데이터베이스 스키마 (34개 테이블)
- ER 다이어그램
- API 엔드포인트 전체 목록 (50+ 엔드포인트)
- WebSocket 실시간 통신 구현
- Redis Pub/Sub 아키텍처
- 인증 및 보안 (JWT, CORS)
- 비즈니스 로직 상세
  - 초대 코드 시스템
  - 권한 관리 (Owner/Editor/Commenter/Viewer)
  - 실시간 플래너 동기화 메커니즘

**핵심 코드 분석**:
- `TripChatConsumer`: WebSocket 연결 및 메시지 처리
- `TripPlanViewSet`: 여행 계획 API + 실시간 브로드캐스트
- 초대 코드 생성/검증 로직
- Redis Pub/Sub을 통한 실시간 동기화

---

### 💻 Part 3: 프론트엔드 및 기술 선택 근거
**파일**: [TECH_DOCS_PART3_FRONTEND_DECISIONS.md](TECH_DOCS_PART3_FRONTEND_DECISIONS.md)

**내용**:
- 프론트엔드 아키텍처 (4계층)
- Next.js 페이지 구조 분석
  - 7개 페이지 상세 설명
  - 라우팅 전략
- React 컴포넌트 설계
  - 20+ 컴포넌트 분석
  - 컴포넌트 계층 구조
- 상태 관리 전략 (useState + Custom Hooks)
  - `useAuth`: 인증 상태 관리
  - `useCollaborativeChat`: WebSocket 연결 관리
- WebSocket 클라이언트 구현 상세
- 기술 스택 선택 근거
  - Next.js vs CRA/Vite
  - Material-UI vs Ant Design/Chakra
  - useState vs Redux
  - Axios vs fetch
  - TypeScript 도입 이유
- **아키텍처 의사결정 기록 (ADR)** - 7가지 중요 결정
  - ADR-001: 백엔드/프론트엔드 분리
  - ADR-002: WebSocket 서버 분리
  - ADR-003: Redis Channel Layer 사용
  - ADR-004: 초대 코드 기반 멤버 추가
  - ADR-005: 실시간 플래너 동기화
  - ADR-006: Apache Airflow for ETL
  - ADR-007: pgvector for AI Features

---

## 🎯 프로젝트 핵심 기술

### 백엔드
| 기술 | 버전 | 용도 |
|------|------|------|
| Django | 5.0+ | 웹 프레임워크 |
| Django REST Framework | 3.14+ | REST API |
| Django Channels | 4.x | WebSocket (실시간 통신) |
| Daphne | 4.x | ASGI 서버 (WebSocket) |
| Gunicorn | 21.x | WSGI 서버 (HTTP API) |
| PostgreSQL | 15 | 관계형 DB |
| pgvector | Latest | Vector 검색 (AI) |
| Redis | 7 | 캐시 + Pub/Sub |
| Apache Airflow | 2.8+ | ETL 파이프라인 |

### 프론트엔드
| 기술 | 버전 | 용도 |
|------|------|------|
| Next.js | 14.1.0 | React 프레임워크 (SSR/CSR) |
| React | 18.x | UI 라이브러리 |
| TypeScript | 5.x | 타입 안전성 |
| Material-UI | 5.x | UI 컴포넌트 |
| Axios | 1.x | HTTP 클라이언트 |
| WebSocket | Native | 실시간 통신 |

### 인프라
| 기술 | 버전 | 용도 |
|------|------|------|
| Docker | 24+ | 컨테이너화 |
| Docker Compose | 2.x | 멀티 컨테이너 관리 |
| Nginx | 1.29+ | 리버스 프록시 |

---

## 🏗️ 시스템 아키텍처 요약

### 마이크로서비스 구조 (9개 컨테이너)
```
1. triplan-nginx (Port 80, 443) - Reverse Proxy
2. triplan-frontend (Port 3000) - Next.js
3. triplan-backend (Port 8000) - Django API
4. triplan-websocket (Port 8001) - Daphne WebSocket
5. triplan-db (Port 5432) - PostgreSQL + pgvector
6. triplan-redis (Port 6379) - Redis
7. triplan-airflow-db (Port 5432) - Airflow Metadata
8. triplan-airflow-webserver (Port 8080) - Airflow UI
9. triplan-airflow-scheduler - Airflow Scheduler
```

### 통신 플로우
```
Client
  ↓ HTTP/HTTPS (Port 80/443)
Nginx
  ├─ / → Frontend (Port 3000)
  ├─ /api/ → Backend (Port 8000)
  └─ /ws/ → WebSocket (Port 8001)
       ↓ Redis Pub/Sub
     All Connected Clients
```

---

## 🌟 핵심 기능 구현

### 1. 실시간 협업 (WebSocket + Redis Pub/Sub)
- 사용자 A가 플래너 수정 → Redis Pub/Sub → 사용자 B, C에게 즉시 전달
- Google Docs 스타일 동시 편집 경험
- 타이핑 인디케이터, 입장/퇴장 알림

### 2. 초대 코드 시스템
- 6자리 랜덤 코드 생성 (예: `ABC123`)
- 24시간 만료
- URL: `/planner/ABC123`
- 코드 공유로 간편하게 여행 참여

### 3. 역할 기반 권한 관리
| 역할 | 플래너 수정 | 멤버 초대 | 댓글 | 읽기 |
|------|------------|----------|------|------|
| Owner | ✅ | ✅ | ✅ | ✅ |
| Editor | ✅ | ✅ | ✅ | ✅ |
| Commenter | ❌ | ❌ | ✅ | ✅ |
| Viewer | ❌ | ❌ | ❌ | ✅ |

### 4. AI 챗봇 (OpenAI API)
- `@봇` 멘션으로 호출
- 대화 컨텍스트 인식
- 여행 추천 및 정보 제공

### 5. 자동 데이터 수집 (Apache Airflow)
- **weather_collector**: 6시간마다 날씨 정보 수집
- **exchange_rate_collector**: 매일 09:00 환율 정보 수집

---

## 📊 데이터베이스 설계

### 핵심 테이블 관계
```
user_users (사용자)
    ├─ 1:N → trip_plans (여행)
    │           ├─ 1:N → trip_days (일차)
    │           │           └─ 1:N → trip_items (일정)
    │           ├─ 1:N → trip_members (멤버)
    │           └─ 1:1 → chat_rooms (채팅방)
    │                       └─ 1:N → chat_messages (메시지)
    └─ 1:N → user_identities (OAuth)
```

### 총 34개 테이블
- 사용자: 2개
- 여행: 5개
- 장소: 3개
- 채팅: 2개
- 공통 데이터: 4개
- 날씨/환율: 3개
- 기타: 15개

---

## 🔐 보안 및 인증

### JWT 토큰 인증
- Access Token: 1시간 유효
- Refresh Token: 7일 유효
- 자동 토큰 갱신 (Axios 인터셉터)

### 보안 헤더
```nginx
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
```

### CORS 설정
- 개발: 모든 Origin 허용
- 프로덕션: 특정 도메인만 허용

---

## 🚀 시작하기

### 필수 요구사항
- Docker 24+
- Docker Compose 2+
- 최소 8GB RAM
- 20GB 디스크 공간

### 실행 방법
```bash
# 1. 환경 변수 설정
cp backend/.env.example .env

# 2. 컨테이너 시작
docker-compose up -d

# 3. 접속
http://localhost          # 프론트엔드
http://localhost/admin    # Django Admin
http://localhost:8080     # Airflow UI
```

### 주요 URL
| 서비스 | URL | 설명 |
|--------|-----|------|
| 프론트엔드 | http://localhost | Next.js 앱 |
| API | http://localhost/api | Django REST API |
| WebSocket | ws://localhost/ws | 실시간 채팅 |
| Admin | http://localhost/admin | Django 관리자 |
| Airflow | http://localhost:8080 | 데이터 파이프라인 |
| API 문서 | http://localhost/api/docs | Browsable API |

---

## 📈 성능 최적화

### 프론트엔드
- Code Splitting (페이지별 번들 분리)
- Image Optimization (Next.js Image)
- SSR for SEO
- WebSocket 재연결 로직

### 백엔드
- DB 인덱스 최적화 (15+ 인덱스)
- Redis 캐싱
- Connection Pooling
- Queryset `select_related`, `prefetch_related`

### 인프라
- Nginx Gzip 압축
- Static File 캐싱 (30일)
- Rate Limiting
- Docker 멀티 스테이지 빌드

---

## 🧪 테스트

### API 테스트
```bash
# 회원가입
curl -X POST http://localhost/api/accounts/register/ \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test1234","password_confirm":"test1234"}'

# 로그인
curl -X POST http://localhost/api/accounts/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test1234"}'

# 여행 목록
TOKEN="your-access-token"
curl -X GET http://localhost/api/plans/trips/ \
  -H "Authorization: Bearer $TOKEN"
```

### WebSocket 테스트
```javascript
const ws = new WebSocket('ws://localhost/ws/chat/1/');

ws.onopen = () => {
  console.log('Connected');
  ws.send(JSON.stringify({
    type: 'chat_message',
    content: 'Hello!'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

---

## 📝 API 문서

### 엔드포인트 요약
- **인증**: 5개 (회원가입, 로그인, 로그아웃, 토큰 갱신, 내 정보)
- **여행 계획**: 13개 (CRUD, 초대, 멤버 관리)
- **일차/일정**: 8개 (CRUD)
- **채팅**: 3개 + WebSocket
- **공통 데이터**: 3개
- **날씨/환율**: 3개
- **장소**: 2개

총 **50+ API 엔드포인트**

상세 API 문서는 [Part 2](TECH_DOCS_PART2_BACKEND.md#3-api-엔드포인트-전체-목록)를 참고하세요.

---

## 🤝 기여

이 프로젝트는 교육 목적으로 작성되었습니다.

**개발팀**:
- 백엔드: Django + Django Channels
- 프론트엔드: Next.js + React
- 인프라: Docker + Nginx
- 데이터: Apache Airflow

---

## 📄 라이선스

이 프로젝트는 교육 및 포트폴리오 목적으로 작성되었습니다.

---

## 🙏 감사의 말

이 문서는 **Claude Code (AI Assistant)**가 전체 소스 코드를 분석하여 작성했습니다.

- 총 분석 파일: 100+ 파일
- 문서 페이지: 3개 (Part 1, 2, 3)
- 총 단어 수: 약 20,000 단어
- 작성 시간: 2025-01-20

---

## 📞 문의

프로젝트에 대한 질문이나 제안사항이 있으시면 이슈를 등록해 주세요.

**프로젝트**: TriPlan - 실시간 협업 여행 플래너
**기술 스택**: Django + Next.js + Docker + WebSocket + Redis + Airflow
**아키텍처**: 마이크로서비스 (9개 컨테이너)

---

**작성일**: 2025-01-20
**버전**: 1.0.0
**작성자**: Claude Code (AI Assistant)

---

## 🔗 빠른 링크

- [Part 1: 아키텍처 및 개요](TECH_DOCS_PART1_ARCHITECTURE.md)
- [Part 2: 백엔드 상세 분석](TECH_DOCS_PART2_BACKEND.md)
- [Part 3: 프론트엔드 및 기술 선택 근거](TECH_DOCS_PART3_FRONTEND_DECISIONS.md)

---

**Happy Coding! 🎉**
