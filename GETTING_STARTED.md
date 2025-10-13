# 🚀 Getting Started - Triplan

이 문서는 Triplan 프로젝트를 처음 시작하는 개발자를 위한 빠른 시작 가이드입니다.

## 📋 체크리스트

시작하기 전에 다음 항목들을 확인하세요:

- [ ] Docker와 Docker Compose 설치됨
- [ ] Git 설치됨
- [ ] 최소 8GB RAM 사용 가능
- [ ] 최소 10GB 디스크 공간 사용 가능
- [ ] OpenAI API Key 발급 (필수)
- [ ] Kakao Map API Key 발급 (선택)

## ⚡ 5분 Quick Start

### 1단계: 프로젝트 준비

```bash
# 프로젝트 디렉토리로 이동
cd triplan

# 환경 변수 파일 생성
cp .env.template .env
```

### 2단계: 환경 변수 설정

`.env` 파일을 열어서 최소한 다음 값들을 설정하세요:

```bash
# 필수 설정
OPENAI_API_KEY=sk-your-openai-api-key-here
SECRET_KEY=$(python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())")
POSTGRES_PASSWORD=your_secure_password
AIRFLOW_FERNET_KEY=$(python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
```

### 3단계: 데이터 디렉토리 생성

```bash
mkdir -p data/{postgres,redis,static,media,exports,airflow-postgres,airflow-data}
mkdir -p airflow/logs
```

### 4단계: 서비스 시작

```bash
# Option 1: Makefile 사용 (권장)
make init

# Option 2: 수동 실행
docker-compose up -d --build
docker-compose exec backend python manage.py migrate
docker-compose exec backend python manage.py createsuperuser
```

### 5단계: 접속 확인

브라우저에서 다음 주소들을 확인하세요:

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Django Admin: http://localhost:8000/admin
- Airflow: http://localhost:8080 (admin/admin)

## 🛠️ 개발 환경 설정

### Backend 개발 준비

```bash
# Django 앱 구조 확인
ls -la backend/apps/

# 새로운 앱 생성 (필요시)
docker-compose exec backend python manage.py startapp new_app

# 마이그레이션 생성
docker-compose exec backend python manage.py makemigrations

# Django Shell 접속
make shell-be
```

### Frontend 개발 준비

```bash
# Frontend 디렉토리 구조 확인
ls -la frontend/src/

# 패키지 설치
docker-compose exec frontend npm install

# 개발 서버 로그 확인
make logs-fe
```

### Airflow DAG 개발

```bash
# DAG 디렉토리 확인
ls -la airflow/dags/

# 새로운 DAG 추가
# 1. airflow/dags/ 디렉토리에 .py 파일 생성
# 2. Airflow UI에서 DAG 확인 및 활성화
```

## 📚 주요 명령어

### 서비스 관리

```bash
make up          # 서비스 시작
make down        # 서비스 중지
make ps          # 상태 확인
make logs        # 전체 로그 확인
```

### 개발 작업

```bash
make shell-be    # Backend shell 접속
make shell-fe    # Frontend shell 접속
make shell-db    # PostgreSQL 접속
make shell-redis # Redis CLI 접속
```

### 데이터베이스

```bash
make migrate           # 마이그레이션 실행
make makemigrations    # 마이그레이션 생성
make superuser         # 관리자 계정 생성
```

### 테스트

```bash
make test-be     # Backend 테스트
make test-fe     # Frontend 테스트
make test-all    # 전체 테스트
```

## 🔍 문제 해결

### 포트가 이미 사용 중인 경우

```bash
# 사용 중인 포트 확인
lsof -i :8000  # Backend
lsof -i :3000  # Frontend
lsof -i :5432  # PostgreSQL

# docker-compose.yml에서 포트 변경
```

### 컨테이너가 시작되지 않는 경우

```bash
# 로그 확인
docker-compose logs

# 특정 서비스 로그
docker-compose logs backend

# 컨테이너 재시작
docker-compose restart backend
```

### 데이터베이스 연결 오류

```bash
# PostgreSQL 상태 확인
docker-compose ps postgres

# 데이터베이스 재시작
docker-compose restart postgres

# 연결 테스트
docker-compose exec postgres psql -U postgres -d travel_planner -c "SELECT 1"
```

### 모든 것을 다시 시작하고 싶을 때

```bash
# 주의: 모든 데이터가 삭제됩니다!
make clean
make init
```

## 🎯 다음 단계

1. **Backend 개발**
   - [backend/apps/](backend/apps/) 디렉토리의 각 앱 구조 확인
   - Django 모델 정의
   - REST API 엔드포인트 구현
   - WebSocket 핸들러 구현

2. **Frontend 개발**
   - [frontend/src/](frontend/src/) 디렉토리 구조 확인
   - React 컴포넌트 개발
   - API 연동
   - Recoil 상태 관리 설정

3. **AI/RAG 시스템**
   - [backend/apps/ai/](backend/apps/ai/) 에서 RAG 파이프라인 구현
   - LangGraph 에이전트 설정
   - pgvector 벡터 검색 구현

4. **Airflow DAG**
   - [airflow/dags/](airflow/dags/) 에서 데이터 수집 파이프라인 구현
   - 외부 API 연동
   - 데이터 전처리 및 저장

## 📖 추가 문서

- [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) - 전체 프로젝트 구조
- [README.md](README.md) - 프로젝트 개요
- [Backend README](backend/README.md) - Backend 개발 가이드 (작성 필요)
- [Frontend README](frontend/README.md) - Frontend 개발 가이드 (작성 필요)

## 💡 팁

1. **개발 모드 사용**: 코드 수정이 자동으로 반영되도록 개발 모드 사용
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
   ```

2. **로그 모니터링**: 개발 중에는 로그를 실시간으로 확인
   ```bash
   make logs-be
   # 또는
   docker-compose logs -f backend frontend
   ```

3. **데이터베이스 백업**: 중요한 작업 전 데이터베이스 백업
   ```bash
   make backup-db
   ```

4. **Git 사용**: 작업 전 새로운 브랜치 생성
   ```bash
   git checkout -b feature/your-feature-name
   ```

## 🤝 도움 받기

- GitHub Issues에 질문 올리기
- 팀 채널에서 논의
- 문서 확인: [docs/](docs/) 디렉토리

---

Happy Coding! 🎉
