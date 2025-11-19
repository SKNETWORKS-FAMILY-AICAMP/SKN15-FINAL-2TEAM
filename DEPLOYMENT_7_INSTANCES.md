# 🚀 Triplan 7-Instance 배포 가이드 (AWS EC2)

> **목표**: Triplan 서비스를 7개의 EC2 인스턴스에 분산 배포하여 고가용성과 확장성 확보

## 📋 목차
1. [인스턴스 구성](#인스턴스-구성)
2. [사전 준비](#사전-준비)
3. [각 인스턴스 배포](#각-인스턴스-배포)
4. [네트워크 설정](#네트워크-설정)
5. [모니터링 및 로깅](#모니터링-및-로깅)
6. [트러블슈팅](#트러블슈팅)

---

## 📦 인스턴스 구성

### 1️⃣ **Database Instance** (PostgreSQL + Redis)
- **용도**: 메인 데이터베이스 및 캐시/메시지 큐
- **권장 스펙**: t3.medium (2 vCPU, 4GB RAM)
- **스토리지**: 50GB SSD (gp3)
- **컨테이너**:
  - PostgreSQL (with pgvector)
  - Redis
- **포트**: 5432, 6379

### 2️⃣ **Backend Instance** (Django REST API)
- **용도**: REST API 서버 (Gunicorn)
- **권장 스펙**: t3.medium (2 vCPU, 4GB RAM)
- **컨테이너**:
  - Django Backend (Gunicorn)
- **포트**: 8000

### 3️⃣ **WebSocket Instance** (Django Channels)
- **용도**: 실시간 채팅 WebSocket 서버 (Daphne)
- **권장 스펙**: t3.medium (2 vCPU, 4GB RAM)
- **컨테이너**:
  - Django WebSocket (Daphne)
- **포트**: 8001

### 4️⃣ **Frontend Instance** (Next.js)
- **용도**: 프론트엔드 웹 애플리케이션
- **권장 스펙**: t3.small (2 vCPU, 2GB RAM)
- **컨테이너**:
  - Next.js Frontend
- **포트**: 3000

### 5️⃣ **Airflow Database Instance**
- **용도**: Airflow 전용 데이터베이스
- **권장 스펙**: t3.small (2 vCPU, 2GB RAM)
- **스토리지**: 20GB SSD
- **컨테이너**:
  - PostgreSQL (Airflow용)
- **포트**: 5432

### 6️⃣ **Airflow Webserver Instance**
- **용도**: Airflow UI 및 관리
- **권장 스펙**: t3.small (2 vCPU, 2GB RAM)
- **컨테이너**:
  - Airflow Webserver
- **포트**: 8080

### 7️⃣ **Airflow Scheduler Instance**
- **용도**: Airflow DAG 스케줄링 및 실행
- **권장 스펙**: t3.small (2 vCPU, 2GB RAM)
- **컨테이너**:
  - Airflow Scheduler
- **포트**: -

---

## 🔧 사전 준비

### 1. AWS EC2 인스턴스 생성
```bash
# 7개 인스턴스 생성 (Ubuntu 22.04 LTS)
# AMI: ami-0c9c942bd7bf113a2
# 보안 그룹: triplan-sg

# 인스턴스 태그:
# - triplan-db
# - triplan-backend
# - triplan-websocket
# - triplan-frontend
# - triplan-airflow-db
# - triplan-airflow-web
# - triplan-airflow-scheduler
```

### 2. 보안 그룹 설정
```
Security Group: triplan-sg

인바운드 규칙:
┌─────────┬──────────┬─────────────────────┬───────────────┐
│ 타입    │ 포트     │ 소스                │ 설명          │
├─────────┼──────────┼─────────────────────┼───────────────┤
│ SSH     │ 22       │ My IP               │ 관리자 접속   │
│ HTTP    │ 80       │ 0.0.0.0/0           │ 웹 접속       │
│ HTTPS   │ 443      │ 0.0.0.0/0           │ 웹 접속       │
│ Custom  │ 5432     │ VPC CIDR            │ PostgreSQL    │
│ Custom  │ 6379     │ VPC CIDR            │ Redis         │
│ Custom  │ 8000     │ VPC CIDR            │ Backend API   │
│ Custom  │ 8001     │ VPC CIDR            │ WebSocket     │
│ Custom  │ 3000     │ VPC CIDR            │ Frontend      │
│ Custom  │ 8080     │ VPC CIDR            │ Airflow UI    │
└─────────┴──────────┴─────────────────────┴───────────────┘
```

### 3. 환경 변수 준비
```bash
# 각 인스턴스용 .env 파일 준비
# Database Instance IP를 미리 확인하여 변수에 저장
DB_INSTANCE_IP="10.0.1.10"
AIRFLOW_DB_IP="10.0.1.50"
```

---

## 🚀 각 인스턴스 배포

### 1️⃣ Database Instance 배포

```bash
# SSH 접속
ssh -i your-key.pem ubuntu@<DB-INSTANCE-IP>

# Docker 설치
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu
newgrp docker

# Docker Compose 설치
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 프로젝트 클론
git clone https://github.com/your-repo/triplan.git
cd triplan

# 환경 변수 설정
cat > .env <<EOF
POSTGRES_DB=lecun2
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<strong-password>
REDIS_PASSWORD=<redis-password>
EOF

# Docker Compose 파일 생성 (db-only.yml)
cat > docker-compose.db.yml <<'COMPOSE'
version: '3.8'

services:
  postgres:
    image: ankane/pgvector:latest
    container_name: triplan-db
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
      - ./database/init.sql:/docker-entrypoint-initdb.d/01-init.sql
      - ./database/pgvector-setup.sql:/docker-entrypoint-initdb.d/02-pgvector-setup.sql
    ports:
      - "5432:5432"
    restart: always
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: triplan-redis
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - ./data/redis:/data
    ports:
      - "6379:6379"
    restart: always
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
COMPOSE

# 실행
docker-compose -f docker-compose.db.yml up -d

# 로그 확인
docker-compose -f docker-compose.db.yml logs -f
```

### 2️⃣ Backend Instance 배포

```bash
# SSH 접속
ssh -i your-key.pem ubuntu@<BACKEND-INSTANCE-IP>

# Docker 설치
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu
newgrp docker
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 프로젝트 클론
git clone https://github.com/your-repo/triplan.git
cd triplan

# 환경 변수 설정
cat > .env <<EOF
# Database Connection
DATABASE_URL=postgresql://postgres:<password>@<DB-INSTANCE-IP>:5432/lecun2
REDIS_URL=redis://:<redis-password>@<DB-INSTANCE-IP>:6379/0

# API Keys
OPENAI_API_KEY=<your-openai-key>
KAKAO_API_KEY=<your-kakao-key>
KAKAO_REST_API_KEY=<your-kakao-rest-key>

# Django Settings
SECRET_KEY=$(python3 -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())')
ALLOWED_HOSTS=*
DEBUG=False
EOF

# STT 모델 파일 전송 (로컬에서 실행)
# scp backend/models/stt/model.safetensors ubuntu@<BACKEND-INSTANCE-IP>:~/triplan/backend/models/stt/

# Docker Compose 파일 생성
cat > docker-compose.backend.yml <<'COMPOSE'
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: triplan-backend
    command: >
      sh -c "python manage.py migrate &&
             python manage.py collectstatic --noinput &&
             bash load_initial_regions.sh &&
             gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 4 --timeout 300"
    environment:
      - DEBUG=${DEBUG}
      - SECRET_KEY=${SECRET_KEY}
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - KAKAO_API_KEY=${KAKAO_API_KEY}
      - KAKAO_REST_API_KEY=${KAKAO_REST_API_KEY}
      - ALLOWED_HOSTS=${ALLOWED_HOSTS}
    volumes:
      - ./data/static:/app/staticfiles
      - ./data/media:/app/media
      - ./data/exports:/app/exports
    ports:
      - "8000:8000"
    restart: always
COMPOSE

# 빌드 및 실행
docker-compose -f docker-compose.backend.yml up -d --build

# 로그 확인
docker-compose -f docker-compose.backend.yml logs -f backend
```

### 3️⃣ WebSocket Instance 배포

```bash
# SSH 접속
ssh -i your-key.pem ubuntu@<WEBSOCKET-INSTANCE-IP>

# Docker 설치 (생략 - Backend와 동일)
# 프로젝트 클론 (생략)
# .env 파일 생성 (Backend와 동일한 내용)

# Docker Compose 파일 생성
cat > docker-compose.websocket.yml <<'COMPOSE'
version: '3.8'

services:
  websocket:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: triplan-websocket
    command: daphne -b 0.0.0.0 -p 8001 config.asgi:application
    environment:
      - DEBUG=${DEBUG}
      - SECRET_KEY=${SECRET_KEY}
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - KAKAO_API_KEY=${KAKAO_API_KEY}
      - ALLOWED_HOSTS=${ALLOWED_HOSTS}
    ports:
      - "8001:8001"
    restart: always
COMPOSE

# 빌드 및 실행
docker-compose -f docker-compose.websocket.yml up -d --build

# 로그 확인
docker-compose -f docker-compose.websocket.yml logs -f websocket
```

### 4️⃣ Frontend Instance 배포

```bash
# SSH 접속
ssh -i your-key.pem ubuntu@<FRONTEND-INSTANCE-IP>

# Docker 설치 (생략)
# 프로젝트 클론 (생략)

# 프론트엔드 환경 변수 설정
cat > frontend/.env.production <<EOF
NEXT_PUBLIC_API_URL=http://<BACKEND-INSTANCE-IP>:8000
NEXT_PUBLIC_WS_URL=ws://<WEBSOCKET-INSTANCE-IP>:8001
NEXT_PUBLIC_KAKAO_API_KEY=<your-kakao-map-key>
NODE_ENV=production
EOF

# next.config.js 확인 (standalone 빌드 활성화)
cat > frontend/next.config.js <<'NEXTCONFIG'
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // ⭐ Standalone 빌드 활성화
  swcMinify: true,
}

module.exports = nextConfig
NEXTCONFIG

# Dockerfile.production 생성
cat > frontend/Dockerfile.production <<'DOCKERFILE'
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
DOCKERFILE

# Docker Compose 파일 생성
cat > docker-compose.frontend.yml <<'COMPOSE'
version: '3.8'

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.production
    container_name: triplan-frontend
    environment:
      - NODE_ENV=production
    ports:
      - "3000:3000"
    restart: always
COMPOSE

# 빌드 및 실행
docker-compose -f docker-compose.frontend.yml up -d --build

# 로그 확인
docker-compose -f docker-compose.frontend.yml logs -f frontend
```

### 5️⃣ Airflow Database Instance

```bash
# SSH 접속
ssh -i your-key.pem ubuntu@<AIRFLOW-DB-IP>

# Docker 설치 (생략)

# Docker Compose 파일 생성
cat > docker-compose.airflow-db.yml <<'COMPOSE'
version: '3.8'

services:
  airflow-postgres:
    image: postgres:15-alpine
    container_name: triplan-airflow-db
    environment:
      POSTGRES_DB: airflow
      POSTGRES_USER: airflow
      POSTGRES_PASSWORD: airflow123
    volumes:
      - ./data/airflow-postgres:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: always
COMPOSE

# 실행
docker-compose -f docker-compose.airflow-db.yml up -d

# 로그 확인
docker-compose -f docker-compose.airflow-db.yml logs -f
```

### 6️⃣ Airflow Webserver Instance

```bash
# SSH 접속
ssh -i your-key.pem ubuntu@<AIRFLOW-WEB-IP>

# Docker 설치 (생략)
# 프로젝트 클론 (생략)

# 환경 변수 설정
cat > .env <<EOF
AIRFLOW__CORE__SQL_ALCHEMY_CONN=postgresql+psycopg2://airflow:airflow123@<AIRFLOW-DB-IP>:5432/airflow
AIRFLOW_FERNET_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
AIRFLOW_WEBSERVER_SECRET_KEY=$(openssl rand -hex 32)
AIRFLOW_USERNAME=admin
AIRFLOW_PASSWORD=admin123
EOF

# Docker Compose 파일 생성
cat > docker-compose.airflow-web.yml <<'COMPOSE'
version: '3.8'

services:
  airflow-webserver:
    build:
      context: ./airflow
      dockerfile: Dockerfile
    container_name: triplan-airflow-webserver
    command: webserver
    environment:
      - AIRFLOW__CORE__EXECUTOR=LocalExecutor
      - AIRFLOW__CORE__SQL_ALCHEMY_CONN=${AIRFLOW__CORE__SQL_ALCHEMY_CONN}
      - AIRFLOW__CORE__FERNET_KEY=${AIRFLOW_FERNET_KEY}
      - AIRFLOW__WEBSERVER__SECRET_KEY=${AIRFLOW_WEBSERVER_SECRET_KEY}
      - AIRFLOW_WWW_USER_USERNAME=${AIRFLOW_USERNAME}
      - AIRFLOW_WWW_USER_PASSWORD=${AIRFLOW_PASSWORD}
    volumes:
      - ./airflow/dags:/opt/airflow/dags
      - ./airflow/logs:/opt/airflow/logs
    ports:
      - "8080:8080"
    restart: always
COMPOSE

# 빌드 및 실행
docker-compose -f docker-compose.airflow-web.yml up -d --build

# 로그 확인
docker-compose -f docker-compose.airflow-web.yml logs -f
```

### 7️⃣ Airflow Scheduler Instance

```bash
# SSH 접속
ssh -i your-key.pem ubuntu@<AIRFLOW-SCHED-IP>

# Docker 설치 (생략)
# 프로젝트 클론 (생략)
# .env 파일 생성 (Webserver와 동일)

# Docker Compose 파일 생성
cat > docker-compose.airflow-sched.yml <<'COMPOSE'
version: '3.8'

services:
  airflow-scheduler:
    build:
      context: ./airflow
      dockerfile: Dockerfile
    container_name: triplan-airflow-scheduler
    command: scheduler
    environment:
      - AIRFLOW__CORE__EXECUTOR=LocalExecutor
      - AIRFLOW__CORE__SQL_ALCHEMY_CONN=${AIRFLOW__CORE__SQL_ALCHEMY_CONN}
      - AIRFLOW__CORE__FERNET_KEY=${AIRFLOW_FERNET_KEY}
    volumes:
      - ./airflow/dags:/opt/airflow/dags
      - ./airflow/logs:/opt/airflow/logs
      - ./data/airflow-data:/opt/airflow/data
    restart: always
COMPOSE

# 빌드 및 실행
docker-compose -f docker-compose.airflow-sched.yml up -d --build

# 로그 확인
docker-compose -f docker-compose.airflow-sched.yml logs -f
```

---

## 🌐 네트워크 설정

### Nginx 리버스 프록시 (Frontend Instance에 설치)

```bash
# Frontend Instance에 Nginx 설치
sudo apt update
sudo apt install nginx -y

# Nginx 설정
sudo nano /etc/nginx/sites-available/triplan

# 아래 내용 입력:
```nginx
upstream backend {
    server <BACKEND-INSTANCE-IP>:8000;
}

upstream websocket {
    server <WEBSOCKET-INSTANCE-IP>:8001;
}

upstream frontend {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name your-domain.com;

    # Backend API
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /ws/ {
        proxy_pass http://websocket;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Static files
    location /static/ {
        alias /home/ubuntu/triplan/data/static/;
    }

    location /media/ {
        alias /home/ubuntu/triplan/data/media/;
    }

    # Frontend
    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
# 심볼릭 링크 생성
sudo ln -s /etc/nginx/sites-available/triplan /etc/nginx/sites-enabled/

# 기본 설정 제거
sudo rm /etc/nginx/sites-enabled/default

# 설정 테스트
sudo nginx -t

# Nginx 재시작
sudo systemctl restart nginx
sudo systemctl enable nginx
```

---

## 📊 모니터링 및 로깅

### 각 인스턴스에 Prometheus Node Exporter 설치

```bash
# 모든 인스턴스에서 실행
wget https://github.com/prometheus/node_exporter/releases/download/v1.7.0/node_exporter-1.7.0.linux-amd64.tar.gz
tar xvfz node_exporter-1.7.0.linux-amd64.tar.gz
sudo cp node_exporter-1.7.0.linux-amd64/node_exporter /usr/local/bin/
sudo useradd -rs /bin/false node_exporter

# Systemd 서비스 생성
sudo cat > /etc/systemd/system/node_exporter.service <<EOF
[Unit]
Description=Node Exporter
After=network.target

[Service]
User=node_exporter
Group=node_exporter
Type=simple
ExecStart=/usr/local/bin/node_exporter

[Install]
WantedBy=multi-user.target
EOF

# 서비스 시작
sudo systemctl daemon-reload
sudo systemctl start node_exporter
sudo systemctl enable node_exporter
```

### 헬스 체크 스크립트

```bash
# health-check.sh
#!/bin/bash

INSTANCES=(
  "Database:5432:<DB-IP>"
  "Backend:8000:<BACKEND-IP>"
  "WebSocket:8001:<WS-IP>"
  "Frontend:3000:<FRONTEND-IP>"
  "Airflow-DB:5432:<AIRFLOW-DB-IP>"
  "Airflow-Web:8080:<AIRFLOW-WEB-IP>"
)

for instance in "${INSTANCES[@]}"; do
  IFS=':' read -r name port ip <<< "$instance"
  echo -n "Checking $name ($ip:$port)... "

  if nc -z -w3 $ip $port 2>/dev/null; then
    echo "✅ OK"
  else
    echo "❌ FAILED"
  fi
done
```

---

## 🔥 트러블슈팅

### 문제 1: 인스턴스 간 통신 실패

```bash
# 보안 그룹 확인
aws ec2 describe-security-groups --group-ids sg-xxxxx

# VPC CIDR 확인
aws ec2 describe-vpcs

# 네트워크 연결 테스트
telnet <DB-INSTANCE-IP> 5432
```

### 문제 2: Docker 메모리 부족

```bash
# Swap 추가 (모든 인스턴스)
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 문제 3: 프론트엔드 빌드 실패

```bash
# 메모리 부족 시
export NODE_OPTIONS="--max-old-space-size=2048"
docker-compose -f docker-compose.frontend.yml up -d --build --no-cache
```

---

## 📋 배포 체크리스트

### 배포 전
- [ ] 7개 EC2 인스턴스 생성
- [ ] 보안 그룹 설정
- [ ] 키페어 다운로드
- [ ] 도메인 DNS 설정
- [ ] .env 파일 준비
- [ ] STT 모델 파일 준비

### 배포 중
- [ ] Database Instance 실행
- [ ] Backend Instance 빌드 및 실행
- [ ] WebSocket Instance 실행
- [ ] Frontend Instance 빌드 및 실행
- [ ] Airflow 3개 인스턴스 실행
- [ ] Nginx 설정

### 배포 후
- [ ] 모든 컨테이너 Up 상태
- [ ] 헬스 체크 통과
- [ ] E2E 테스트
- [ ] 모니터링 설정
- [ ] 백업 설정

---

**작성일**: 2025-11-19
**버전**: 1.0
**관리자**: DevOps Team
