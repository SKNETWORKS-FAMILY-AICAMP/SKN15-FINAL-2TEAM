# Triplan 7-Instance 배포 가이드

## 목차
1. [시스템 개요](#시스템-개요)
2. [7-Instance 아키텍처](#7-instance-아키텍처)
3. [Instance 사양](#instance-사양)
4. [Security Group 설정](#security-group-설정)
5. [단계별 배포](#단계별-배포)
6. [환경 변수 설정](#환경-변수-설정)
7. [배포 후 검증](#배포-후-검증)
8. [트러블슈팅](#트러블슈팅)

---

## 시스템 개요

**Triplan**은 AI 기반 협업 여행 플래너 서비스입니다.

### 7-Instance 배포 구성
1. **Nginx**: 리버스 프록시, SSL Termination, Load Balancing
2. **Frontend**: Next.js 애플리케이션 서버
3. **Backend**: Django REST API 서버
4. **Database**: PostgreSQL + pgvector
5. **Airflow**: 워크플로우 관리 (Scheduler + Webserver + DB 통합)
6. **WebSocket**: Django Channels 실시간 통신 서버
7. **Redis**: 캐시 및 WebSocket 채널 레이어

---

## 7-Instance 아키텍처

```
                            ┌─────────────────────┐
                            │   Internet Users    │
                            └──────────┬──────────┘
                                       │
                                       │ HTTPS (443)
                                       │
                            ┌──────────▼──────────┐
                            │   Instance #1       │
                            │   Nginx Proxy       │
                            │   (Load Balancer)   │
                            │   Port: 80, 443     │
                            └──────────┬──────────┘
                                       │
                     ┌─────────────────┼─────────────────┐
                     │                 │                 │
          ┌──────────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
          │  Instance #2    │  │ Instance #6 │  │ Instance #5 │
          │  Frontend       │  │  WebSocket  │  │  Airflow    │
          │  Next.js        │  │  Channels   │  │  Full Stack │
          │  Port: 3000     │  │  Port: 8001 │  │  Port: 8080 │
          └─────────────────┘  └──────┬──────┘  └─────────────┘
                     │                 │
                     │         ┌───────┴───────┐
                     │         │               │
          ┌──────────▼─────────▼──┐    ┌──────▼──────┐
          │    Instance #3        │    │ Instance #7 │
          │    Backend            │    │   Redis     │
          │    Django REST API    │    │   Cache     │
          │    Port: 8000         │    │   Port: 6379│
          └──────────┬────────────┘    └─────────────┘
                     │
                     │
          ┌──────────▼────────────┐
          │    Instance #4        │
          │    Database           │
          │    PostgreSQL 15      │
          │    + pgvector         │
          │    Port: 5432         │
          └───────────────────────┘
```

---

## Instance 사양

| Instance | 역할 | EC2 타입 | vCPU | RAM | 스토리지 | 월 비용 (예상) |
|----------|------|----------|------|-----|----------|---------------|
| #1 | Nginx (Load Balancer) | t3.small | 2 | 2GB | 10GB GP3 | $15-20 |
| #2 | Frontend (Next.js) | t3.small | 2 | 2GB | 10GB GP3 | $15-20 |
| #3 | Backend (Django) | t3.medium | 2 | 4GB | 20GB GP3 | $30-35 |
| #4 | Database (PostgreSQL) | t3.medium | 2 | 4GB | 50GB GP3 | $30-35 |
| #5 | Airflow (Full Stack) | t3.medium | 2 | 4GB | 30GB GP3 | $30-35 |
| #6 | WebSocket (Channels) | t3.small | 2 | 2GB | 10GB GP3 | $15-20 |
| #7 | Redis (Cache) | t3.small | 2 | 2GB | 10GB GP3 | $15-20 |

**총 예상 비용**: $150-185/월 (리전: ap-northeast-2, Seoul)

---

## Security Group 설정

### SG-Nginx (Instance #1)
```
Inbound Rules:
- HTTP (80) from 0.0.0.0/0
- HTTPS (443) from 0.0.0.0/0
- SSH (22) from My IP

Outbound Rules:
- All traffic
```

### SG-Frontend (Instance #2)
```
Inbound Rules:
- HTTP (3000) from SG-Nginx
- SSH (22) from My IP

Outbound Rules:
- All traffic
```

### SG-Backend (Instance #3)
```
Inbound Rules:
- HTTP (8000) from SG-Nginx, SG-Frontend
- SSH (22) from My IP

Outbound Rules:
- All traffic
```

### SG-Database (Instance #4)
```
Inbound Rules:
- PostgreSQL (5432) from SG-Backend, SG-WebSocket, SG-Airflow
- SSH (22) from My IP

Outbound Rules:
- All traffic
```

### SG-Airflow (Instance #5)
```
Inbound Rules:
- HTTP (8080) from SG-Nginx, 0.0.0.0/0
- SSH (22) from My IP

Outbound Rules:
- All traffic
```

### SG-WebSocket (Instance #6)
```
Inbound Rules:
- WebSocket (8001) from SG-Nginx, SG-Frontend
- SSH (22) from My IP

Outbound Rules:
- All traffic
```

### SG-Redis (Instance #7)
```
Inbound Rules:
- Redis (6379) from SG-Backend, SG-WebSocket
- SSH (22) from My IP

Outbound Rules:
- All traffic
```

---

## 단계별 배포

### 사전 준비

모든 인스턴스에 공통으로 필요한 작업:

```bash
# SSH 접속
ssh -i "your-key.pem" ubuntu@<INSTANCE-IP>

# 시스템 업데이트
sudo apt update && sudo apt upgrade -y

# Docker 설치
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Docker Compose 설치
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 사용자를 docker 그룹에 추가
sudo usermod -aG docker $USER
newgrp docker

# Git 설치
sudo apt install -y git
```

---

### Instance #1: Nginx (리버스 프록시)

#### 1.1 Nginx 설치
```bash
ssh -i "your-key.pem" ubuntu@<NGINX-IP>

sudo apt install -y nginx certbot python3-certbot-nginx
```

#### 1.2 Nginx 설정 파일 생성
```bash
sudo nano /etc/nginx/sites-available/triplan
```

```nginx
# Frontend
server {
    listen 80;
    server_name triplan.com www.triplan.com;

    location / {
        proxy_pass http://<FRONTEND-PRIVATE-IP>:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Backend API
server {
    listen 80;
    server_name api.triplan.com;

    location / {
        proxy_pass http://<BACKEND-PRIVATE-IP>:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # CORS headers
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type' always;

        if ($request_method = 'OPTIONS') {
            return 204;
        }
    }

    # Static files
    location /static/ {
        proxy_pass http://<BACKEND-PRIVATE-IP>:8000/static/;
    }

    # Media files
    location /media/ {
        proxy_pass http://<BACKEND-PRIVATE-IP>:8000/media/;
    }
}

# WebSocket
server {
    listen 80;
    server_name ws.triplan.com;

    location / {
        proxy_pass http://<WEBSOCKET-PRIVATE-IP>:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket timeout
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}

# Airflow
server {
    listen 80;
    server_name airflow.triplan.com;

    location / {
        proxy_pass http://<AIRFLOW-PRIVATE-IP>:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### 1.3 Nginx 활성화
```bash
sudo ln -s /etc/nginx/sites-available/triplan /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 1.4 SSL 인증서 발급 (Let's Encrypt)
```bash
sudo certbot --nginx -d triplan.com -d www.triplan.com
sudo certbot --nginx -d api.triplan.com
sudo certbot --nginx -d ws.triplan.com
sudo certbot --nginx -d airflow.triplan.com

# 자동 갱신 테스트
sudo certbot renew --dry-run
```

---

### Instance #2: Frontend (Next.js)

#### 2.1 프로젝트 클론
```bash
ssh -i "your-key.pem" ubuntu@<FRONTEND-IP>

git clone https://github.com/YOUR-REPO/SKN15-FINAL-2TEAM.git
cd SKN15-FINAL-2TEAM/frontend
```

#### 2.2 환경 변수 설정
```bash
nano .env.local
```

```env
NEXT_PUBLIC_API_URL=https://api.triplan.com
NEXT_PUBLIC_WS_URL=wss://ws.triplan.com
NEXT_PUBLIC_KAKAO_API_KEY=your_kakao_javascript_key
```

#### 2.3 Dockerfile 생성
```bash
nano Dockerfile
```

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

#### 2.4 Docker Compose 파일
```bash
cd ..
nano docker-compose-frontend.yml
```

```yaml
version: '3.8'

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: triplan-frontend
    ports:
      - "3000:3000"
    env_file:
      - ./frontend/.env.local
    restart: always
```

#### 2.5 실행
```bash
docker-compose -f docker-compose-frontend.yml build
docker-compose -f docker-compose-frontend.yml up -d

# 로그 확인
docker-compose -f docker-compose-frontend.yml logs -f
```

---

### Instance #3: Backend (Django)

#### 3.1 프로젝트 클론
```bash
ssh -i "your-key.pem" ubuntu@<BACKEND-IP>

git clone https://github.com/YOUR-REPO/SKN15-FINAL-2TEAM.git
cd SKN15-FINAL-2TEAM
```

#### 3.2 환경 변수 설정
```bash
nano .env
```

```env
# Django Settings
SECRET_KEY=your-django-secret-key-here
DEBUG=False
ALLOWED_HOSTS=api.triplan.com,<BACKEND-IP>

# Database (Instance #4)
POSTGRES_DB=triplan_db
POSTGRES_USER=triplan_user
POSTGRES_PASSWORD=STRONG_PASSWORD_HERE
POSTGRES_HOST=<DATABASE-PRIVATE-IP>
POSTGRES_PORT=5432

# Redis (Instance #7)
REDIS_HOST=<REDIS-PRIVATE-IP>
REDIS_PORT=6379
REDIS_PASSWORD=STRONG_REDIS_PASSWORD

# API Keys
OPENAI_API_KEY=sk-proj-xxxxx
KAKAO_REST_API_KEY=xxxxx
KMA_API_KEY=xxxxx

# CORS
CORS_ALLOWED_ORIGINS=https://triplan.com,https://www.triplan.com

# Channels
CHANNEL_LAYERS_HOST=<REDIS-PRIVATE-IP>
CHANNEL_LAYERS_PORT=6379
```

#### 3.3 Docker Compose 파일
```bash
nano docker-compose-backend.yml
```

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: triplan-backend
    env_file:
      - .env
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
      - static_volume:/app/staticfiles
      - media_volume:/app/media
    command: >
      sh -c "python manage.py migrate &&
             python manage.py collectstatic --noinput &&
             gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 4"
    restart: always

volumes:
  static_volume:
  media_volume:
```

#### 3.4 실행
```bash
docker-compose -f docker-compose-backend.yml build
docker-compose -f docker-compose-backend.yml up -d

# 슈퍼유저 생성
docker exec -it triplan-backend python manage.py createsuperuser

# 로그 확인
docker-compose -f docker-compose-backend.yml logs -f
```

---

### Instance #4: Database (PostgreSQL + pgvector)

#### 4.1 Docker Compose 파일
```bash
ssh -i "your-key.pem" ubuntu@<DATABASE-IP>

git clone https://github.com/YOUR-REPO/SKN15-FINAL-2TEAM.git
cd SKN15-FINAL-2TEAM

nano docker-compose-database.yml
```

```yaml
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg15
    container_name: triplan-postgres
    environment:
      POSTGRES_DB: triplan_db
      POSTGRES_USER: triplan_user
      POSTGRES_PASSWORD: STRONG_PASSWORD_HERE
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: always
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U triplan_user -d triplan_db"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

#### 4.2 실행
```bash
docker-compose -f docker-compose-database.yml up -d

# pgvector 확장 설치
docker exec -it triplan-postgres psql -U triplan_user -d triplan_db -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 로그 확인
docker-compose -f docker-compose-database.yml logs -f
```

---

### Instance #5: Airflow (Full Stack)

#### 5.1 프로젝트 클론
```bash
ssh -i "your-key.pem" ubuntu@<AIRFLOW-IP>

git clone https://github.com/YOUR-REPO/SKN15-FINAL-2TEAM.git
cd SKN15-FINAL-2TEAM
```

#### 5.2 환경 변수 설정
```bash
nano .env.airflow
```

```env
AIRFLOW__CORE__EXECUTOR=LocalExecutor
AIRFLOW__DATABASE__SQL_ALCHEMY_CONN=postgresql+psycopg2://airflow:airflow@localhost:5433/airflow
AIRFLOW__CORE__FERNET_KEY=YOUR_FERNET_KEY_HERE
AIRFLOW__WEBSERVER__SECRET_KEY=YOUR_SECRET_KEY_HERE
AIRFLOW__CORE__LOAD_EXAMPLES=false

# Backend DB 접속 정보 (DAG에서 사용)
BACKEND_DB_HOST=<DATABASE-PRIVATE-IP>
BACKEND_DB_PORT=5432
BACKEND_DB_NAME=triplan_db
BACKEND_DB_USER=triplan_user
BACKEND_DB_PASSWORD=STRONG_PASSWORD_HERE

# KMA API
KMA_API_KEY=xxxxx
```

#### 5.3 Docker Compose 파일
```bash
nano docker-compose-airflow.yml
```

```yaml
version: '3.8'

services:
  # Airflow 전용 PostgreSQL
  airflow-postgres:
    image: postgres:15
    container_name: airflow-postgres
    environment:
      POSTGRES_DB: airflow
      POSTGRES_USER: airflow
      POSTGRES_PASSWORD: airflow
    ports:
      - "5433:5432"
    volumes:
      - airflow_postgres_data:/var/lib/postgresql/data
    restart: always

  # Airflow Webserver
  airflow-webserver:
    image: apache/airflow:2.7.0
    container_name: airflow-webserver
    depends_on:
      - airflow-postgres
    env_file:
      - .env.airflow
    volumes:
      - ./airflow/dags:/opt/airflow/dags
      - ./airflow/logs:/opt/airflow/logs
      - ./airflow/plugins:/opt/airflow/plugins
    ports:
      - "8080:8080"
    command: webserver
    restart: always

  # Airflow Scheduler
  airflow-scheduler:
    image: apache/airflow:2.7.0
    container_name: airflow-scheduler
    depends_on:
      - airflow-postgres
      - airflow-webserver
    env_file:
      - .env.airflow
    volumes:
      - ./airflow/dags:/opt/airflow/dags
      - ./airflow/logs:/opt/airflow/logs
      - ./airflow/plugins:/opt/airflow/plugins
    command: scheduler
    restart: always

volumes:
  airflow_postgres_data:
```

#### 5.4 Airflow 초기화 및 실행
```bash
# Fernet Key 생성
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# 생성된 키를 .env.airflow에 추가

# Airflow DB 초기화 (최초 1회)
docker run --rm \
  -e AIRFLOW__DATABASE__SQL_ALCHEMY_CONN=postgresql+psycopg2://airflow:airflow@<AIRFLOW-IP>:5433/airflow \
  apache/airflow:2.7.0 \
  airflow db init

# Admin 사용자 생성
docker run --rm \
  -e AIRFLOW__DATABASE__SQL_ALCHEMY_CONN=postgresql+psycopg2://airflow:airflow@<AIRFLOW-IP>:5433/airflow \
  apache/airflow:2.7.0 \
  airflow users create \
    --username admin \
    --password admin \
    --firstname Admin \
    --lastname User \
    --role Admin \
    --email admin@triplan.com

# 실행
docker-compose -f docker-compose-airflow.yml up -d

# 로그 확인
docker-compose -f docker-compose-airflow.yml logs -f
```

---

### Instance #6: WebSocket (Django Channels)

#### 6.1 프로젝트 클론
```bash
ssh -i "your-key.pem" ubuntu@<WEBSOCKET-IP>

git clone https://github.com/YOUR-REPO/SKN15-FINAL-2TEAM.git
cd SKN15-FINAL-2TEAM
```

#### 6.2 환경 변수 설정
```bash
nano .env
```

```env
# Django Settings (Backend와 동일)
SECRET_KEY=your-django-secret-key-here
DEBUG=False
ALLOWED_HOSTS=ws.triplan.com,<WEBSOCKET-IP>

# Database (Instance #4)
POSTGRES_HOST=<DATABASE-PRIVATE-IP>
POSTGRES_PORT=5432
POSTGRES_DB=triplan_db
POSTGRES_USER=triplan_user
POSTGRES_PASSWORD=STRONG_PASSWORD_HERE

# Redis (Instance #7)
REDIS_HOST=<REDIS-PRIVATE-IP>
REDIS_PORT=6379
REDIS_PASSWORD=STRONG_REDIS_PASSWORD

# API Keys (Agent 사용)
OPENAI_API_KEY=sk-proj-xxxxx
KAKAO_REST_API_KEY=xxxxx

# CORS
CORS_ALLOWED_ORIGINS=https://triplan.com,https://www.triplan.com
```

#### 6.3 Docker Compose 파일
```bash
nano docker-compose-websocket.yml
```

```yaml
version: '3.8'

services:
  websocket:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: triplan-websocket
    env_file:
      - .env
    ports:
      - "8001:8001"
    volumes:
      - ./backend:/app
    command: >
      sh -c "daphne -b 0.0.0.0 -p 8001 config.asgi:application"
    restart: always
```

#### 6.4 실행
```bash
docker-compose -f docker-compose-websocket.yml build
docker-compose -f docker-compose-websocket.yml up -d

# 로그 확인
docker-compose -f docker-compose-websocket.yml logs -f
```

---

### Instance #7: Redis (캐시 및 Channels)

#### 7.1 Docker Compose 파일
```bash
ssh -i "your-key.pem" ubuntu@<REDIS-IP>

mkdir triplan-redis
cd triplan-redis

nano docker-compose.yml
```

```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    container_name: triplan-redis
    command: redis-server --requirepass STRONG_REDIS_PASSWORD
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: always
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  redis_data:
```

#### 7.2 실행
```bash
docker-compose up -d

# 연결 테스트
docker exec -it triplan-redis redis-cli -a STRONG_REDIS_PASSWORD ping
# 응답: PONG

# 로그 확인
docker-compose logs -f
```

---

## 환경 변수 설정

### Django SECRET_KEY 생성
```bash
python3 -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'
```

### Airflow FERNET_KEY 생성
```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

---

## 배포 후 검증

### 1. 각 인스턴스 접속 확인

```bash
# Nginx
curl http://<NGINX-PUBLIC-IP>

# Frontend
curl http://<FRONTEND-PRIVATE-IP>:3000

# Backend
curl http://<BACKEND-PRIVATE-IP>:8000/api/health/

# Database
docker exec -it triplan-postgres psql -U triplan_user -d triplan_db -c "SELECT version();"

# Airflow
curl http://<AIRFLOW-PRIVATE-IP>:8080

# WebSocket (wscat 필요)
npm install -g wscat
wscat -c ws://<WEBSOCKET-PRIVATE-IP>:8001/ws/chat/test/

# Redis
docker exec -it triplan-redis redis-cli -a STRONG_PASSWORD ping
```

### 2. 도메인 접속 확인

```bash
# Frontend
curl https://triplan.com

# Backend API
curl https://api.triplan.com/api/plans/trips/

# WebSocket
wscat -c wss://ws.triplan.com/ws/chat/test/

# Airflow
curl https://airflow.triplan.com
```

### 3. 기능 테스트

#### 회원가입
```bash
curl -X POST https://api.triplan.com/api/accounts/signup/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpass123",
    "username": "testuser"
  }'
```

#### 로그인
```bash
curl -X POST https://api.triplan.com/api/accounts/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpass123"
  }'
```

#### AI 챗봇 테스트
브라우저에서 https://triplan.com 접속 → 플래너 페이지 → "강릉 1박2일 일정 짜줘"

---

## 트러블슈팅

### 1. Nginx 502 Bad Gateway

**원인**: Backend/Frontend/WebSocket이 실행되지 않음

**해결**:
```bash
# 각 인스턴스에서 컨테이너 상태 확인
docker ps

# 실행 중이 아니면 재시작
docker-compose up -d

# 로그 확인
docker-compose logs -f
```

### 2. Database Connection Error

**원인**: Security Group에서 포트가 막혀있음

**해결**:
- AWS Console → EC2 → Security Groups
- SG-Database에 SG-Backend, SG-WebSocket 추가
- Port 5432 Inbound 규칙 확인

### 3. WebSocket 연결 실패

**원인**:
- Nginx WebSocket 프록시 설정 오류
- Redis 연결 실패

**해결**:
```bash
# Nginx 설정 확인
sudo nginx -t

# Redis 연결 확인
docker exec -it triplan-redis redis-cli -a PASSWORD ping

# WebSocket 로그 확인
docker logs triplan-websocket
```

### 4. SSL 인증서 오류

**원인**: Let's Encrypt 인증서 발급 실패

**해결**:
```bash
# DNS 레코드 확인
nslookup triplan.com

# 수동 인증서 재발급
sudo certbot --nginx -d triplan.com -d www.triplan.com --force-renew
```

### 5. Airflow DAG가 보이지 않음

**원인**: DAG 파일 경로 또는 문법 오류

**해결**:
```bash
# DAG 파일 확인
ls -la airflow/dags/

# DAG 문법 검증
docker exec -it airflow-scheduler python /opt/airflow/dags/d_fetch_kma_daily.py

# Scheduler 재시작
docker restart airflow-scheduler

# 로그 확인
docker logs airflow-scheduler
```

---

## 모니터링

### CloudWatch 설정 (선택사항)

```bash
# CloudWatch Agent 설치
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i -E ./amazon-cloudwatch-agent.deb

# 설정 파일 생성
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-config-wizard

# 에이전트 시작
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config \
  -m ec2 \
  -s \
  -c file:/opt/aws/amazon-cloudwatch-agent/bin/config.json
```

### 로그 수집

```bash
# 각 인스턴스에서 로그 확인
docker-compose logs --tail=100 -f

# 로그 파일로 저장
docker-compose logs > /var/log/triplan/app.log
```

---

## 백업 전략

### Database 백업 (Instance #4)

```bash
# 백업 스크립트 생성
nano /home/ubuntu/backup-db.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/home/ubuntu/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/triplan_db_$TIMESTAMP.sql"

mkdir -p $BACKUP_DIR

# PostgreSQL 백업
docker exec triplan-postgres pg_dump -U triplan_user triplan_db > $BACKUP_FILE

# 압축
gzip $BACKUP_FILE

# 7일 이상 된 백업 삭제
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: ${BACKUP_FILE}.gz"
```

```bash
chmod +x /home/ubuntu/backup-db.sh

# Cron 등록 (매일 새벽 3시)
crontab -e
# 추가: 0 3 * * * /home/ubuntu/backup-db.sh
```

---

**마지막 업데이트**: 2025-01-19
**문서 버전**: 2.0.0
