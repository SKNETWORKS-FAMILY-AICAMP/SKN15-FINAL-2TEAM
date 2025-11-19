# Triplan 배포 가이드

Git에서 프로젝트를 받아서 도커 컨테이너만 올리면 **자동으로 DB 스키마, 초기 데이터, 슈퍼유저까지 생성**됩니다!

---

## 🚀 빠른 시작 (Quick Start)

### 1. 프로젝트 클론

```bash
git clone <repository-url>
cd SKN15-FINAL-2TEAM
```

### 2. 환경변수 설정

```bash
# .env.example을 복사하여 .env 파일 생성
cp .env.example .env

# .env 파일을 열어서 필요한 값 수정
nano .env
```

**필수 설정 항목**:
- `OPENAI_API_KEY`: OpenAI API 키 (Agent 기능용)
- `KAKAO_API_KEY`, `KAKAO_REST_API_KEY`, `KAKAO_MAP_API_KEY`: 카카오 API 키 (지도 기능용)
- `POSTGRES_PASSWORD`: DB 비밀번호 (운영 환경에서는 변경 필수!)
- `SECRET_KEY`: Django 시크릿 키 (운영 환경에서는 변경 필수!)

### 3. 도커 컨테이너 실행

```bash
# 빌드 및 실행
docker-compose up -d --build

# 로그 확인
docker-compose logs -f backend
```

### 4. 접속 확인

```bash
# Frontend
http://localhost:3000

# Backend API
http://localhost:8000/api/

# Django Admin
http://localhost:8000/admin/
- Username: admin (또는 .env에서 설정한 값)
- Password: admin1234 (또는 .env에서 설정한 값)

# Airflow
http://localhost:8080
- Username: admin
- Password: admin
```

---

## 📦 자동 설정 내용

### ✅ entrypoint.sh가 자동으로 처리하는 작업

1. **PostgreSQL 연결 대기**
   - DB가 완전히 준비될 때까지 대기

2. **Redis 연결 대기**
   - Redis가 완전히 준비될 때까지 대기

3. **DB 마이그레이션**
   ```bash
   python manage.py makemigrations --noinput
   python manage.py migrate --noinput
   ```

4. **초기 데이터 로드**
   - 국가/지역 데이터 (countries, regions)
   - 장소 데이터 (places) - 약 10만개 이상

5. **슈퍼유저 생성**
   - Username: admin (또는 `.env`의 `DJANGO_SUPERUSER_USERNAME`)
   - Email: admin@triplan.com
   - Password: admin1234 (또는 `.env`의 `DJANGO_SUPERUSER_PASSWORD`)

6. **Static 파일 수집**
   ```bash
   python manage.py collectstatic --noinput
   ```

7. **테스트 데이터 생성** (DEBUG=True일 때만)
   - 테스트 유저: `test@example.com` / `test1234`
   - 샘플 여행 계획: "제주도 3박4일 여행"

---

## 🔧 상세 설정

### docker-compose.yml 구조

```yaml
services:
  postgres:       # PostgreSQL + pgvector (벡터 검색)
  redis:          # Redis (캐시 + WebSocket)
  backend:        # Django REST API (Gunicorn)
  websocket:      # Django WebSocket (Daphne)
  frontend:       # Next.js (React)
  airflow-*:      # Apache Airflow (데이터 수집)
  nginx:          # Nginx (리버스 프록시)
```

### 환경변수 상세 설명

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `POSTGRES_DB` | `triplan` | DB 이름 |
| `POSTGRES_USER` | `postgres` | DB 사용자 |
| `POSTGRES_PASSWORD` | `postgres` | DB 비밀번호 ⚠️ 운영 환경에서 변경 필수! |
| `DEBUG` | `True` | Django DEBUG 모드 (운영 환경에서는 `False`) |
| `SECRET_KEY` | `django-insecure-...` | Django SECRET_KEY ⚠️ 운영 환경에서 변경 필수! |
| `DJANGO_SUPERUSER_USERNAME` | `admin` | 자동 생성할 슈퍼유저 이름 |
| `DJANGO_SUPERUSER_EMAIL` | `admin@triplan.com` | 슈퍼유저 이메일 |
| `DJANGO_SUPERUSER_PASSWORD` | `admin1234` | 슈퍼유저 비밀번호 ⚠️ 변경 권장! |

---

## 🛠️ 트러블슈팅

### 문제 1: PostgreSQL 연결 실패

```bash
# 증상
ERROR: could not connect to server: Connection refused

# 해결 방법
docker-compose down
docker volume rm skn15-final-2team_postgres-data  # 데이터 초기화
docker-compose up -d postgres
docker-compose logs -f postgres
```

### 문제 2: 마이그레이션 실패

```bash
# 로그 확인
docker-compose logs -f backend

# 수동 마이그레이션
docker-compose exec backend python manage.py migrate

# 마이그레이션 파일 재생성
docker-compose exec backend python manage.py makemigrations
docker-compose exec backend python manage.py migrate
```

### 문제 3: Static 파일 404 에러

```bash
# Static 파일 재수집
docker-compose exec backend python manage.py collectstatic --noinput

# Nginx 재시작
docker-compose restart nginx
```

### 문제 4: entrypoint.sh 권한 에러

```bash
# 증상
permission denied: /app/entrypoint.sh

# 해결 방법
chmod +x backend/entrypoint.sh
docker-compose down
docker-compose up -d --build
```

### 문제 5: 초기 데이터 로드 실패

```bash
# Places 데이터 수동 로드
docker-compose exec -T postgres psql -U postgres -d triplan < database/places_202510211121.sql

# 또는 Backend 컨테이너에서
docker-compose exec backend bash
psql -h postgres -U postgres -d triplan -f /app/database/places_202510211121.sql
```

---

## 📊 데이터베이스 정보

### 자동 생성되는 테이블

- **accounts**: User, UserProfile
- **common**: Country, Region1, Region2, PlacesCategory
- **places**: Place, Photo, PlaceCategory
- **plans**: TripPlan, TripDay, TripItem
- **chat**: ChatRoom, ChatMessage, ChatRequest
- **ai**: TripCourseEmbedding (RAG용)

### Places 데이터

- **개수**: 약 100,000개 이상
- **출처**: Google Places API
- **지역**: 한국 전국 (서울, 제주, 부산 등)
- **카테고리**: 관광지, 음식점, 숙박, 카페 등

---

## 🔐 보안 설정 (운영 환경)

### 1. 환경변수 변경 필수

```bash
# .env 파일에서 다음 값들을 반드시 변경하세요!
SECRET_KEY=your-new-secret-key-min-50-characters
POSTGRES_PASSWORD=your-secure-db-password
DJANGO_SUPERUSER_PASSWORD=your-secure-admin-password
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
```

### 2. SECRET_KEY 생성 방법

```python
# Python에서 실행
from django.core.management.utils import get_random_secret_key
print(get_random_secret_key())
```

### 3. HTTPS 설정 (Nginx)

```nginx
# nginx/nginx.conf에 SSL 인증서 추가
server {
    listen 443 ssl;
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    # ...
}
```

---

## 📁 디렉토리 구조

```
SKN15-FINAL-2TEAM/
├── backend/                  # Django 백엔드
│   ├── apps/                # Django 앱들
│   ├── config/              # Django 설정
│   ├── entrypoint.sh        # 🆕 자동 초기화 스크립트
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                # Next.js 프론트엔드
│   ├── pages/
│   ├── src/
│   └── Dockerfile
├── airflow/                 # Apache Airflow
│   ├── dags/
│   └── Dockerfile
├── nginx/                   # Nginx 리버스 프록시
│   ├── nginx.conf
│   └── Dockerfile
├── database/                # SQL 파일들
│   ├── init.sql             # DB 초기화
│   ├── pgvector-setup.sql   # pgvector 확장
│   └── places_*.sql         # Places 데이터
├── data/                    # 데이터 볼륨 (자동 생성)
│   ├── postgres/
│   ├── redis/
│   ├── static/
│   └── media/
├── docker-compose.yml       # 🆕 자동화된 설정
├── .env.example             # 🆕 환경변수 템플릿
└── DEPLOYMENT.md            # 🆕 이 파일
```

---

## 🚀 운영 환경 배포

### 로컬 개발 환경 (단일 서버)

```bash
# 1. 프로젝트 클론
git clone <repository-url>
cd SKN15-FINAL-2TEAM

# 2. 환경변수 설정
cp .env.example .env
nano .env  # 필요한 값 수정

# 3. 실행
docker-compose up -d --build

# 4. 로그 확인
docker-compose logs -f
```

### AWS EC2 배포 (7개 인스턴스 분리)

**자동화 스크립트를 사용한 원클릭 배포!**

#### 1단계: .env 파일 준비

```bash
# 로컬에서 .env 파일 생성
cp .env.aws.example .env

# 실제 AWS IP 주소로 수정
nano .env
```

**중요**: 다음 IP 주소들을 반드시 수정하세요:
- `NGINX_PUBLIC_IP`: Nginx 인스턴스의 Public IP
- `FRONTEND_PRIVATE_IP`: Frontend 인스턴스의 Private IP
- `BACKEND_PRIVATE_IP`: Backend 인스턴스의 Private IP
- `WEBSOCKET_PRIVATE_IP`: WebSocket 인스턴스의 Private IP
- `REDIS_PRIVATE_IP`: Redis 인스턴스의 Private IP
- `POSTGRES_PRIVATE_IP`: PostgreSQL 인스턴스의 Private IP
- `AIRFLOW_PRIVATE_IP`: Airflow 인스턴스의 Private IP

#### 2단계: 각 EC2 인스턴스에 파일 복사

```bash
# 로컬에서 각 EC2로 파일 전송
scp -i your-key.pem .env ubuntu@<EC2-IP>:~/
scp -i your-key.pem deploy-auto.sh ubuntu@<EC2-IP>:~/

# 또는 Git에서 직접 클론
ssh -i your-key.pem ubuntu@<EC2-IP>
git clone <repository-url>
cd SKN15-FINAL-2TEAM

# .env 파일을 직접 생성하거나 복사
nano .env  # IP 주소 입력
```

#### 3단계: 각 인스턴스에서 자동 배포 스크립트 실행

```bash
# 각 EC2 인스턴스에서 실행
./deploy-auto.sh
```

스크립트를 실행하면 다음과 같은 메뉴가 나타납니다:

```
═══════════════════════════════════════════════════════
  이 서버의 역할을 선택하세요 (번호 입력)
═══════════════════════════════════════════════════════

 1) Nginx        - 리버스 프록시 (Entry Point)
 2) Frontend     - Next.js UI 서버
 3) Backend      - Django REST API (Gunicorn)
 4) WebSocket    - Django WebSocket (Daphne)
 5) Redis        - 캐시 및 메시지 브로커
 6) PostgreSQL   - 메인 데이터베이스 (pgvector)
 7) Airflow      - RAG 데이터 파이프라인
 0) 종료

선택:
```

**해당 인스턴스의 번호를 입력하면 자동으로 모든 설정이 완료됩니다!**

예시:
- Nginx 인스턴스에서는 `1` 입력
- Frontend 인스턴스에서는 `2` 입력
- Backend 인스턴스에서는 `3` 입력
- WebSocket 인스턴스에서는 `4` 입력
- Redis 인스턴스에서는 `5` 입력
- PostgreSQL 인스턴스에서는 `6` 입력
- Airflow 인스턴스에서는 `7` 입력

#### 4단계: 배포 확인

```bash
# 컨테이너 상태 확인
sudo docker ps

# 로그 확인
sudo docker-compose -f docker-compose.<service>.yml logs -f

# 예: Backend 로그 확인
sudo docker-compose -f docker-compose.backend.yml logs -f
```

#### 인스턴스별 확인 방법

| 인스턴스 | 확인 방법 | 예상 결과 |
|----------|-----------|-----------|
| Nginx | `curl http://localhost` | HTML 응답 |
| Frontend | `curl http://localhost:3000` | Next.js 페이지 |
| Backend | `curl http://localhost:8000/api/health/` | `{"status": "ok"}` |
| WebSocket | 브라우저에서 WebSocket 연결 테스트 | 연결 성공 |
| Redis | `docker exec triplan-redis redis-cli ping` | `PONG` |
| PostgreSQL | `docker exec triplan-postgres psql -U postgres -c "SELECT 1"` | `1` |
| Airflow | `curl http://localhost:8080` | Airflow UI |

### 수동 배포 (고급 사용자용)

자동화 스크립트 없이 직접 배포하려면 각 인스턴스별 템플릿을 참고하세요:

```bash
# 인스턴스별 .env 템플릿 확인
deploy-examples/env-templates/1-nginx.env
deploy-examples/env-templates/2-frontend.env
deploy-examples/env-templates/3-backend.env
deploy-examples/env-templates/4-websocket.env
deploy-examples/env-templates/5-redis.env
deploy-examples/env-templates/6-postgres.env
deploy-examples/env-templates/7-airflow.env
```

---

## 📞 문의 및 지원

- **이슈 리포트**: GitHub Issues
- **문서**: [프로젝트 Wiki](wiki-url)
- **이메일**: support@triplan.com

---

## 📝 변경 이력

- **2025-01-07**: entrypoint.sh 자동화 스크립트 추가
- **2025-01-07**: .env.example 파일 추가
- **2025-01-07**: docker-compose.yml 환경변수 정리
- **2025-01-07**: DEPLOYMENT.md 작성

---

## ✅ 체크리스트

배포 전에 다음 항목들을 확인하세요:

- [ ] `.env` 파일 생성 및 필수 값 입력
- [ ] `SECRET_KEY` 변경 (운영 환경)
- [ ] `POSTGRES_PASSWORD` 변경 (운영 환경)
- [ ] `DEBUG=False` 설정 (운영 환경)
- [ ] `ALLOWED_HOSTS` 설정 (운영 환경)
- [ ] API 키 입력 (OPENAI, KAKAO)
- [ ] `docker-compose up -d --build` 실행
- [ ] 로그 확인: `docker-compose logs -f`
- [ ] 웹사이트 접속 확인: `http://localhost:3000`
- [ ] Admin 로그인 확인: `http://localhost:8000/admin/`

---

**🎉 완료! 이제 Triplan을 사용할 수 있습니다!**
