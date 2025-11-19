# 🚀 최종 배포 단계

## 📦 준비물

로컬에 있는 파일들:
1. ✅ `deploy-auto.sh` - 수정 완료 (Git에 포함)
2. ✅ `.env` - 실제 IP 설정 완료 (Git에 **포함 안 됨**)

---

## 1️⃣ Git Push (로컬에서)

```bash
# 로컬에서
git push origin main
```

이제 `deploy-auto.sh`가 GitHub에 업데이트됩니다.

---

## 2️⃣ 각 EC2 인스턴스 배포

### 🔥 중요: 배포 순서

각 EC2 인스턴스에 **순서대로** 다음 작업을 수행하세요:

---

### 인스턴스 1: Nginx (13.124.176.115)

```bash
# 1. SSH 접속
ssh -i your-key.pem ubuntu@13.124.176.115

# 2. 프로젝트 디렉토리로 이동 (없으면 클론)
cd ~/triplan || git clone https://github.com/YOUR_ORG/SKN15-FINAL-2TEAM.git ~/triplan && cd ~/triplan

# 3. 최신 코드 가져오기
git pull origin main

# 4. .env 파일 복사 (로컬에서 먼저 전송)
# 로컬에서: scp -i your-key.pem .env ubuntu@13.124.176.115:~/triplan/

# 5. 배포 스크립트 실행
chmod +x deploy-auto.sh
./deploy-auto.sh
# 메뉴에서 '1' 입력 (Nginx)
```

---

### 인스턴스 2: Frontend (3.35.52.202)

```bash
# 1. SSH 접속
ssh -i your-key.pem ubuntu@3.35.52.202

# 2. 프로젝트 준비
cd ~/triplan || git clone https://github.com/YOUR_ORG/SKN15-FINAL-2TEAM.git ~/triplan && cd ~/triplan
git pull origin main

# 3. .env 파일 복사 (로컬에서)
# 로컬에서: scp -i your-key.pem .env ubuntu@3.35.52.202:~/triplan/

# 4. 배포
./deploy-auto.sh
# '2' 입력 (Frontend)
```

---

### 인스턴스 3: Backend (3.36.66.52)

```bash
# 1. SSH 접속
ssh -i your-key.pem ubuntu@3.36.66.52

# 2. 프로젝트 준비
cd ~/triplan || git clone https://github.com/YOUR_ORG/SKN15-FINAL-2TEAM.git ~/triplan && cd ~/triplan
git pull origin main

# 3. .env 파일 복사 (로컬에서)
# 로컬에서: scp -i your-key.pem .env ubuntu@3.36.66.52:~/triplan/

# 4. 배포
./deploy-auto.sh
# '3' 입력 (Backend)
```

---

### 인스턴스 4: WebSocket (43.200.169.128)

```bash
# 1. SSH 접속
ssh -i your-key.pem ubuntu@43.200.169.128

# 2. 프로젝트 준비
cd ~/triplan || git clone https://github.com/YOUR_ORG/SKN15-FINAL-2TEAM.git ~/triplan && cd ~/triplan
git pull origin main

# 3. .env 파일 복사 (로컬에서)
# 로컬에서: scp -i your-key.pem .env ubuntu@43.200.169.128:~/triplan/

# 4. 배포
./deploy-auto.sh
# '4' 입력 (WebSocket)
```

---

### 인스턴스 5: Redis (13.209.77.146)

```bash
# 1. SSH 접속
ssh -i your-key.pem ubuntu@13.209.77.146

# 2. 프로젝트 준비
cd ~/triplan || git clone https://github.com/YOUR_ORG/SKN15-FINAL-2TEAM.git ~/triplan && cd ~/triplan
git pull origin main

# 3. .env 파일 불필요 (Redis는 설정 필요 없음)

# 4. 배포
./deploy-auto.sh
# '5' 입력 (Redis)
```

---

### 인스턴스 6: PostgreSQL (43.200.163.23) ⭐ 가장 먼저!

```bash
# 1. SSH 접속
ssh -i your-key.pem ubuntu@43.200.163.23

# 2. 프로젝트 준비
cd ~/triplan || git clone https://github.com/YOUR_ORG/SKN15-FINAL-2TEAM.git ~/triplan && cd ~/triplan
git pull origin main

# 3. .env 파일 복사 (로컬에서)
# 로컬에서: scp -i your-key.pem .env ubuntu@43.200.163.23:~/triplan/

# 4. SQL 파일들 확인
ls -la database/*.sql
ls -la insert_base_data.sql

# 5. 배포
./deploy-auto.sh
# '6' 입력 (PostgreSQL)

# 6. 데이터 로드
sudo docker exec -i triplan-postgres psql -U postgres -d lecun2 < insert_base_data.sql
sudo docker exec -i triplan-postgres psql -U postgres -d lecun2 < database/places_202510211121.sql

# 7. 데이터 확인
sudo docker exec -it triplan-postgres psql -U postgres -d lecun2 -c "SELECT COUNT(*) FROM places_place;"
```

---

### 인스턴스 7: Airflow (15.164.169.107)

```bash
# 1. SSH 접속
ssh -i your-key.pem ubuntu@15.164.169.107

# 2. 프로젝트 준비
cd ~/triplan || git clone https://github.com/YOUR_ORG/SKN15-FINAL-2TEAM.git ~/triplan && cd ~/triplan
git pull origin main

# 3. .env 파일 복사 (로컬에서)
# 로컬에서: scp -i your-key.pem .env ubuntu@15.164.169.107:~/triplan/

# 4. 배포
./deploy-auto.sh
# '7' 입력 (Airflow)
```

---

## 📋 배포 순서 (중요!)

1. **PostgreSQL (6번)** - 가장 먼저! (데이터베이스)
2. **Redis (5번)** - 두 번째 (캐시)
3. **Backend (3번)** - 세 번째 (API)
4. **WebSocket (4번)** - 네 번째 (실시간 통신)
5. **Frontend (2번)** - 다섯 번째 (UI)
6. **Nginx (1번)** - 여섯 번째 (프록시)
7. **Airflow (7번)** - 마지막 (선택)

---

## 🔄 .env 파일 한 번에 전송 (로컬에서)

```bash
# 로컬에서 모든 EC2로 .env 전송
scp -i your-key.pem .env ubuntu@13.124.176.115:~/triplan/
scp -i your-key.pem .env ubuntu@3.35.52.202:~/triplan/
scp -i your-key.pem .env ubuntu@3.36.66.52:~/triplan/
scp -i your-key.pem .env ubuntu@43.200.169.128:~/triplan/
# Redis는 생략 가능
scp -i your-key.pem .env ubuntu@43.200.163.23:~/triplan/
scp -i your-key.pem .env ubuntu@15.164.169.107:~/triplan/
```

---

## ✅ 배포 후 확인

### 1. PostgreSQL
```bash
sudo docker exec -it triplan-postgres psql -U postgres -d lecun2 -c "SELECT COUNT(*) FROM places_place;"
# 결과: 100000개 이상 확인
```

### 2. Redis
```bash
sudo docker exec triplan-redis redis-cli ping
# 결과: PONG
```

### 3. Backend
```bash
curl http://localhost:8000/api/health/
# 결과: {"status": "ok"}
```

### 4. Frontend
```bash
curl http://localhost:3000
# 결과: HTML 응답
```

### 5. Nginx
```bash
curl http://13.124.176.115
# 결과: Frontend HTML
```

### 6. 전체 접속
- **웹사이트**: http://13.124.176.115
- **Admin**: http://13.124.176.115/admin/
- **Airflow**: http://15.164.169.107:8080

---

## 🆘 문제 발생 시

```bash
# 로그 확인
sudo docker logs triplan-<service>

# 컨테이너 상태 확인
sudo docker ps -a

# 재시작
sudo docker restart triplan-<service>

# 완전 재배포
sudo docker-compose -f docker-compose.<service>.yml down -v
./deploy-auto.sh
```

---

**작성일**: 2025-01-19
