# 📦 Triplan 배포 구조 요약

## 🎯 배포 방식

### 1️⃣ 로컬 개발 환경
**모든 서비스를 한 번에 실행**

```bash
./run-local.sh
```

- 파일: `docker-compose.local.yml`
- 대상: 개발자 로컬 머신
- 포함: Frontend, Backend, WebSocket, PostgreSQL, Redis, Airflow 전체

---

### 2️⃣ 프로덕션 환경 (3개 EC2 인스턴스)
**각 인스턴스가 독립적으로 실행**

#### 📁 디렉토리 구조
```
triplan/
├── deploy/
│   ├── frontend/           # Frontend EC2용
│   │   ├── docker-compose.yml
│   │   └── deploy.sh
│   │
│   ├── backend/            # Backend EC2용
│   │   ├── docker-compose.yml
│   │   └── deploy.sh
│   │
│   └── database/           # Database EC2용
│       ├── docker-compose.yml
│       └── deploy.sh
│
├── docker-compose.local.yml    # 로컬 전체 실행용
└── run-local.sh               # 로컬 실행 스크립트
```

---

## 🖥️ EC2 인스턴스별 구성

### Frontend EC2
**실행 서비스:**
- ✅ Next.js (3000)
- ✅ Nginx (80, 443)

**실행 방법:**
```bash
cd triplan/deploy/frontend
./deploy.sh
```

**환경 변수:**
- `NEXT_PUBLIC_API_URL`: Backend EC2 주소
- `NEXT_PUBLIC_WS_URL`: Backend EC2 WebSocket 주소
- `NEXT_PUBLIC_KAKAO_API_KEY`

---

### Backend EC2
**실행 서비스:**
- ✅ Django (Gunicorn) - 8000
- ✅ WebSocket (Daphne) - 8001
- ✅ Redis - 6379

**실행 방법:**
```bash
cd triplan/deploy/backend
./deploy.sh
```

**환경 변수:**
- `SECRET_KEY`: Django 시크릿 키
- `DATABASE_URL`: Database EC2의 PostgreSQL 주소
- `REDIS_URL`: 로컬 Redis
- `OPENAI_API_KEY`
- `KAKAO_API_KEY`

---

### Database EC2
**실행 서비스:**
- ✅ PostgreSQL + pgvector - 5432
- ✅ Airflow Webserver - 8080
- ✅ Airflow Scheduler
- ✅ Airflow PostgreSQL (별도)

**실행 방법:**
```bash
cd triplan/deploy/database
./deploy.sh
```

**환경 변수:**
- `POSTGRES_PASSWORD`
- `AIRFLOW_FERNET_KEY`
- `AIRFLOW_WEBSERVER_SECRET_KEY`

---

## 🔄 데이터 흐름

```
[사용자]
    ↓
[Frontend EC2 - Nginx:80]
    ↓
    ├─→ [Frontend EC2 - Next.js:3000]
    │
    ├─→ [Backend EC2 - Django:8000] ─→ [Database EC2 - PostgreSQL:5432]
    │                  ↓
    │              [Backend EC2 - Redis:6379]
    │
    └─→ [Backend EC2 - WebSocket:8001] ─→ [Backend EC2 - Redis:6379]
```

---

## 📝 배포 순서 (중요!)

### 1단계: Database EC2
```bash
ssh database-ec2
cd triplan/deploy/database
./deploy.sh
```
**이유:** 다른 서비스가 데이터베이스에 의존하기 때문

### 2단계: Backend EC2
```bash
ssh backend-ec2
cd triplan/deploy/backend
./deploy.sh
```
**이유:** Frontend가 Backend API에 의존하기 때문

### 3단계: Frontend EC2
```bash
ssh frontend-ec2
cd triplan/deploy/frontend
./deploy.sh
```

---

## 🔑 핵심 파일들

### 배포 스크립트
| 파일 | 용도 |
|------|------|
| `run-local.sh` | 로컬에서 전체 시스템 실행 |
| `deploy/frontend/deploy.sh` | Frontend EC2 배포 |
| `deploy/backend/deploy.sh` | Backend EC2 배포 |
| `deploy/database/deploy.sh` | Database EC2 배포 |

### Docker Compose 파일
| 파일 | 용도 |
|------|------|
| `docker-compose.local.yml` | 로컬 개발 (전체) |
| `deploy/frontend/docker-compose.yml` | Frontend EC2 |
| `deploy/backend/docker-compose.yml` | Backend EC2 |
| `deploy/database/docker-compose.yml` | Database EC2 |

---

## ⚡ 빠른 명령어 참조

### 로컬 개발
```bash
# 전체 시작
./run-local.sh

# 전체 중지
docker-compose -f docker-compose.local.yml down

# 로그 확인
docker-compose -f docker-compose.local.yml logs -f

# 특정 서비스 재시작
docker-compose -f docker-compose.local.yml restart backend
```

### EC2 배포
```bash
# 각 EC2에서
cd triplan/deploy/<서비스명>
./deploy.sh

# 로그 확인
docker-compose logs -f

# 재시작
docker-compose restart

# 중지
docker-compose down
```

---

## 🛠️ 유용한 팁

### 환경 변수 생성

```bash
# Django Secret Key
python3 -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"

# Airflow Fernet Key
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Random Secret
openssl rand -hex 32
```

### 보안 그룹 체크리스트

- [ ] Frontend EC2: 80, 443 오픈
- [ ] Backend EC2: Frontend에서만 접근 가능
- [ ] Database EC2: Backend에서만 접근 가능
- [ ] SSH (22): 자신의 IP에서만 접근 가능

### 모니터링

```bash
# 컨테이너 상태
docker-compose ps

# 리소스 사용량
docker stats

# 로그 (실시간)
docker-compose logs -f

# 디스크 사용량
df -h
docker system df
```

---

## 📞 문제 해결

### "Database 연결 안됨"
1. Database EC2가 실행 중인지 확인
2. 보안 그룹에서 5432 포트 허용 확인
3. DATABASE_URL에 올바른 Private IP 사용 확인

### "Frontend가 Backend에 연결 안됨"
1. Backend EC2가 실행 중인지 확인
2. NEXT_PUBLIC_API_URL이 올바른지 확인
3. Nginx 설정의 upstream 주소 확인

### "메모리 부족"
```bash
# Swap 설정
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

---

## 📚 상세 문서

- [DEPLOYMENT.md](DEPLOYMENT.md) - 상세 배포 가이드
- [ARCHITECTURE.md](ARCHITECTURE.md) - 시스템 아키텍처 설명
- [README.md](README.md) - 프로젝트 개요

---

## ✅ 배포 체크리스트

### 배포 전
- [ ] 모든 `.env` 파일 생성 및 설정
- [ ] API 키 발급 (OpenAI, Kakao)
- [ ] EC2 인스턴스 생성 및 보안 그룹 설정
- [ ] Docker & Docker Compose 설치

### 배포 중
- [ ] Database EC2 배포
- [ ] Backend EC2 배포
- [ ] Frontend EC2 배포
- [ ] 각 서비스 헬스 체크

### 배포 후
- [ ] 웹사이트 접속 테스트
- [ ] API 동작 확인
- [ ] WebSocket 연결 테스트
- [ ] Airflow DAG 동작 확인
- [ ] 로그 모니터링 설정

---

**배포 완료 후 접속:**
- 🌐 웹사이트: `http://frontend-ec2-ip`
- 📊 Airflow: `http://database-ec2-ip:8080`
- 🔧 Django Admin: `http://backend-ec2-ip:8000/admin`
