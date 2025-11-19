# 🚀 Triplan 프로젝트 배포 가이드

## 📋 목차
1. [Git에 올리면 안 되는 파일](#git에-올리면-안-되는-파일)
2. [필수 파일 가져가기](#필수-파일-가져가기)
3. [새 서버 배포 절차](#새-서버-배포-절차)
4. [트러블슈팅](#트러블슈팅)

---

## ⚠️ Git에 올리면 안 되는 파일

### 1. 환경 변수 파일 (`.env`)
- **크기**: 1KB
- **이유**: API 키, 비밀번호 등 보안 정보 포함
- **Git 상태**: ✅ 이미 `.gitignore`에 포함됨

**포함된 민감 정보**:
```bash
OPENAI_API_KEY=sk-proj-...        # ⚠️ 절대 유출 금지!
KAKAO_API_KEY=ff0e0bf...           # ⚠️ 절대 유출 금지!
POSTGRES_PASSWORD=lecun123         # ⚠️ 운영 환경에서는 변경 필수
SECRET_KEY=django-insecure-...     # ⚠️ 운영 환경에서는 변경 필수
```

### 2. STT AI 모델 파일 (`backend/models/stt/model.safetensors`)
- **크기**: 923MB
- **이유**: 파일 크기가 너무 커서 Git에 올릴 수 없음
- **Git 상태**: ✅ 이미 `.gitignore`에 포함됨

### 3. 기타 제외 파일
- `node_modules/` (500MB+) - npm install로 재생성 가능
- `__pycache__/` - Python이 자동 생성
- `data/` - 데이터베이스 데이터 (Docker volume)
- `.next/` - Next.js 빌드 파일

---

## 📦 필수 파일 가져가기

### 체크리스트 스크립트 실행
```bash
./check-required-files.sh
```

이 스크립트가 자동으로 체크해줍니다:
- ✅ .env 파일 존재 여부
- ✅ API 키 설정 여부
- ✅ STT 모델 파일 존재 여부
- ✅ Git에 민감한 파일이 추가되지 않았는지

### 방법 1: SCP로 파일 전송 (직접 전송)

```bash
# 새 서버 정보
NEW_SERVER="user@새서버IP"
PROJECT_PATH="/home/playdata/SKN15-FINAL-2TEAM"

# 1. .env 파일 전송
scp .env $NEW_SERVER:$PROJECT_PATH/

# 2. STT 모델 전송 (923MB - 시간 오래 걸림)
scp backend/models/stt/model.safetensors $NEW_SERVER:$PROJECT_PATH/backend/models/stt/

# 진행 상태 보려면 rsync 사용
rsync -avz --progress backend/models/stt/model.safetensors $NEW_SERVER:$PROJECT_PATH/backend/models/stt/
```

### 방법 2: 클라우드 스토리지 이용 (추천)

#### Google Drive 사용
1. 로컬에서 파일 압축
   ```bash
   # .env와 model.safetensors를 압축 (암호화 권장)
   zip -e triplan-secrets.zip .env backend/models/stt/model.safetensors
   # 비밀번호 입력
   ```

2. Google Drive에 업로드

3. 새 서버에서 다운로드
   ```bash
   # gdown 설치
   pip install gdown

   # 다운로드 (공유 링크 ID 필요)
   gdown --id YOUR_FILE_ID

   # 압축 해제
   unzip triplan-secrets.zip
   ```

#### AWS S3 사용 (프로덕션 환경)
```bash
# 업로드 (로컬)
aws s3 cp .env s3://triplan-secrets/ --sse AES256
aws s3 cp backend/models/stt/model.safetensors s3://triplan-models/stt/

# 다운로드 (새 서버)
aws s3 cp s3://triplan-secrets/.env .
aws s3 cp s3://triplan-models/stt/model.safetensors backend/models/stt/
```

### 방법 3: USB 또는 외장 하드 (오프라인)
```bash
# USB에 복사
cp .env /media/usb/triplan/
cp backend/models/stt/model.safetensors /media/usb/triplan/

# 새 서버에서 복사
cp /media/usb/triplan/.env .
cp /media/usb/triplan/model.safetensors backend/models/stt/
```

---

## 🆕 새 서버 배포 절차

### Step 1: 사전 준비 (새 서버)

```bash
# Docker 설치 확인
docker --version
docker-compose --version

# 없으면 설치
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 로그아웃 후 재로그인
```

### Step 2: Git Clone

```bash
cd /home/playdata
git clone https://github.com/your-username/SKN15-FINAL-2TEAM.git
cd SKN15-FINAL-2TEAM
```

### Step 3: 환경 변수 설정

```bash
# 템플릿 복사
cp .env.template .env

# 실제 값으로 변경
nano .env
```

**필수 변경 항목**:
```bash
# Django Secret Key 생성
python3 -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
# 결과를 SECRET_KEY에 복사

# Airflow Fernet Key 생성
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# 결과를 AIRFLOW_FERNET_KEY에 복사

# 나머지는 이전 서버에서 가져온 .env 참고
OPENAI_API_KEY=sk-proj-...
KAKAO_API_KEY=ff0e0bf...
POSTGRES_PASSWORD=강력한비밀번호
```

### Step 4: STT 모델 파일 전송

```bash
# 로컬에서 실행 (또는 위의 방법 2, 3 사용)
scp backend/models/stt/model.safetensors user@새서버:/home/playdata/SKN15-FINAL-2TEAM/backend/models/stt/
```

### Step 5: 필수 디렉토리 생성

```bash
mkdir -p backend/models/stt
mkdir -p data
mkdir -p exports
mkdir -p media
mkdir -p staticfiles
mkdir -p airflow/logs
```

### Step 6: Docker 컨테이너 실행

```bash
# 빌드 및 실행
docker-compose up -d --build

# 로그 확인
docker-compose logs -f
```

### Step 7: 데이터베이스 초기화

```bash
# 마이그레이션 실행
docker exec triplan-backend python manage.py migrate

# 슈퍼유저 생성 (관리자 계정)
docker exec -it triplan-backend python manage.py createsuperuser

# 정적 파일 수집
docker exec triplan-backend python manage.py collectstatic --noinput
```

### Step 8: 데이터베이스 복원 (선택사항)

**기존 데이터를 유지하고 싶을 때만 실행**:

```bash
# 로컬에서 백업 생성
docker exec triplan-postgres pg_dump -U postgres lecun2 > triplan_backup.sql

# 새 서버로 전송
scp triplan_backup.sql user@새서버:/home/playdata/SKN15-FINAL-2TEAM/

# 새 서버에서 복원
cat triplan_backup.sql | docker exec -i triplan-postgres psql -U postgres lecun2
```

### Step 9: 서비스 확인

```bash
# 컨테이너 상태 확인
docker-compose ps

# 모든 컨테이너가 "Up" 상태여야 함:
# - nginx (80, 443)
# - frontend (3000)
# - backend (8000)
# - websocket (8001)
# - postgres (5432)
# - redis (6379)
# - airflow-webserver (8080)

# 웹 접속 확인
curl http://localhost
curl http://localhost/api/health/
curl http://localhost/api/admin/

# 브라우저에서 확인
# http://서버IP/
```

### Step 10: 최종 체크

```bash
# 필수 파일 체크 스크립트 실행
./check-required-files.sh

# 로그 확인
docker-compose logs backend | tail -50
docker-compose logs websocket | tail -50

# 기능 테스트
# 1. 웹사이트 접속
# 2. 로그인 테스트
# 3. 채팅 WebSocket 연결 테스트
# 4. STT 음성 입력 테스트
# 5. RAG 추천 기능 테스트
```

---

## 🔥 트러블슈팅

### 문제 1: .env 파일이 없다는 에러

```
ERROR: Couldn't find env file
```

**해결**:
```bash
cp .env.template .env
nano .env  # 실제 값 입력
```

### 문제 2: STT 모델 파일이 없어서 에러

```
FileNotFoundError: backend/models/stt/model.safetensors
```

**해결**:
```bash
# 1. 파일 존재 확인
ls -lh backend/models/stt/model.safetensors

# 2. 없으면 전송
scp 이전서버:경로/model.safetensors backend/models/stt/

# 3. 권한 확인
chmod 644 backend/models/stt/model.safetensors
```

### 문제 3: OpenAI API 에러

```
openai.error.AuthenticationError: Invalid API key
```

**해결**:
```bash
# .env 파일에서 API 키 확인
grep OPENAI_API_KEY .env

# API 키가 올바른지 확인 (https://platform.openai.com/api-keys)
# 컨테이너 재시작
docker-compose restart backend websocket
```

### 문제 4: WebSocket 연결 실패

```
WebSocket connection failed
```

**해결**:
```bash
# 1. SECRET_KEY가 backend와 websocket 컨테이너에서 동일한지 확인
docker exec triplan-backend env | grep SECRET_KEY
docker exec triplan-websocket env | grep SECRET_KEY

# 2. 다르면 docker-compose.yml 수정 후 재시작
docker-compose down
docker-compose up -d

# 3. 로그 확인
docker-compose logs websocket
```

### 문제 5: 데이터베이스 연결 실패

```
django.db.utils.OperationalError: could not connect to server
```

**해결**:
```bash
# 1. PostgreSQL 컨테이너 상태 확인
docker-compose ps postgres

# 2. 재시작
docker-compose restart postgres

# 3. 연결 테스트
docker exec triplan-backend python manage.py dbshell
```

### 문제 6: Git에 .env 파일이 추가되어 있음

```
warning: adding embedded git repository: .env
```

**해결** (⚠️ 주의: 커밋 히스토리에서 완전히 제거):
```bash
# Git 캐시에서 제거
git rm --cached .env

# 커밋
git commit -m "Remove .env from git"

# 이미 푸시했다면, 히스토리에서 완전히 제거 필요
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# 강제 푸시 (⚠️ 팀원들과 협의 필요)
git push origin --force --all
```

---

## 📊 배포 체크리스트

### 배포 전 (로컬)
- [ ] Git 저장소가 최신 상태
- [ ] `.env` 파일 백업
- [ ] `model.safetensors` 파일 확인 (923MB)
- [ ] 데이터베이스 백업 (필요 시)
- [ ] `./check-required-files.sh` 실행
- [ ] Git에 민감한 파일이 올라가지 않았는지 확인

### 배포 중 (새 서버)
- [ ] Docker, Docker Compose 설치
- [ ] Git clone 완료
- [ ] `.env` 파일 생성 및 설정
- [ ] `model.safetensors` 파일 전송
- [ ] 필수 디렉토리 생성
- [ ] 포트 열기 (80, 443, 8000, 8001, 5432, 6379)
- [ ] 방화벽 설정

### 배포 후
- [ ] 모든 컨테이너가 "Up" 상태
- [ ] 웹사이트 접속 가능
- [ ] 로그인 작동
- [ ] WebSocket 연결 정상 (채팅)
- [ ] STT 기능 작동 (음성 입력)
- [ ] RAG 추천 기능 작동
- [ ] 데이터베이스 데이터 확인
- [ ] Airflow 대시보드 접속 (http://서버IP:8080)

---

## 🔗 관련 문서

- [DEPLOYMENT_FILES_CHECKLIST.md](DEPLOYMENT_FILES_CHECKLIST.md) - 상세 파일 체크리스트
- [.env.template](.env.template) - 환경 변수 템플릿
- [check-required-files.sh](check-required-files.sh) - 필수 파일 체크 스크립트

---

**작성일**: 2025-01-13
**버전**: 1.0
**관리**: DevOps Team
