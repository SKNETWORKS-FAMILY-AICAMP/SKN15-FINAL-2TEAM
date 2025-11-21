# Triplan 최종 문서

이 디렉토리에는 Triplan 프로젝트의 상세 기술 문서가 포함되어 있습니다.

## 📚 문서 목록

### 1. [배포 가이드](01_DEPLOYMENT_GUIDE.md)
**7-Instance 프로덕션 배포 가이드**

프로덕션 환경에서 7개의 EC2 인스턴스로 분산 배포하는 방법을 다룹니다.

**주요 내용**:
- 7-Instance 아키텍처 구성
  1. Nginx - 리버스 프록시, SSL Termination
  2. Frontend - Next.js 애플리케이션
  3. Backend - Django REST API
  4. Database - PostgreSQL + pgvector
  5. Airflow - 워크플로우 관리
  6. WebSocket - Django Channels 실시간 통신
  7. Redis - 캐시 및 채널 레이어
- Security Group 상세 설정
- 단계별 배포 가이드
- 환경 변수 설정
- SSL 인증서 발급 (Let's Encrypt)
- 배포 후 검증 방법
- 트러블슈팅 가이드
- 백업 전략

**예상 비용**: $150-185/월

---

### 2. [AI 에이전트 흐름도](02_AI_AGENT_FLOW.md)
**LangChain 기반 AI 에이전트 시스템 상세 설명**

사용자 메시지부터 응답 생성까지의 전체 프로세스를 다룹니다.

**주요 내용**:
- 전체 에이전트 아키텍처
- 의도 분류 시스템 (10가지 유형)
  - PLACE_RECOMMENDATION (장소 추천)
  - SCHEDULE_PLANNING (일정 계획)
  - SCHEDULE_ADD/MODIFY/DELETE (일정 수정)
  - WEATHER_INQUIRY (날씨 조회)
  - BUDGET_INQUIRY (예산 문의)
  - PLACE_SEARCH (장소 검색)
  - PLAN_STATUS (계획 조회)
  - GENERAL_CHAT (일반 대화)
- Tool 실행 메커니즘
- 각 Tool 상세 설명 및 코드 예시
- 응답 마커 시스템
- 성능 로깅 (BotPerformanceLog)
- 에러 처리 전략

**핵심 기술**: OpenAI GPT-4, LangChain ReAct Agent

---

### 3. [RAG 시스템 흐름도](03_RAG_SYSTEM_FLOW.md)
**벡터 검색 기반 추천 시스템 상세 설명**

RAG (Retrieval-Augmented Generation) 시스템의 전체 파이프라인을 다룹니다.

**주요 내용**:
- RAG 시스템 전체 아키텍처
- 데이터 준비 및 임베딩 생성
  - Place 모델 → PlaceEmbedding
  - OpenAI `text-embedding-3-small` (1536차원)
- 벡터 검색 프로세스
  - pgvector + HNSW 인덱스
  - Cosine Similarity 기반 검색
  - 하이브리드 검색 (벡터 + 키워드)
- LLM 정제 및 응답 생성
  - GPT-4로 일정 최적화
  - 시간대별 배치, 동선 고려
- Kakao API 좌표 통합
- 성능 최적화 기법
  - 캐싱 (Redis)
  - 배치 임베딩
  - 인덱싱 전략
- RAG 테스트 및 평가 시스템
  - 유사도 통계 (평균, 최소, 최대, 표준편차)
  - 검색 시간 측정
- 실제 사용 시나리오 (강릉 1박2일 예시)

**핵심 기술**: pgvector, OpenAI Embeddings, LangChain

---

### 4. [시스템 아키텍처](04_SYSTEM_ARCHITECTURE.md)
**전체 시스템 설계 및 기술 스택 상세 문서**

프론트엔드부터 백엔드, 데이터베이스, 인프라까지 전체 시스템 구조를 다룹니다.

**주요 내용**:
- 전체 아키텍처 다이어그램 (7-Instance)
- 프론트엔드 아키텍처
  - Next.js 14 구조
  - 디렉토리 구조 및 주요 컴포넌트
  - 상태 관리 전략 (Context API)
  - WebSocket 통합
- 백엔드 아키텍처
  - Django 앱 구조
  - API 엔드포인트 설계
  - WebSocket Consumer
  - LangChain Agent 통합
- 데이터베이스 스키마
  - ER 다이어그램
  - 주요 모델 (User, Trip, Day, Item, Place, PlaceEmbedding)
  - 인덱스 전략
- WebSocket 통신
  - Django Channels 구성
  - Redis 채널 레이어
  - 메시지 흐름
- AI/ML 파이프라인
  - 임베딩 생성 파이프라인
  - RAG 검색 파이프라인
- 외부 API 통합
  - OpenAI API (GPT-4, Embeddings)
  - Kakao API (Map, Search)
  - 기상청 API (날씨)
- 보안 및 인증
  - JWT 인증 흐름
  - CORS 설정
  - 환경 변수 보호
- 성능 및 확장성
  - Query 최적화
  - Redis 캐싱
  - pgvector 인덱싱
  - 수평/수직 확장 전략

**핵심 기술**: Django, Next.js, PostgreSQL, Redis, Docker

---

### 5. [발표 대비 Q&A](05_PRESENTATION_QNA.md)
**모든 기술 선택 이유 및 예상 질문 완벽 정리**

발표 시 예상되는 모든 질문과 답변을 10개 카테고리로 정리한 완벽 가이드입니다.

**주요 내용**:
- **의도 분류 시스템**
  - 왜 사후 역추론 방식을 사용하는가?
  - 5가지 의도 유형 설명
  - 17개 툴 매핑 전략
  - 확장성 및 유지보수

- **가드레일 에이전트**
  - 29개 공격 패턴 탐지
  - 7가지 보안 기능
  - 실제 차단 예시 (프롬프트 인젝션, SQL 인젝션 등)
  - False Positive 최소화 전략

- **RAG 시스템**
  - pgvector 선택 이유
  - HNSW 인덱스 최적화
  - 92% 정확도 달성 과정
  - YouTube 데이터 크롤링

- **WebSocket & 실시간 동기화**
  - Django Channels 아키텍처
  - Redis Channel Layer 역할
  - 재연결 로직 (exponential backoff)
  - 플래너 실시간 동기화 메커니즘

- **성능 최적화**
  - 병목 구간 식별 (RAG 800ms→200ms)
  - DB 쿼리 최적화 (N+1 문제 해결)
  - 3단계 캐싱 전략
  - 프론트엔드 최적화 (번들 2.5MB→1.1MB)

- **인프라 & 배포**
  - Docker Compose vs Kubernetes 선택 이유
  - 7-Container 아키텍처
  - AWS 배포 구조
  - 환경 변수 관리 (AWS Systems Manager)

- **보안**
  - JWT 인증 (Access/Refresh Token)
  - CORS 설정
  - XSS/SQL Injection 방어
  - API Rate Limiting

- **데이터베이스 설계**
  - 6개 핵심 도메인 구조
  - invite_code 충돌 방지 (36^6 = 21억 경우의 수)
  - order_in_day 순서 관리
  - 트랜잭션 처리 (atomic)

- **프론트엔드 아키텍처**
  - Next.js vs CRA 선택 이유
  - React Query + Context API 상태 관리
  - Kakao Maps 통합
  - 5가지 성능 최적화 기법

- **트러블슈팅 사례**
  - WebSocket 연결 끊김 해결
  - RAG 정확도 60%→92% 개선 과정
  - 성능 병목 해결 (RAG 2.7배 향상)
  - 프로덕션 배포 시 환경 변수 누락 해결

**발표 팁**:
- 답변 구조 (결론→이유→코드→결과)
- 강조할 포인트 5가지
- 피해야 할 것 3가지

**이 문서 하나로 발표 완벽 대비! 🎉**

---

## 🚀 빠른 시작

### 로컬 개발 환경
```bash
# 프로젝트 클론
git clone https://github.com/YOUR-REPO/SKN15-FINAL-2TEAM.git
cd SKN15-FINAL-2TEAM

# 환경 변수 설정
cp .env.template .env
# .env 파일 편집 (API 키 등)

# Docker Compose 실행
docker-compose up -d

# 서비스 접속
# Frontend: http://localhost:3000
# Backend: http://localhost:8000
# Airflow: http://localhost:8080
```

### 프로덕션 배포
[배포 가이드](01_DEPLOYMENT_GUIDE.md)를 참조하세요.

---

## 📊 시스템 요구사항

### 개발 환경
- **OS**: Ubuntu 22.04 LTS / macOS / Windows (WSL2)
- **RAM**: 8GB 이상
- **Storage**: 20GB 이상
- **Docker**: 20.10 이상
- **Docker Compose**: 2.0 이상

### 프로덕션 환경 (7-Instance)
- **Total vCPU**: 14 cores
- **Total RAM**: 20GB
- **Total Storage**: 150GB
- **Network**: VPC with Private Subnets
- **예상 비용**: $150-185/월

---

## 🔑 필수 API 키

프로젝트 실행을 위해 다음 API 키가 필요합니다:

1. **OpenAI API Key**
   - 발급: https://platform.openai.com/api-keys
   - 용도: GPT-4 (Agent), text-embedding-3-small (RAG)
   - 예상 비용: 사용량에 따라 다름

2. **Kakao REST API Key**
   - 발급: https://developers.kakao.com/
   - 용도: 장소 검색, 좌표 조회

3. **Kakao JavaScript Key**
   - 발급: https://developers.kakao.com/
   - 용도: 프론트엔드 지도 렌더링

4. **기상청 API Key**
   - 발급: https://www.data.go.kr/
   - 용도: 날씨 정보 조회

---

## 🏗️ 기술 스택 요약

| 계층 | 기술 |
|------|------|
| **Frontend** | Next.js 14, TypeScript, Material-UI, Kakao Maps SDK |
| **Backend** | Django 4.2, Django REST Framework, Django Channels |
| **Database** | PostgreSQL 15, pgvector |
| **Cache** | Redis 7 |
| **AI/ML** | OpenAI GPT-4, LangChain, sentence-transformers |
| **Workflow** | Apache Airflow 2.7 |
| **Deployment** | Docker, Docker Compose, Nginx, AWS EC2 |
| **Monitoring** | CloudWatch (선택사항) |

---

## 📖 추가 리소스

### 공식 문서
- [Django Documentation](https://docs.djangoproject.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [LangChain Documentation](https://python.langchain.com/)
- [pgvector Documentation](https://github.com/pgvector/pgvector)

### 관련 프로젝트
- [OpenAI Cookbook](https://github.com/openai/openai-cookbook)
- [LangChain Templates](https://github.com/langchain-ai/langchain)

---

## 🤝 기여 가이드

이 프로젝트는 LeCun 팀에서 개발했습니다.

### 팀 정보
- **프로젝트명**: Triplan - AI 기반 협업 여행 플래너
- **개발팀**: LeCun
- **이메일**: lecun2222@gmail.com

---

## 📝 라이선스

이 프로젝트는 교육 목적으로 개발되었습니다.

---

## 📞 문의

프로젝트 관련 문의사항이 있으시면 아래로 연락 주세요:

- **이메일**: lecun2222@gmail.com
- **전화**: 010-0000-0000

---

**마지막 업데이트**: 2025-01-19
**문서 버전**: 2.0.0
