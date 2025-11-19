# 📦 Triplan 배포 가이드 모음

Triplan 프로젝트의 다양한 배포 시나리오에 대한 가이드를 제공합니다.

## 📚 문서 목록

### 1. [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
**단일 서버 배포 가이드**
- 모든 컨테이너를 하나의 서버에 배포
- 개발/테스트 환경에 적합
- Docker Compose 사용

### 2. [DEPLOYMENT_7_INSTANCES.md](DEPLOYMENT_7_INSTANCES.md) ⭐ **추천**
**7개 인스턴스 분산 배포 가이드 (프로덕션)**
- Database, Backend, WebSocket, Frontend, Airflow(3개) 분리
- AWS EC2 기반 고가용성 아키텍처
- 자동 배포 스크립트 포함

### 3. [DEPLOYMENT_FILES_CHECKLIST.md](DEPLOYMENT_FILES_CHECKLIST.md)
**배포 전 체크리스트**
- 필수 파일 확인
- 보안 파일 관리
- Git 제외 파일 목록

## 🚀 빠른 시작

### 단일 서버 배포 (개발/테스트)
```bash
# 1. 저장소 클론
git clone https://github.com/your-repo/triplan.git
cd triplan

# 2. 환경 변수 설정
cp .env.template .env
nano .env

# 3. Docker Compose 실행
docker-compose up -d --build

# 4. 확인
docker-compose ps
```

### 7개 인스턴스 분산 배포 (프로덕션)
```bash
# 1. IP 주소 설정
nano deploy-all.sh
nano health-check.sh
# (각 인스턴스 IP 수정)

# 2. 자동 배포 실행
./deploy-all.sh

# 3. 헬스 체크
./health-check.sh
```

## 📊 배포 아키텍처 비교

| 구분 | 단일 서버 | 7개 인스턴스 |
|------|-----------|--------------|
| **난이도** | ⭐ 쉬움 | ⭐⭐⭐ 보통 |
| **비용** | 💰 저렴 (~$50/월) | 💰💰💰 중간 (~$200/월) |
| **확장성** | ❌ 제한적 | ✅ 우수 |
| **고가용성** | ❌ 낮음 | ✅ 높음 |
| **관리 복잡도** | ⭐ 낮음 | ⭐⭐⭐ 높음 |
| **권장 환경** | 개발/테스트 | 프로덕션 |

## 🛠️ 배포 스크립트

### deploy-all.sh
7개 인스턴스에 자동 배포
```bash
./deploy-all.sh
```

### health-check.sh
전체 서비스 헬스 체크
```bash
./health-check.sh
```

### check-required-files.sh
배포 전 필수 파일 확인
```bash
./check-required-files.sh
```

## 📋 배포 전 체크리스트

- [ ] `.env` 파일 준비
- [ ] STT 모델 파일 준비 (923MB)
- [ ] Docker 설치 확인
- [ ] API 키 확인 (OpenAI, Kakao)
- [ ] 보안 그룹 설정 (AWS)
- [ ] 도메인 DNS 설정
- [ ] SSL 인증서 준비

## 🔧 주요 기능

### RAG 시스템
- pgvector를 사용한 벡터 검색
- OpenAI GPT-4를 활용한 일정 정제
- 지역별 맞춤 추천

### 실시간 협업
- Django Channels WebSocket
- Redis Pub/Sub
- 다중 사용자 동시 편집

### AI 기능
- 음성 인식 (STT)
- 자연어 처리 (NLP)
- 장소 추천 (RAG)

## 📞 지원

- **GitHub**: [Issues](https://github.com/your-repo/issues)
- **문서**: [Wiki](https://github.com/your-repo/wiki)

---

**최종 업데이트**: 2025-11-19
**버전**: 2.0
