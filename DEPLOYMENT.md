# 🚀 Triplan 배포 가이드

## 배포 아키텍처

Triplan은 **3개의 독립적인 EC2 인스턴스**로 구성됩니다.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Frontend EC2   │     │  Backend EC2    │     │ Database EC2    │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ - Next.js       │────▶│ - Django API    │────▶│ - PostgreSQL    │
│ - Nginx         │     │ - WebSocket     │     │ - Airflow       │
│                 │     │ - Redis         │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## 📋 사전 준비사항

### 1. EC2 인스턴스 스펙

| 인스턴스 | 권장 스펙 | 최소 스펙 |
|---------|-----------|-----------|
| Frontend EC2 | t3.medium (2 vCPU, 4GB RAM) | t3.small (2 vCPU, 2GB RAM) |
| Backend EC2 | t3.large (2 vCPU, 8GB RAM) | t3.medium (2 vCPU, 4GB RAM) |
| Database EC2 | t3.large (2 vCPU, 8GB RAM) | t3.medium (2 vCPU, 4GB RAM) |

### 2. 보안 그룹 설정

#### Frontend EC2
- Inbound:
  - 80 (HTTP) - 0.0.0.0/0
  - 443 (HTTPS) - 0.0.0.0/0
  - 22 (SSH) - Your IP
  - 3000 (Next.js) - Backend EC2 보안 그룹

#### Backend EC2
- Inbound:
  - 8000 (Django API) - Frontend EC2 보안 그룹
  - 8001 (WebSocket) - Frontend EC2 보안 그룹
  - 6379 (Redis) - 자기 자신
  - 22 (SSH) - Your IP

#### Database EC2
- Inbound:
  - 5432 (PostgreSQL) - Backend EC2 보안 그룹
  - 8080 (Airflow) - Your IP (관리용)
  - 22 (SSH) - Your IP

### 3. 필수 설치

각 EC2 인스턴스에 다음을 설치해야 합니다:

```bash
# Docker 설치
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Docker Compose 설치
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 재로그인 (Docker 그룹 적용)
exit
```

---

## 🗄️ 1단계: Database EC2 배포

### 1.1 코드 배포

```bash
# EC2에 SSH 접속
ssh -i your-key.pem ubuntu@database-ec2-ip

# 프로젝트 클론
git clone <your-repo-url>
cd triplan/deploy/database
```

### 1.2 환경 변수 설정

```bash
# .env 파일 생성
cat > .env << EOF
# PostgreSQL
POSTGRES_DB=triplan
POSTGRES_USER=postgres
POSTGRES_PASSWORD=CHANGE_THIS_STRONG_PASSWORD

# Airflow Database
AIRFLOW_DB_PASSWORD=CHANGE_THIS_AIRFLOW_PASSWORD

# Airflow Fernet Key (아래 명령어로 생성)
AIRFLOW_FERNET_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")

# Airflow Webserver Secret
AIRFLOW_WEBSERVER_SECRET_KEY=$(openssl rand -hex 32)

# Airflow 관리자 계정
AIRFLOW_USERNAME=admin
AIRFLOW_PASSWORD=CHANGE_THIS_ADMIN_PASSWORD
EOF
```

### 1.3 배포 실행

```bash
# 실행 권한 부여
chmod +x deploy.sh

# 배포
./deploy.sh
```

### 1.4 확인

```bash
# PostgreSQL 연결 테스트
docker-compose exec postgres psql -U postgres -d triplan -c "SELECT version();"

# Airflow 웹 접속
# http://database-ec2-ip:8080
```

---

## 🔧 2단계: Backend EC2 배포

### 2.1 코드 배포

```bash
# EC2에 SSH 접속
ssh -i your-key.pem ubuntu@backend-ec2-ip

# 프로젝트 클론
git clone <your-repo-url>
cd triplan/deploy/backend
```

### 2.2 환경 변수 설정

```bash
# .env 파일 생성
cat > .env << EOF
# Django Secret Key (아래 명령어로 생성)
SECRET_KEY=$(python3 -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())")

# Database URL (Database EC2의 Private IP 사용)
DATABASE_URL=postgresql://postgres:YOUR_POSTGRES_PASSWORD@database-private-ip:5432/triplan

# Redis (로컬 Redis 사용)
REDIS_URL=redis://redis:6379/0

# OpenAI API Key
OPENAI_API_KEY=sk-your-openai-api-key

# Kakao Map API Key
KAKAO_API_KEY=your-kakao-api-key

# Django Settings
DEBUG=False
ALLOWED_HOSTS=backend-ec2-ip,backend-domain.com
EOF
```

### 2.3 배포 실행

```bash
chmod +x deploy.sh
./deploy.sh
```

### 2.4 슈퍼유저 생성

```bash
docker-compose exec backend python manage.py createsuperuser
```

### 2.5 확인

```bash
# API 테스트
curl http://localhost:8000/health

# Django Admin 접속
# http://backend-ec2-ip:8000/admin
```

---

## 🎨 3단계: Frontend EC2 배포

### 3.1 코드 배포

```bash
# EC2에 SSH 접속
ssh -i your-key.pem ubuntu@frontend-ec2-ip

# 프로젝트 클론
git clone <your-repo-url>
cd triplan/deploy/frontend
```

### 3.2 환경 변수 설정

```bash
# .env 파일 생성
cat > .env << EOF
NODE_ENV=production

# Backend API URL (Backend EC2의 Public IP 또는 도메인)
NEXT_PUBLIC_API_URL=http://backend-ec2-ip:8000

# WebSocket URL
NEXT_PUBLIC_WS_URL=ws://backend-ec2-ip:8001

# Kakao Map API Key
NEXT_PUBLIC_KAKAO_API_KEY=your-kakao-api-key
EOF
```

### 3.3 Nginx 설정 수정

Backend 및 WebSocket 서버 주소를 실제 Backend EC2 IP로 변경:

```bash
# nginx.conf 수정
nano ../../nginx/nginx.conf

# upstream 설정 수정
upstream backend {
    server backend-ec2-private-ip:8000;
}

upstream websocket {
    server backend-ec2-private-ip:8001;
}
```

### 3.4 배포 실행

```bash
chmod +x deploy.sh
./deploy.sh
```

### 3.5 확인

```bash
# 웹사이트 접속
# http://frontend-ec2-ip
```

---

## 🌐 로컬 개발 환경

로컬에서 전체 시스템을 테스트하려면:

### 실행 방법

```bash
# 프로젝트 루트에서
./run-local.sh

# 또는 수동으로
docker-compose -f docker-compose.local.yml up -d
```

### 접속 정보

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- WebSocket: ws://localhost:8001
- Airflow: http://localhost:8080 (admin/admin)
- PostgreSQL: localhost:5432
- Redis: localhost:6379

---

## 🔄 업데이트 및 재배포

### 코드 업데이트

각 EC2 인스턴스에서:

```bash
cd triplan/deploy/<서비스명>

# 최신 코드 가져오기
git pull

# 재배포
./deploy.sh
```

### 무중단 배포 (Blue-Green)

```bash
# 새 컨테이너 빌드
docker-compose build

# 새 컨테이너 시작 (기존 컨테이너와 함께 실행)
docker-compose up -d --no-deps --scale backend=2

# 트래픽 전환 후 기존 컨테이너 중지
docker-compose up -d --scale backend=1
```

---

## 📊 모니터링 및 로그

### 로그 확인

```bash
# 실시간 로그
docker-compose logs -f

# 특정 서비스 로그
docker-compose logs -f backend

# 최근 100줄 로그
docker-compose logs --tail=100
```

### 상태 확인

```bash
# 컨테이너 상태
docker-compose ps

# 리소스 사용량
docker stats

# 디스크 사용량
df -h
docker system df
```

---

## 🔐 보안 체크리스트

- [ ] 모든 `.env` 파일의 기본 비밀번호 변경
- [ ] SSH 키 기반 인증 사용
- [ ] 불필요한 포트 닫기
- [ ] HTTPS 인증서 설정 (Let's Encrypt)
- [ ] Django `DEBUG=False` 설정
- [ ] Database 백업 자동화 설정
- [ ] 로그 로테이션 설정
- [ ] 방화벽 규칙 최소화

---

## 🆘 트러블슈팅

### Backend가 Database에 연결하지 못함

```bash
# Database EC2에서
docker-compose ps postgres

# Backend EC2에서 연결 테스트
telnet database-private-ip 5432

# 보안 그룹 확인
```

### Frontend가 Backend에 연결하지 못함

```bash
# Frontend EC2에서 Backend 접속 테스트
curl http://backend-private-ip:8000/health

# Nginx 설정 확인
docker-compose exec nginx nginx -t
```

### 메모리 부족

```bash
# 메모리 사용량 확인
free -h

# Docker 리소스 정리
docker system prune -a

# Swap 설정
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

---

## 📚 추가 리소스

- [Docker 공식 문서](https://docs.docker.com/)
- [Django 배포 가이드](https://docs.djangoproject.com/en/4.2/howto/deployment/)
- [Next.js 배포 가이드](https://nextjs.org/docs/deployment)
- [AWS EC2 가이드](https://docs.aws.amazon.com/ec2/)

---

## 🎯 다음 단계

- [ ] CI/CD 파이프라인 구축 (GitHub Actions, Jenkins)
- [ ] 로드 밸런서 설정 (ALB)
- [ ] Auto Scaling 그룹 설정
- [ ] CloudWatch 모니터링 설정
- [ ] RDS 마이그레이션 고려
- [ ] ElastiCache 사용 고려
- [ ] CDN 설정 (CloudFront)
