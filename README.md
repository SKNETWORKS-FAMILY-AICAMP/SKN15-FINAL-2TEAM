# 🌍 Triplan - RAG 기반 대화형 여행 일정 추천 서비스

AI 챗봇과 대화하며 여행 일정을 계획하고, 동행자와 실시간으로 협업할 수 있는 똑똑한 여행 플래너입니다.

## ✨ 주요 기능

### 🤖 AI 대화형 플래닝
- LangGraph 기반 RAG 시스템으로 자연어 대화를 통한 일정 계획
- OpenAI GPT-4를 활용한 지능형 추천
- pgvector를 이용한 벡터 검색으로 관련 정보 제공

### 👥 실시간 협업
- WebSocket 기반 실시간 채팅
- 동행자와 함께 일정 편집 및 투표
- Redis를 통한 빠른 메시지 동기화

### 📊 통합 정보 제공
- 실시간 환율 정보
- 날씨 예보
- 비자 정보
- 항공권 및 숙소 검색 (API 연동)

### 📄 자동 문서화
- PDF, ICS(캘린더), CSV 형식으로 일정 내보내기
- 인쇄 최적화된 여행 일정표
- 구글 캘린더 등 외부 캘린더 연동

### 🗺️ 지도 기반 계획
- Kakao Map API 통합
- 경로 시각화 및 거리 계산
- 주변 맛집/관광지 추천

## 🏗️ 시스템 아키텍처

```
┌─────────────┐
│   Browser   │
│   (User)    │
└──────┬──────┘
       │ HTTPS/WSS
┌──────▼──────┐
│    Nginx    │ (Reverse Proxy)
│   Port 80   │
└──────┬──────┘
       │
   ┌───┴───┬───────────┬────────────┐
   │       │           │            │
┌──▼───┐ ┌─▼────┐ ┌───▼────┐ ┌─────▼─────┐
│Next.js│ │Django│ │WebSocket│ │  Airflow  │
│ :3000 │ │:8000 │ │ :8001  │ │   :8080   │
└───────┘ │Gunicorn│ │Daphne │ └──────┬────┘
          └─┬────┘ └───┬────┘        │
            │          │             │
      ┌─────┼──────────┼─────────────┤
      │     │          │             │
   ┌──▼─┐ ┌─▼────┐ ┌──▼──┐   ┌──────▼─────┐
   │Redis│ │PgSQL │ │Redis│   │  PgSQL     │
   │:6379│ │+vec  │ │     │   │ (Airflow)  │
   └─────┘ │:5432 │ └─────┘   └────────────┘
           └──────┘
```

### 서버 구성
- **Backend (Gunicorn)**: REST API 처리
- **WebSocket (Daphne)**: 실시간 채팅 및 이벤트 처리
- **Frontend (Next.js)**: SSR 기반 UI
- **Airflow**: 데이터 수집 파이프라인

## 🚀 빠른 시작

### 사전 요구사항

- Docker & Docker Compose
- Git
- OpenAI API Key
- Kakao Map API Key (선택사항)

### 로컬 환경 (추천)

```bash
# 저장소 클론
git clone <your-repo-url>
cd triplan

# 환경 변수 설정
cp .env.template .env
nano .env  # API 키 등 설정

# 전체 서비스 실행 (원클릭!)
./run-local.sh
```

### 수동 설정

#### 1. 저장소 클론

```bash
git clone <your-repo-url>
cd triplan
```

### 2. 환경 변수 설정

```bash
# .env 파일 생성
cp .env.template .env

# .env 파일을 편집하여 필요한 API 키 입력
nano .env
```

**필수 환경 변수:**
- `OPENAI_API_KEY`: OpenAI API 키
- `SECRET_KEY`: Django 시크릿 키
- `POSTGRES_PASSWORD`: 데이터베이스 비밀번호

### 3. 데이터 디렉토리 생성

```bash
mkdir -p data/{postgres,redis,static,media,exports,airflow-postgres,airflow-data}
```

### 4. Docker 컨테이너 실행

```bash
# 전체 서비스 빌드 및 시작
docker-compose up -d --build

# 로그 확인
docker-compose logs -f
```

### 5. 데이터베이스 초기화

```bash
# Django 마이그레이션 실행
docker-compose exec backend python manage.py migrate

# 슈퍼유저 생성
docker-compose exec backend python manage.py createsuperuser
```

### 6. Airflow 초기화

```bash
# Airflow 데이터베이스 초기화
docker-compose exec airflow-webserver airflow db init

# Airflow 관리자 계정 생성
docker-compose exec airflow-webserver airflow users create \
    --username admin \
    --password admin \
    --firstname Admin \
    --lastname User \
    --role Admin \
    --email admin@example.com
```

### 7. 서비스 접속

- **Frontend**: http://localhost:3000
- **Backend API (Gunicorn)**: http://localhost:8000
- **WebSocket (Daphne)**: ws://localhost:8001
- **Airflow**: http://localhost:8080
- **Django Admin**: http://localhost:8000/admin

## 🌐 배포 (Production)

EC2 인스턴스에 배포하는 방법은 [DEPLOYMENT.md](DEPLOYMENT.md)를 참고하세요.

### 빠른 배포 개요

```bash
# Frontend EC2
cd triplan/deploy/frontend
./deploy.sh

# Backend EC2
cd triplan/deploy/backend
./deploy.sh

# Database + Airflow EC2
cd triplan/deploy/database
./deploy.sh
```

## 📦 기술 스택

### Backend
- **Framework**: Django 4.2 + Django REST Framework
- **Web Server**: Gunicorn (REST API) + Daphne (WebSocket)
- **WebSocket**: Django Channels + Redis
- **Database**: PostgreSQL 15 + pgvector
- **AI/ML**: LangChain, LangGraph, OpenAI GPT-4
- **Vector Search**: sentence-transformers + pgvector

### Frontend
- **Framework**: Next.js 14 (React 18)
- **Language**: TypeScript
- **UI Library**: Material-UI (MUI)
- **State Management**: Recoil
- **Map**: Kakao Map SDK
- **Real-time**: Socket.io-client

### Data Pipeline
- **Orchestration**: Apache Airflow
- **Scheduling**: Cron-based DAGs
- **Data Collection**: Web Scraping, API Integration

### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Reverse Proxy**: Nginx
- **Cache**: Redis

## 📁 프로젝트 구조

```
triplan/
├── backend/              # Django 백엔드
│   ├── apps/            # Django 앱들
│   │   ├── accounts/    # 사용자 인증
│   │   ├── rooms/       # 여행 방
│   │   ├── plans/       # 일정 관리
│   │   ├── chat/        # 실시간 채팅
│   │   ├── ai/          # AI/RAG 시스템
│   │   └── export/      # 문서 내보내기
│   └── config/          # Django 설정
│
├── frontend/            # Next.js 프론트엔드
│   └── src/
│       ├── pages/       # 페이지 라우팅
│       ├── components/  # React 컴포넌트
│       ├── services/    # API 호출
│       └── store/       # 상태 관리
│
├── airflow/             # 데이터 파이프라인
│   └── dags/           # DAG 정의
│
├── database/            # DB 초기화 스크립트
├── nginx/              # Nginx 설정
└── docker-compose.yml  # Docker 오케스트레이션
```

## 🔧 개발 가이드

### 개발 환경 실행

```bash
# 개발 모드로 실행
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Backend만 재시작
docker-compose restart backend

# 로그 실시간 확인
docker-compose logs -f backend frontend
```

### Backend 개발

```bash
# 새 Django 앱 생성
docker-compose exec backend python manage.py startapp app_name

# 마이그레이션 생성
docker-compose exec backend python manage.py makemigrations

# 마이그레이션 적용
docker-compose exec backend python manage.py migrate

# Django Shell
docker-compose exec backend python manage.py shell
```

### Frontend 개발

```bash
# 패키지 설치
docker-compose exec frontend npm install <package-name>

# 타입 체크
docker-compose exec frontend npm run type-check

# 린트
docker-compose exec frontend npm run lint
```

### Airflow DAG 개발

1. `airflow/dags/` 에 Python 파일 생성
2. Airflow는 자동으로 DAG를 감지
3. Airflow UI에서 DAG 활성화 및 실행

## 🧪 테스트

```bash
# Backend 테스트
docker-compose exec backend pytest

# Frontend 테스트
docker-compose exec frontend npm test

# 코드 커버리지
docker-compose exec backend pytest --cov
```

## 📊 모니터링

### 헬스 체크

```bash
# Backend 헬스 체크
curl http://localhost:8000/health

# 모든 서비스 상태 확인
docker-compose ps
```

### 로그 확인

```bash
# 전체 로그
docker-compose logs

# 특정 서비스 로그
docker-compose logs backend

# 실시간 로그
docker-compose logs -f --tail=100 backend
```

## 🛠️ 유용한 명령어

### Makefile 사용 (생성 필요)

```bash
# 서비스 시작
make up

# 서비스 중지
make down

# 로그 확인
make logs

# 데이터베이스 마이그레이션
make migrate

# 테스트 실행
make test
```

## 🔐 보안 고려사항

- 프로덕션 환경에서는 `.env` 파일의 모든 시크릿 키를 변경하세요
- HTTPS를 사용하고 SSL 인증서를 설정하세요
- Django의 `DEBUG=False` 설정을 사용하세요
- `ALLOWED_HOSTS`를 적절히 설정하세요
- 정기적으로 의존성 패키지를 업데이트하세요

## 🐛 트러블슈팅

### PostgreSQL 연결 실패
```bash
# 컨테이너 로그 확인
docker-compose logs postgres

# 데이터베이스 재시작
docker-compose restart postgres
```

### Airflow DAG가 인식되지 않음
```bash
# Airflow 스케줄러 재시작
docker-compose restart airflow-scheduler

# DAG 폴더 권한 확인
ls -la airflow/dags/
```

### 포트 충돌
```bash
# 사용 중인 포트 확인
lsof -i :8000
lsof -i :3000

# docker-compose.yml에서 포트 변경
```

## 📝 라이센스

이 프로젝트는 MIT 라이센스를 따릅니다.

## 👥 기여자

- **PM & DevOps**: 박진우
- **Backend**: 임가은, 하다현
- **Frontend**: 서혜선
- **AI & RAG**: 최서린

## 📮 문의

프로젝트 관련 문의사항이 있으시면 이슈를 생성해주세요.

---

**Made with ❤️ by LeCun Team**
