# AWS 배포용 .env 파일 준비 가이드

## ⚠️ 중요: .env 파일 2개의 차이

### 1. `.env` (현재 파일) - 로컬 개발용
```bash
DATABASE_URL=postgresql://postgres:lecun123@postgres:5432/lecun2
REDIS_URL=redis://redis:6379/0
```
- Docker Compose 서비스명 사용 (`postgres`, `redis`)
- **AWS 배포에 사용 불가!**

### 2. `.env.aws.example` (템플릿) - AWS 배포용
```bash
DATABASE_URL=postgresql://postgres:password@172.31.X.X:5432/lecun2
REDIS_URL=redis://172.31.X.X:6379/0
NGINX_PUBLIC_IP=YOUR_NGINX_PUBLIC_IP
FRONTEND_PRIVATE_IP=172.31.X.X
```
- **실제 Private/Public IP 주소 사용**
- 이것을 복사해서 AWS에서 사용해야 함!

---

## 🎯 올바른 배포 절차

### 1단계: AWS용 .env 파일 생성 (로컬에서)

```bash
# .env.aws.example을 복사
cp .env.aws.example .env.aws

# 또는 바로 .env로 생성
cp .env.aws.example .env.production
```

### 2단계: 실제 IP와 API 키로 수정

```bash
nano .env.aws  # 또는 .env.production
```

**반드시 수정해야 할 항목:**

```bash
# AWS IP 주소
NGINX_PUBLIC_IP=43.203.203.121  # 실제 Nginx Public IP
FRONTEND_PRIVATE_IP=172.31.35.44  # 실제 Private IP
BACKEND_PRIVATE_IP=172.31.33.142
WEBSOCKET_PRIVATE_IP=172.31.44.41
REDIS_PRIVATE_IP=172.31.38.144
POSTGRES_PRIVATE_IP=172.31.40.253
AIRFLOW_PRIVATE_IP=172.31.47.234

# Database & Redis URL (Private IP로 변경)
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@172.31.40.253:5432/lecun2
REDIS_URL=redis://172.31.38.144:6379/0

# API Keys (실제 키로 변경)
OPENAI_API_KEY=sk-proj-YOUR-REAL-KEY-HERE
KAKAO_API_KEY=your-real-kakao-key
KAKAO_MAP_API_KEY=your-real-kakao-key

# Frontend URLs (Nginx Public IP)
NEXT_PUBLIC_API_URL=http://43.203.203.121
NEXT_PUBLIC_WS_URL=ws://43.203.203.121
NEXT_PUBLIC_KAKAO_API_KEY=your-real-kakao-key

# Nginx Proxy Hosts (Private IPs)
FRONTEND_HOST=172.31.35.44
BACKEND_HOST=172.31.33.142
WEBSOCKET_HOST=172.31.44.41

# Security
ALLOWED_HOSTS=43.203.203.121,localhost
CORS_ALLOWED_ORIGINS=http://43.203.203.121,http://localhost:3000

# Passwords
POSTGRES_PASSWORD=your-strong-password
SECRET_KEY=your-new-secret-key-50-chars-minimum
```

### 3단계: 각 EC2 인스턴스로 전송

```bash
# 방법 1: 직접 .env로 전송 (권장)
scp -i your-key.pem .env.aws ubuntu@<NGINX_PUBLIC_IP>:~/SKN15-FINAL-2TEAM/.env
scp -i your-key.pem .env.aws ubuntu@<BACKEND_PRIVATE_IP>:~/SKN15-FINAL-2TEAM/.env
scp -i your-key.pem .env.aws ubuntu@<WEBSOCKET_PRIVATE_IP>:~/SKN15-FINAL-2TEAM/.env
scp -i your-key.pem .env.aws ubuntu@<FRONTEND_PRIVATE_IP>:~/SKN15-FINAL-2TEAM/.env
scp -i your-key.pem .env.aws ubuntu@<POSTGRES_PRIVATE_IP>:~/SKN15-FINAL-2TEAM/.env
scp -i your-key.pem .env.aws ubuntu@<AIRFLOW_PRIVATE_IP>:~/SKN15-FINAL-2TEAM/.env

# 방법 2: 각 EC2에서 이름 변경
scp -i your-key.pem .env.aws ubuntu@<EC2_IP>:~/
# EC2에서: mv ~/env.aws ~/SKN15-FINAL-2TEAM/.env
```

### 4단계: 각 EC2에서 배포 스크립트 실행

```bash
cd ~/SKN15-FINAL-2TEAM
./deploy-auto.sh
# 해당 인스턴스 번호 선택 (1~7)
```

---

## 📋 각 인스턴스별 .env 파일 필요 여부

| 인스턴스 | .env 필요? | 주요 사용 항목 |
|----------|-----------|---------------|
| 1. Nginx | ✅ 필요 | FRONTEND_HOST, BACKEND_HOST, WEBSOCKET_HOST |
| 2. Frontend | ✅ 필요 | NEXT_PUBLIC_API_URL, NEXT_PUBLIC_WS_URL, KAKAO_API_KEY |
| 3. Backend | ✅ 필요 | DATABASE_URL, REDIS_URL, OPENAI_API_KEY, SECRET_KEY |
| 4. WebSocket | ✅ 필요 | DATABASE_URL, REDIS_URL, SECRET_KEY (Backend와 동일!) |
| 5. Redis | ❌ 선택 | (설정 필요 없음) |
| 6. PostgreSQL | ✅ 필요 | POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD |
| 7. Airflow | ✅ 필요 | DATABASE_URL, REDIS_URL, AIRFLOW_* 설정 |

---

## ⚠️ 주의사항

### 1. SECRET_KEY 통일
Backend와 WebSocket은 **반드시 동일한 SECRET_KEY** 사용!

```bash
# Backend .env
SECRET_KEY=your-same-secret-key

# WebSocket .env (동일!)
SECRET_KEY=your-same-secret-key
```

### 2. Private IP vs Public IP

- **Private IP (172.31.x.x)**: AWS 내부 통신
  - DATABASE_URL
  - REDIS_URL
  - FRONTEND_HOST, BACKEND_HOST, WEBSOCKET_HOST

- **Public IP**: 외부 접근
  - NGINX_PUBLIC_IP
  - NEXT_PUBLIC_API_URL
  - ALLOWED_HOSTS
  - CORS_ALLOWED_ORIGINS

### 3. 보안
- `.env.aws` 또는 수정한 `.env` 파일은 **Git에 커밋하지 마세요!**
- 로컬에만 보관하고 필요할 때만 SCP로 전송

---

## ✅ 체크리스트

배포 전 확인:
- [ ] `.env.aws.example`을 복사하여 `.env.aws` 생성
- [ ] 모든 IP 주소를 실제 AWS IP로 변경
- [ ] OPENAI_API_KEY, KAKAO_API_KEY를 실제 키로 변경
- [ ] POSTGRES_PASSWORD, SECRET_KEY를 강력한 값으로 변경
- [ ] Backend와 WebSocket의 SECRET_KEY가 동일한지 확인
- [ ] 각 EC2에 .env 파일 전송 완료
- [ ] deploy-auto.sh 실행 준비 완료

---

**작성일**: 2025-01-19
