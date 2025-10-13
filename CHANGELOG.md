# 📝 Triplan - Changelog

## [프로젝트명 변경] - 2025.10.13

### 변경사항
프로젝트명을 `Travel Planner`에서 `Triplan`으로 전면 변경

### 상세 내역

#### 1. 디렉토리 이름
- `travel-planner/` → `triplan/`

#### 2. 데이터베이스 이름
- `travel_planner` → `triplan`

#### 3. Docker 컨테이너 이름
- `travel-planner-db` → `triplan-db`
- `travel-planner-redis` → `triplan-redis`
- `travel-planner-backend` → `triplan-backend`
- `travel-planner-frontend` → `triplan-frontend`
- `travel-planner-airflow-db` → `triplan-airflow-db`
- `travel-planner-airflow-webserver` → `triplan-airflow-webserver`
- `travel-planner-airflow-scheduler` → `triplan-airflow-scheduler`
- `travel-planner-nginx` → `triplan-nginx`

#### 4. Docker 네트워크
- `travel-planner-network` → `triplan-network`

#### 5. 문서 업데이트
- ✅ README.md
- ✅ GETTING_STARTED.md
- ✅ PROJECT_STRUCTURE.md
- ✅ Makefile
- ✅ .env.template

#### 6. 설정 파일 업데이트
- ✅ docker-compose.yml
- ✅ docker-compose.dev.yml
- ✅ backend/config/settings/base.py
- ✅ backend/config/asgi.py
- ✅ backend/config/wsgi.py
- ✅ backend/config/urls.py
- ✅ database/init.sql
- ✅ database/pgvector-setup.sql
- ✅ frontend/package.json

### 영향받는 부분

#### 환경 변수
```bash
# 기존
POSTGRES_DB=travel_planner
DATABASE_URL=postgresql://...@postgres:5432/travel_planner

# 변경 후
POSTGRES_DB=triplan
DATABASE_URL=postgresql://...@postgres:5432/triplan
```

#### 디렉토리 경로
```bash
# 기존
cd travel-planner

# 변경 후
cd triplan
```

#### Docker 명령어
```bash
# 기존
docker-compose exec travel-planner-backend python manage.py migrate

# 변경 후
docker-compose exec triplan-backend python manage.py migrate
# 또는 (Makefile 사용)
make migrate
```

### 마이그레이션 가이드

기존 프로젝트를 사용 중이었다면:

1. **데이터 백업** (중요!)
   ```bash
   # 기존 데이터베이스 백업
   docker-compose exec postgres pg_dump -U postgres travel_planner > backup.sql
   ```

2. **컨테이너 중지 및 제거**
   ```bash
   docker-compose down -v
   ```

3. **새 이름으로 시작**
   ```bash
   # .env 파일에서 POSTGRES_DB를 triplan으로 변경
   docker-compose up -d --build
   ```

4. **데이터 복원** (필요시)
   ```bash
   # 복원 전 데이터베이스 생성 확인
   docker-compose exec postgres psql -U postgres -d triplan < backup.sql
   ```

### 주의사항

⚠️ **기존 데이터베이스 이름 주의**
- 기존에 `travel_planner` 데이터베이스를 사용하고 있었다면, 데이터베이스 이름이 `triplan`으로 변경되어 데이터 접근이 불가능합니다.
- 반드시 백업 후 마이그레이션을 진행하세요.

⚠️ **컨테이너 이름 변경**
- 기존 컨테이너 이름으로 작성된 스크립트나 명령어가 있다면 수정이 필요합니다.

⚠️ **볼륨 데이터**
- Docker 볼륨은 컨테이너 이름과 무관하게 유지되므로, `docker-compose down -v` 없이 재시작하면 기존 데이터가 유지됩니다.

---

## 향후 계획

- [ ] CI/CD 파이프라인 설정
- [ ] 프로덕션 환경 배포
- [ ] 기능 구현 시작
  - [ ] 사용자 인증 시스템
  - [ ] RAG 기반 AI 챗봇
  - [ ] 실시간 협업 기능
  - [ ] 여행 일정 문서 내보내기
