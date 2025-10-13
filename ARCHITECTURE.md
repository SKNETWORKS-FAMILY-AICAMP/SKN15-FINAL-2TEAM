# 🏗️ Triplan - 시스템 아키텍처 상세 설명

## 개요

Triplan은 **마이크로서비스 아키텍처**를 기반으로 하며, 각 서비스가 독립적으로 확장 가능하도록 설계되었습니다.

## 서비스 구성

### 1. Backend API (Gunicorn)
**Port**: 8000
**역할**: REST API 처리

#### 기술 스택
- Django 4.2 + Django REST Framework
- Gunicorn (WSGI Server)
- Workers: 4 (기본 설정)

#### 처리하는 요청
- `/api/*` - 모든 REST API 엔드포인트
- `/admin/` - Django 관리자 페이지
- `/health` - 헬스 체크

#### 명령어
```bash
gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 4 --timeout 120
```

#### 특징
- **동기 처리**: WSGI 기반으로 일반적인 HTTP 요청 처리
- **다중 워커**: 여러 요청을 병렬로 처리
- **안정성**: 프로덕션 환경에서 검증된 WSGI 서버

---

### 2. WebSocket Server (Daphne)
**Port**: 8001
**역할**: 실시간 통신 처리

#### 기술 스택
- Django Channels
- Daphne (ASGI Server)
- Redis (Channel Layer)

#### 처리하는 요청
- `/ws/*` - WebSocket 연결

#### 명령어
```bash
daphne -b 0.0.0.0 -p 8001 config.asgi:application
```

#### 특징
- **비동기 처리**: ASGI 기반으로 WebSocket 지원
- **실시간 통신**: 채팅, 알림, 실시간 업데이트
- **Redis 연동**: 여러 서버 간 메시지 동기화

---

### 3. Nginx (Reverse Proxy)
**Port**: 80, 443

#### 역할
- SSL/TLS 종료
- 로드 밸런싱
- 정적 파일 서빙
- 요청 라우팅

#### 라우팅 규칙
```nginx
/ → Frontend (Next.js :3000)
/api/* → Backend (Gunicorn :8000)
/ws/* → WebSocket (Daphne :8001)
/admin/ → Backend (Gunicorn :8000)
/static/ → 정적 파일
/media/ → 미디어 파일
```

---

### 4. Frontend (Next.js)
**Port**: 3000

#### 기술 스택
- Next.js 14 (React 18)
- TypeScript
- Material-UI
- Recoil (상태 관리)

#### 특징
- **SSR**: 서버 사이드 렌더링
- **SEO 최적화**: 검색 엔진 친화적
- **Fast Refresh**: 빠른 개발 경험

---

### 5. PostgreSQL + pgvector
**Port**: 5432

#### 역할
- 메인 데이터베이스
- 벡터 검색 (RAG)

#### 특징
- **pgvector 확장**: 벡터 유사도 검색
- **JSONB**: 유연한 데이터 저장
- **Full-text search**: 텍스트 검색 최적화

---

### 6. Redis
**Port**: 6379

#### 역할
- Django Channels Layer
- 세션 저장소
- 캐싱

#### 특징
- **Pub/Sub**: 실시간 메시지 브로드캐스트
- **고성능**: 인메모리 데이터베이스
- **영속성**: AOF (Append Only File) 활성화

---

### 7. Airflow
**Ports**: 8080 (Webserver)

#### 구성 요소
- Airflow Webserver
- Airflow Scheduler
- Airflow Worker (LocalExecutor)
- Airflow PostgreSQL (별도 DB)

#### 역할
- 외부 데이터 수집 (날씨, 환율, 비자 정보)
- ETL 파이프라인 관리
- 주기적 작업 스케줄링

---

## 데이터 흐름

### 1. 일반 API 요청
```
[Client]
  → [Nginx:80]
  → [Backend:8000 (Gunicorn)]
  → [PostgreSQL:5432]
  ← [Response]
```

### 2. WebSocket 연결
```
[Client]
  → [Nginx:80 /ws]
  → [WebSocket:8001 (Daphne)]
  → [Redis:6379 (Channel Layer)]
  ↔ [실시간 통신]
```

### 3. AI/RAG 요청
```
[Client]
  → [Backend API]
  → [AI Module]
  → [PostgreSQL pgvector 검색]
  → [OpenAI API]
  ← [AI 응답]
```

### 4. 데이터 수집
```
[Airflow Scheduler]
  → [DAG 실행]
  → [외부 API/크롤링]
  → [데이터 정제]
  → [PostgreSQL 저장]
```

---

## 확장성 고려사항

### 수평 확장 (Horizontal Scaling)

#### Backend (Gunicorn)
- **Gunicorn Workers 증가**: `--workers` 옵션 조정
- **컨테이너 복제**: 여러 Backend 컨테이너 실행
- **Nginx 로드 밸런싱**: upstream에 서버 추가

```nginx
upstream backend {
    server backend1:8000;
    server backend2:8000;
    server backend3:8000;
}
```

#### WebSocket (Daphne)
- **Redis Pub/Sub**: 여러 Daphne 인스턴스 간 메시지 동기화
- **Sticky Sessions**: WebSocket 연결 유지

#### Database
- **Read Replicas**: 읽기 전용 복제본
- **Connection Pooling**: PgBouncer 사용
- **Partitioning**: 테이블 파티셔닝

---

## 보안 고려사항

### 1. 네트워크 격리
- Docker 네트워크: `triplan-network`
- 외부 접근: Nginx만 80/443 포트 노출
- 내부 통신: Docker 네트워크 내부

### 2. 인증 & 인가
- JWT 토큰 기반 인증
- Django 권한 시스템
- CORS 설정

### 3. 데이터 보호
- 환경 변수로 시크릿 관리
- PostgreSQL 암호화 연결
- Redis 인증 설정 (프로덕션)

---

## 모니터링 & 로깅

### 로그 수집
```bash
# 전체 로그
docker-compose logs -f

# 특정 서비스
docker-compose logs -f backend
docker-compose logs -f websocket
```

### 헬스 체크
```bash
# Backend
curl http://localhost:8000/health

# 전체 서비스 상태
docker-compose ps
```

### 메트릭 (향후 구현)
- Prometheus: 메트릭 수집
- Grafana: 시각화
- Sentry: 에러 트래킹

---

## 개발 vs 프로덕션 환경

### 개발 환경
```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

특징:
- Django `runserver` 사용 (Backend)
- Hot Reload 활성화
- DEBUG=True
- 모든 포트 노출

### 프로덕션 환경
```bash
docker-compose up -d
```

특징:
- Gunicorn 사용 (Backend)
- DEBUG=False
- SSL 인증서 적용
- 로그 레벨 조정
- 보안 헤더 활성화

---

## 성능 최적화

### 1. Backend 최적화
- Gunicorn worker 수 조정: `workers = (CPU * 2) + 1`
- Database 쿼리 최적화: `select_related`, `prefetch_related`
- 캐싱: Redis 활용

### 2. WebSocket 최적화
- Redis Pub/Sub로 메시지 브로드캐스트
- Connection pooling
- Heartbeat/Ping-Pong

### 3. Database 최적화
- 인덱스 생성
- 쿼리 최적화
- Connection pooling

### 4. Frontend 최적화
- Next.js SSR/SSG
- 이미지 최적화
- 코드 스플리팅

---

## 트러블슈팅

### Backend 연결 안됨
```bash
# 로그 확인
docker-compose logs backend

# 컨테이너 재시작
docker-compose restart backend
```

### WebSocket 연결 안됨
```bash
# WebSocket 서버 확인
docker-compose logs websocket

# Redis 연결 확인
docker-compose exec redis redis-cli ping
```

### Database 연결 안됨
```bash
# PostgreSQL 상태 확인
docker-compose ps postgres

# 연결 테스트
docker-compose exec postgres psql -U postgres -d triplan -c "SELECT 1"
```

---

## 다음 단계

- [ ] CI/CD 파이프라인 구축
- [ ] Kubernetes 마이그레이션 고려
- [ ] 모니터링 시스템 구축
- [ ] 자동 스케일링 구현
- [ ] CDN 연동
