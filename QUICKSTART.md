# Triplan 빠른 시작 가이드

**단 3단계로 시작!**

---

## ⚡ 3단계 빠른 시작

### 1️⃣ 프로젝트 다운로드

```bash
git clone https://github.com/your-username/triplan.git
cd triplan
```

### 2️⃣ 환경변수 설정

```bash
# .env 파일 생성
cp .env.example .env

# API 키 입력 (.env 파일 열어서 수정)
nano .env
```

**필수 입력 항목**:
- `OPENAI_API_KEY`: [OpenAI에서 발급](https://platform.openai.com/api-keys)
- `KAKAO_REST_API_KEY`: [Kakao Developers에서 발급](https://developers.kakao.com/)

### 3️⃣ 도커 실행

```bash
docker-compose up -d --build
```

**끝! 🎉**

---

## 🌐 접속 주소

| 서비스 | 주소 | 계정 |
|--------|------|------|
| **웹사이트** | http://localhost:3000 | 회원가입 또는 test@example.com / test1234 |
| **Admin** | http://localhost:8000/admin/ | admin / admin1234 |
| **API** | http://localhost:8000/api/ | - |
| **Airflow** | http://localhost:8080 | admin / admin |

---

## 🔍 로그 확인

```bash
# 전체 로그 보기
docker-compose logs -f

# Backend만 보기
docker-compose logs -f backend

# 에러만 보기
docker-compose logs -f | grep ERROR
```

---

## 🛑 중지 및 재시작

```bash
# 중지
docker-compose down

# 재시작
docker-compose up -d

# 완전 초기화 (데이터 삭제)
docker-compose down -v
docker-compose up -d --build
```

---

## ❓ 문제 해결

### 문제: 컨테이너가 시작되지 않아요

```bash
# 로그 확인
docker-compose logs backend

# 포트 충돌 확인
lsof -i :8000
lsof -i :3000
lsof -i :5432

# 기존 컨테이너 정리
docker-compose down
docker system prune -a
docker-compose up -d --build
```

### 문제: DB 연결 실패

```bash
# PostgreSQL 상태 확인
docker-compose logs postgres

# PostgreSQL 재시작
docker-compose restart postgres
docker-compose restart backend
```

### 문제: 슈퍼유저 비밀번호를 잊었어요

```bash
# 슈퍼유저 재생성
docker-compose exec backend python manage.py createsuperuser
```

---

## 📚 더 자세한 정보

- **전체 배포 가이드**: [DEPLOYMENT.md](DEPLOYMENT.md)
- **API 문서**: http://localhost:8000/api/docs/
- **프로젝트 문서**: [README.md](README.md)

---

**즐거운 여행 계획 되세요! 🎉**
