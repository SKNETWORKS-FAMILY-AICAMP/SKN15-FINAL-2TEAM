# 🚀 배포 시 별도로 가져가야 할 필수 파일 체크리스트

## ⚠️ Git에 올리면 안 되는 파일 (보안/용량)

### 1. 환경 변수 파일 (.env)

**위치**: `/SKN15-FINAL-2TEAM/.env`

**크기**: 1KB

**포함 내용**:
- ✅ SECRET_KEY (Django)
- ✅ DATABASE_URL (PostgreSQL 비밀번호)
- ✅ OPENAI_API_KEY ⭐ (가장 중요!)
- ✅ KAKAO_API_KEY
- ✅ AIRFLOW_FERNET_KEY
- ✅ REDIS_URL

**가져가는 방법**:
```bash
# 로컬에서 파일 복사
scp .env user@새서버:/home/playdata/SKN15-FINAL-2TEAM/

# 또는 수동으로 내용 복사해서 새 서버에서 생성
cat .env  # 내용 복사
# 새 서버에서:
nano .env  # 붙여넣기
```

**템플릿 사용**:
```bash
# Git에는 .env.template 파일이 있음
cp .env.template .env
# 실제 값으로 변경
nano .env
```

---

### 2. STT AI 모델 파일 (model.safetensors)

**위치**: `/SKN15-FINAL-2TEAM/backend/models/stt/model.safetensors`

**크기**: **923MB** ⚠️ (Git에 절대 올리면 안 됨!)

**용도**: 음성-텍스트 변환 (Speech-to-Text)

**가져가는 방법**:

#### 방법 1: 직접 파일 전송 (추천)
```bash
# SCP로 전송 (시간 오래 걸림 - 923MB)
scp backend/models/stt/model.safetensors user@새서버:/home/playdata/SKN15-FINAL-2TEAM/backend/models/stt/

# 또는 rsync (중단/재시작 가능)
rsync -avz --progress backend/models/stt/model.safetensors user@새서버:/home/playdata/SKN15-FINAL-2TEAM/backend/models/stt/
```

#### 방법 2: 클라우드 스토리지 이용
```bash
# Google Drive, Dropbox, AWS S3 등에 업로드 후 다운로드
# 예: AWS S3
aws s3 cp backend/models/stt/model.safetensors s3://your-bucket/triplan/models/stt/

# 새 서버에서:
aws s3 cp s3://your-bucket/triplan/models/stt/model.safetensors backend/models/stt/
```

#### 방법 3: 원본 소스에서 다운로드 (가능한 경우)
```bash
# Hugging Face에서 직접 다운로드 (모델 이름 확인 필요)
# 예시:
wget https://huggingface.co/openai/whisper-small/resolve/main/model.safetensors -O backend/models/stt/model.safetensors
```

**중요**: 이 파일이 없으면 **STT 기능이 작동하지 않습니다!**

---

### 3. 데이터베이스 백업 (선택사항)

**위치**: PostgreSQL 데이터베이스

**크기**: 변동 (현재 데이터 기준)

**가져가야 할 데이터**:
- ✅ User 계정
- ✅ Place 데이터 (장소 마스터)
- ✅ TripCourseEmbedding (RAG 벡터 데이터) ⭐
- ✅ Country, Region 등 기본 데이터

**백업 방법**:
```bash
# 백업 생성
docker exec triplan-postgres pg_dump -U postgres lecun2 > triplan_backup_$(date +%Y%m%d).sql

# 새 서버에서 복원
cat triplan_backup_20250113.sql | docker exec -i triplan-postgres psql -U postgres lecun2
```

**또는 특정 테이블만 백업**:
```bash
# RAG 임베딩 데이터만 백업 (중요!)
docker exec triplan-postgres pg_dump -U postgres -t ai_tripcoursesembedding lecun2 > rag_embeddings.sql

# Place 데이터 백업
docker exec triplan-postgres pg_dump -U postgres -t places_place lecun2 > places.sql
```

---

## ✅ Git에 올려도 되는 파일 (코드/설정)

### 포함되는 파일들:
- ✅ Python 소스 코드 (`.py`)
- ✅ JavaScript/TypeScript 소스 코드
- ✅ Docker 설정 (`Dockerfile`, `docker-compose.yml`)
- ✅ Nginx 설정
- ✅ Requirements 파일 (`requirements.txt`, `package.json`)
- ✅ 데이터베이스 스키마 (`database/init.sql`)
- ✅ `.env.template` (템플릿, 실제 값 없음)
- ✅ 문서 파일 (README, 가이드 등)

---

## 📦 새 서버 배포 시 작업 순서

### 1. Git Clone
```bash
cd /home/playdata
git clone https://github.com/your-repo/SKN15-FINAL-2TEAM.git
cd SKN15-FINAL-2TEAM
```

### 2. 환경 변수 파일 생성
```bash
# 템플릿 복사
cp .env.template .env

# 실제 값으로 변경
nano .env
```

**필수 변경 사항**:
- `SECRET_KEY`: 새로운 랜덤 키 생성
- `POSTGRES_PASSWORD`: 강력한 비밀번호
- `OPENAI_API_KEY`: OpenAI API 키
- `KAKAO_API_KEY`: Kakao API 키
- `AIRFLOW_FERNET_KEY`: Fernet 키 생성

**Fernet 키 생성 방법**:
```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

**Django SECRET_KEY 생성 방법**:
```bash
python3 -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

### 3. STT 모델 파일 전송
```bash
# 로컬에서 새 서버로 전송
scp backend/models/stt/model.safetensors user@새서버:/home/playdata/SKN15-FINAL-2TEAM/backend/models/stt/

# 또는 클라우드에서 다운로드
# (위 섹션 참고)
```

### 4. 디렉토리 생성 (필요 시)
```bash
mkdir -p backend/models/stt
mkdir -p data
mkdir -p exports
mkdir -p media
mkdir -p staticfiles
mkdir -p airflow/logs
```

### 5. Docker 컨테이너 실행
```bash
docker-compose up -d
```

### 6. 데이터베이스 초기화/복원
```bash
# 새로 시작하는 경우 (마이그레이션)
docker exec triplan-backend python manage.py migrate

# 기존 데이터 복원하는 경우
cat triplan_backup.sql | docker exec -i triplan-postgres psql -U postgres lecun2
```

### 7. 확인
```bash
# 컨테이너 상태 확인
docker-compose ps

# 로그 확인
docker-compose logs -f backend
docker-compose logs -f websocket

# 웹 접속 확인
curl http://localhost
```

---

## 🔐 보안 주의사항

### Git에 절대 올리면 안 되는 것들:
1. ❌ `.env` 파일 (API 키, 비밀번호)
2. ❌ `*.pem`, `*.key` 파일 (SSH 키, SSL 인증서)
3. ❌ 데이터베이스 백업 파일 (민감한 사용자 정보 포함)
4. ❌ AI 모델 파일 (용량 큼, 923MB)
5. ❌ `node_modules/`, `__pycache__/` (재생성 가능)

### 이미 Git에 올라간 경우 제거 방법:
```bash
# Git 히스토리에서 완전히 제거 (⚠️ 주의!)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# 원격 저장소에 강제 푸시
git push origin --force --all
```

---

## 📊 파일 크기 요약

| 파일/디렉토리 | 크기 | Git 포함 여부 | 필수 여부 |
|-------------|------|-------------|---------|
| `.env` | 1KB | ❌ | ✅ 필수 |
| `backend/models/stt/model.safetensors` | 923MB | ❌ | ✅ 필수 (STT 기능) |
| 소스 코드 | ~50MB | ✅ | ✅ 필수 |
| `node_modules/` | ~500MB | ❌ | ❌ (npm install로 재생성) |
| `__pycache__/` | ~10MB | ❌ | ❌ (자동 생성) |
| 데이터베이스 백업 | 변동 | ❌ | ⚠️ 권장 (기존 데이터 유지 시) |

---

## 🌐 클라우드 스토리지 활용 (추천)

### Google Drive 사용
1. `model.safetensors` (923MB) 업로드
2. `.env` 파일 업로드 (암호화 필수!)
3. 공유 링크 생성 (비공개)
4. 새 서버에서 다운로드

### AWS S3 사용 (프로 방식)
```bash
# 업로드
aws s3 cp backend/models/stt/model.safetensors s3://triplan-models/stt/
aws s3 cp .env s3://triplan-secrets/ --sse AES256

# 다운로드
aws s3 cp s3://triplan-models/stt/model.safetensors backend/models/stt/
aws s3 cp s3://triplan-secrets/.env .
```

---

## 📝 체크리스트

새 서버 배포 전 확인:

- [ ] `.env` 파일 준비됨 (실제 API 키 포함)
- [ ] `model.safetensors` 파일 준비됨 (923MB)
- [ ] 데이터베이스 백업 준비됨 (선택)
- [ ] Git 저장소가 최신 상태임
- [ ] Docker, Docker Compose 설치됨 (새 서버)
- [ ] 포트 열려있음: 80, 443, 8000, 8001, 5432, 6379
- [ ] 방화벽 설정 확인

배포 후 확인:

- [ ] 웹사이트 접속 가능
- [ ] 로그인 작동
- [ ] WebSocket 연결 정상 (채팅)
- [ ] STT 기능 작동 (음성 입력)
- [ ] RAG 추천 작동
- [ ] 데이터베이스 연결 정상

---

**작성일**: 2025-01-13
**버전**: 1.0
**관리**: 팀 DevOps
