# Triplan - 프로젝트 구조

## 📁 전체 디렉토리 구조

```
triplan/
├── backend/                    # Django REST API + Channels
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── manage.py
│   ├── config/                # Django 설정
│   │   ├── settings/
│   │   │   ├── base.py
│   │   │   ├── development.py
│   │   │   └── production.py
│   │   ├── urls.py
│   │   ├── asgi.py
│   │   └── wsgi.py
│   ├── apps/
│   │   ├── accounts/          # 사용자 인증/관리
│   │   ├── rooms/             # 여행 방 (그룹)
│   │   ├── plans/             # 여행 일정
│   │   ├── chat/              # 실시간 채팅
│   │   ├── ai/                # AI/RAG 관련
│   │   └── export/            # 문서 내보내기
│   ├── core/                  # 공통 유틸리티
│   └── tests/
│
├── frontend/                   # Next.js + TypeScript
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.js
│   ├── public/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/          # API 호출
│   │   ├── store/             # Recoil 상태 관리
│   │   ├── styles/
│   │   └── types/
│   └── .env.local
│
├── database/                   # PostgreSQL 관련
│   ├── Dockerfile
│   ├── init.sql               # 초기 스키마
│   └── pgvector-setup.sql     # pgvector 확장 설정
│
├── airflow/                    # 데이터 파이프라인
│   ├── Dockerfile
│   ├── dags/                  # DAG 정의
│   │   ├── weather_collector.py
│   │   ├── exchange_rate_collector.py
│   │   └── visa_info_collector.py
│   ├── plugins/
│   ├── logs/
│   └── requirements.txt
│
├── nginx/                      # Reverse Proxy
│   ├── Dockerfile
│   ├── nginx.conf
│   └── ssl/                   # SSL 인증서 (개발용)
│
├── redis/                      # Redis 설정 (필요시)
│
├── data/                       # 영구 저장소
│   ├── postgres/
│   ├── static/
│   ├── media/
│   └── exports/
│
├── docs/                       # 문서
│   ├── API.md
│   ├── DEPLOYMENT.md
│   └── ARCHITECTURE.md
│
├── docker-compose.yml          # 전체 서비스 오케스트레이션
├── docker-compose.dev.yml      # 개발 환경
├── docker-compose.prod.yml     # 프로덕션 환경
├── .env.template               # 환경변수 템플릿
├── .gitignore
├── Makefile                    # 편의 명령어
└── README.md
```

## 🐳 Docker 서비스 구성

### 1. **Backend Service** (Django)
- Port: 8000
- Dependencies: PostgreSQL, Redis
- Features: REST API, WebSocket, RAG, LangGraph

### 2. **Frontend Service** (Next.js)
- Port: 3000
- Dependencies: Backend
- Features: SSR, Kakao Map, MUI

### 3. **Database Service** (PostgreSQL + pgvector)
- Port: 5432
- Volume: ./data/postgres
- Features: Vector search, JSONB

### 4. **Redis Service**
- Port: 6379
- Features: Channel Layer, Cache

### 5. **Airflow Service**
- Webserver Port: 8080
- Components: Scheduler, Worker, Webserver
- Dependencies: PostgreSQL
- Features: ETL 파이프라인

### 6. **Nginx Service**
- Port: 80, 443
- Features: Reverse Proxy, SSL, Static Files

## 🔄 데이터 흐름

```
[User]
  ↓ (HTTPS)
[Nginx:443]
  ↓
  ├─→ /api → [Backend:8000] → [PostgreSQL:5432]
  ├─→ /ws  → [Backend:8000] → [Redis:6379]
  └─→ /    → [Frontend:3000]
       ↓
       [Kakao Map API]

[Airflow Scheduler] → [External APIs] → [PostgreSQL]
                                              ↓
                                    [Backend RAG System]
```

## 🔐 환경 변수

### Backend
- `DATABASE_URL`: PostgreSQL 연결
- `REDIS_URL`: Redis 연결
- `SECRET_KEY`: Django 시크릿 키
- `OPENAI_API_KEY`: OpenAI API
- `KAKAO_API_KEY`: Kakao Map API

### Frontend
- `NEXT_PUBLIC_API_URL`: Backend API URL
- `NEXT_PUBLIC_WS_URL`: WebSocket URL
- `NEXT_PUBLIC_KAKAO_API_KEY`: Kakao Map API

### Airflow
- `AIRFLOW__CORE__SQL_ALCHEMY_CONN`: PostgreSQL
- `AIRFLOW__CELERY__BROKER_URL`: Redis

## 📦 주요 기술 스택

### Backend
- Django 4.2+
- Django REST Framework
- Django Channels (WebSocket)
- LangChain / LangGraph
- sentence-transformers
- psycopg2 (PostgreSQL)
- redis-py

### Frontend
- Next.js 14+
- TypeScript
- Material-UI (MUI)
- Recoil (상태 관리)
- Kakao Map SDK
- Socket.io-client

### Database
- PostgreSQL 15+
- pgvector 0.5+

### AI/ML
- OpenAI GPT-4
- sentence-transformers
- pgvector (Vector DB)

### DevOps
- Docker & Docker Compose
- Nginx
- Airflow
- Redis

## 🚀 실행 순서

1. 환경 변수 설정: `.env.template` → `.env`
2. Docker 이미지 빌드: `docker-compose build`
3. 서비스 시작: `docker-compose up -d`
4. 데이터베이스 마이그레이션: `make migrate`
5. 서비스 확인:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - Airflow: http://localhost:8080

## 📝 개발 가이드

### Backend 개발
```bash
cd backend
python manage.py startapp <app_name>
```

### Frontend 개발
```bash
cd frontend
npm run dev
```

### Airflow DAG 추가
```bash
# airflow/dags/ 에 Python 파일 추가
# Airflow는 자동으로 감지하여 DAG 등록
```

## 🧪 테스트

```bash
# Backend 테스트
make test-backend

# Frontend 테스트
make test-frontend

# 전체 테스트
make test-all
```

## 📊 모니터링

- Airflow UI: http://localhost:8080
- Backend Health: http://localhost:8000/health
- Frontend: http://localhost:3000

## 🔧 트러블슈팅

### PostgreSQL 연결 실패
- `docker-compose logs postgres` 확인
- DATABASE_URL 환경변수 확인

### Redis 연결 실패
- `docker-compose logs redis` 확인
- REDIS_URL 환경변수 확인

### Airflow DAG 인식 안됨
- `docker-compose restart airflow-scheduler`
- `/airflow/dags` 마운트 확인
