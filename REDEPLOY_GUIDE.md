# 🔄 기존 배포 정리 및 재배포 가이드

## 📋 각 인스턴스별 정리 방법

### 방법 1: 완전 삭제 후 재배포 (권장) 🔥

모든 컨테이너, 이미지, 볼륨을 삭제하고 깨끗하게 시작합니다.

#### 전체 인스턴스 공통 명령어:

```bash
# 1. 현재 실행 중인 컨테이너 확인
sudo docker ps -a

# 2. 모든 컨테이너 중지 및 삭제
sudo docker stop $(sudo docker ps -aq) 2>/dev/null
sudo docker rm $(sudo docker ps -aq) 2>/dev/null

# 3. 모든 이미지 삭제 (선택)
sudo docker rmi $(sudo docker images -q) 2>/dev/null

# 4. 사용하지 않는 볼륨 삭제 (선택)
sudo docker volume prune -f

# 5. 네트워크 정리 (선택)
sudo docker network prune -f

# 6. 전체 시스템 정리 (강력)
sudo docker system prune -a -f --volumes
```

#### 각 인스턴스별 빠른 정리:

**Nginx (1번)**
```bash
cd ~/SKN15-FINAL-2TEAM
sudo docker-compose -f docker-compose.nginx.yml down -v
sudo docker system prune -f
```

**Frontend (2번)**
```bash
cd ~/SKN15-FINAL-2TEAM
sudo docker-compose -f docker-compose.frontend.yml down -v
sudo docker system prune -f
rm -rf frontend/.next  # Next.js 빌드 캐시 삭제
```

**Backend (3번)**
```bash
cd ~/SKN15-FINAL-2TEAM
sudo docker-compose -f docker-compose.backend.yml down -v
sudo docker system prune -f
```

**WebSocket (4번)**
```bash
cd ~/SKN15-FINAL-2TEAM
sudo docker-compose -f docker-compose.websocket.yml down -v
sudo docker system prune -f
```

**Redis (5번)**
```bash
cd ~/SKN15-FINAL-2TEAM
sudo docker-compose -f docker-compose.redis.yml down -v
sudo docker system prune -f
```

**PostgreSQL (6번)** ⚠️ 주의!
```bash
cd ~/SKN15-FINAL-2TEAM

# 데이터 보존 (볼륨 유지)
sudo docker-compose -f docker-compose.postgres.yml down

# 또는 데이터까지 완전 삭제 (재생성)
sudo docker-compose -f docker-compose.postgres.yml down -v
sudo docker system prune -f

# ⚠️ 데이터 백업 (완전 삭제 전 권장)
sudo docker exec triplan-postgres pg_dump -U postgres lecun2 > ~/backup_$(date +%Y%m%d).sql
```

**Airflow (7번)**
```bash
cd ~/SKN15-FINAL-2TEAM
sudo docker-compose -f docker-compose.airflow.yml down -v
sudo docker system prune -f
rm -rf airflow/logs/*  # 로그 삭제
```

---

### 방법 2: 데이터 보존 후 재배포 (안전) 💾

컨테이너만 재생성하고 데이터는 유지합니다.

#### PostgreSQL (데이터 보존)
```bash
# 1. 컨테이너만 중지 및 삭제 (볼륨 유지)
sudo docker-compose -f docker-compose.postgres.yml down

# 2. 재배포
./deploy-auto.sh
# 메뉴에서 6 선택

# 데이터가 그대로 유지됨 ✅
```

#### Redis (데이터 보존)
```bash
# 1. 컨테이너만 중지 및 삭제
sudo docker-compose -f docker-compose.redis.yml down

# 2. 재배포
./deploy-auto.sh
# 메뉴에서 5 선택
```

#### 기타 서비스 (Frontend, Backend, WebSocket)
```bash
# 데이터가 중요하지 않으므로 완전 삭제 후 재배포
sudo docker-compose -f docker-compose.<service>.yml down -v
./deploy-auto.sh
```

---

### 방법 3: 컨테이너만 재시작 (빠름) ⚡

코드 변경 없이 단순 재시작만 필요한 경우:

```bash
# 특정 서비스 재시작
sudo docker-compose -f docker-compose.<service>.yml restart

# 또는
sudo docker restart <container-name>

# 예:
sudo docker restart triplan-nginx
sudo docker restart triplan-backend
```

---

## 🎯 재배포 시나리오별 가이드

### 시나리오 1: 새로운 코드 배포 (Git Pull)

```bash
# 1. 코드 업데이트
cd ~/SKN15-FINAL-2TEAM
git pull origin main

# 2. .env 파일 확인/업데이트
nano .env

# 3. 기존 컨테이너 삭제 후 재배포
sudo docker-compose -f docker-compose.<service>.yml down
./deploy-auto.sh

# 4. 또는 재빌드만
sudo docker-compose -f docker-compose.<service>.yml up -d --build
```

### 시나리오 2: .env 파일만 변경

```bash
# 1. .env 파일 수정
nano .env

# 2. 컨테이너 재시작 (재빌드 불필요)
sudo docker-compose -f docker-compose.<service>.yml restart

# 또는 down 후 up
sudo docker-compose -f docker-compose.<service>.yml down
sudo docker-compose -f docker-compose.<service>.yml up -d
```

### 시나리오 3: 완전히 새로 시작 (초기화)

```bash
# 1. 모든 Docker 리소스 삭제
sudo docker stop $(sudo docker ps -aq)
sudo docker rm $(sudo docker ps -aq)
sudo docker system prune -a -f --volumes

# 2. 프로젝트 디렉토리 삭제 (선택)
rm -rf ~/SKN15-FINAL-2TEAM

# 3. Git 클론
git clone https://github.com/YOUR_ORG/SKN15-FINAL-2TEAM.git
cd SKN15-FINAL-2TEAM

# 4. .env 파일 복사
scp -i key.pem .env ubuntu@<EC2-IP>:~/SKN15-FINAL-2TEAM/

# 5. 배포
./deploy-auto.sh
```

### 시나리오 4: PostgreSQL 데이터 완전 초기화

```bash
# 1. 백업 (중요!)
sudo docker exec triplan-postgres pg_dump -U postgres lecun2 > ~/backup.sql

# 2. 컨테이너 및 볼륨 삭제
sudo docker-compose -f docker-compose.postgres.yml down -v

# 3. 재배포
./deploy-auto.sh
# 메뉴에서 6 선택

# 4. 데이터 재로드
sudo docker exec -i triplan-postgres psql -U postgres -d lecun2 < ~/backup.sql

# 또는 초기 데이터 로드
sudo docker exec -i triplan-postgres psql -U postgres -d lecun2 < insert_base_data.sql
sudo docker exec -i triplan-postgres psql -U postgres -d lecun2 < database/places_202510211121.sql
```

---

## 📊 인스턴스별 재배포 우선순위

### 데이터 보존 필수 (조심히!)
1. **PostgreSQL (6번)** ⚠️⚠️⚠️
   - Places 데이터 10만개
   - 사용자 데이터
   - **반드시 백업 후 작업!**

### 데이터 보존 권장
2. **Redis (5번)** ⚠️
   - 캐시 데이터 (재생성 가능)
   - WebSocket 세션

### 데이터 보존 불필요 (안전하게 삭제 가능)
3. **Backend (3번)** ✅
4. **WebSocket (4번)** ✅
5. **Frontend (2번)** ✅
6. **Nginx (1번)** ✅
7. **Airflow (7번)** ✅

---

## 🔍 문제 해결

### 문제 1: 컨테이너가 삭제되지 않음
```bash
# 강제 삭제
sudo docker rm -f <container-id>

# 모든 컨테이너 강제 삭제
sudo docker rm -f $(sudo docker ps -aq)
```

### 문제 2: 볼륨이 삭제되지 않음
```bash
# 볼륨 확인
sudo docker volume ls

# 특정 볼륨 삭제
sudo docker volume rm <volume-name>

# 사용하지 않는 모든 볼륨 삭제
sudo docker volume prune -f
```

### 문제 3: 포트가 이미 사용 중
```bash
# 포트 사용 프로세스 확인
sudo lsof -i :8000  # Backend 포트 예시
sudo lsof -i :3000  # Frontend 포트 예시

# 프로세스 종료
sudo kill -9 <PID>
```

### 문제 4: 디스크 공간 부족
```bash
# Docker 디스크 사용량 확인
sudo docker system df

# 전체 정리 (모든 미사용 리소스 삭제)
sudo docker system prune -a -f --volumes

# 빌드 캐시 삭제
sudo docker builder prune -a -f
```

---

## ⚠️ 주의사항

### PostgreSQL 재배포 시
1. ✅ **반드시 백업 먼저!**
   ```bash
   sudo docker exec triplan-postgres pg_dump -U postgres lecun2 > ~/backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. ✅ **볼륨 삭제 전 확인**
   - `down -v` 옵션은 데이터를 완전히 삭제합니다!
   - Places 데이터 재로드에 시간 소요 (약 10분)

3. ✅ **pgvector 확장 재설치**
   ```bash
   sudo docker exec triplan-postgres psql -U postgres -d lecun2 -c "CREATE EXTENSION IF NOT EXISTS vector;"
   ```

### Backend & WebSocket 재배포 시
1. ✅ **SECRET_KEY 일치 확인**
   - Backend와 WebSocket의 `.env` 파일에서 `SECRET_KEY` 동일해야 함

2. ✅ **마이그레이션 확인**
   ```bash
   sudo docker exec triplan-backend python manage.py migrate
   ```

### Frontend 재배포 시
1. ✅ **빌드 캐시 삭제**
   ```bash
   rm -rf frontend/.next
   ```

2. ✅ **node_modules 재설치 (문제 발생 시)**
   ```bash
   rm -rf frontend/node_modules
   sudo docker-compose -f docker-compose.frontend.yml up -d --build
   ```

---

## 📋 재배포 체크리스트

배포 전:
- [ ] 중요 데이터 백업 (특히 PostgreSQL!)
- [ ] `.env` 파일 최신 버전으로 업데이트
- [ ] Git 최신 코드 pull 완료
- [ ] 디스크 공간 충분한지 확인

배포 중:
- [ ] 기존 컨테이너 정리 완료
- [ ] 새 컨테이너 정상 실행 확인
- [ ] 로그 확인 (`sudo docker logs <container>`)

배포 후:
- [ ] 헬스 체크 API 확인
- [ ] Frontend 접속 확인
- [ ] WebSocket 연결 테스트
- [ ] PostgreSQL 데이터 확인

---

## 🚀 권장 재배포 방법

### 일반적인 경우 (코드 업데이트)
```bash
cd ~/SKN15-FINAL-2TEAM
git pull origin main
sudo docker-compose -f docker-compose.<service>.yml down
sudo docker-compose -f docker-compose.<service>.yml up -d --build
```

### PostgreSQL만 재배포 (데이터 보존)
```bash
cd ~/SKN15-FINAL-2TEAM
sudo docker-compose -f docker-compose.postgres.yml down  # -v 없이!
./deploy-auto.sh
# 메뉴에서 6 선택
```

### 전체 재배포 (깔끔하게)
```bash
# 각 인스턴스에서 순서대로
sudo docker system prune -a -f --volumes  # 전체 삭제
./deploy-auto.sh  # 재배포
```

---

**작성일**: 2025-01-19
**버전**: 1.0
