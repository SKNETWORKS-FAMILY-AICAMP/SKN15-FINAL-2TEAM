#!/bin/bash

###############################################
# Triplan 로컬 환경 전체 실행 스크립트
###############################################

set -e

echo "========================================="
echo "🚀 Triplan 로컬 환경 시작"
echo "========================================="
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 환경 변수 파일 확인
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠ .env 파일이 없습니다. .env.template을 복사합니다...${NC}"
    cp .env.template .env
    echo -e "${YELLOW}⚠ .env 파일을 수정하여 API 키를 설정하세요!${NC}"
    echo ""
    read -p "계속하시겠습니까? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo -e "${GREEN}✓ 환경 변수 파일 확인 완료${NC}"

# Docker 확인
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker가 설치되어 있지 않습니다!${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose가 설치되어 있지 않습니다!${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker 환경 확인 완료${NC}"
echo ""

# 데이터 디렉토리 생성
echo "📁 데이터 디렉토리 생성 중..."
mkdir -p data/{postgres,redis,static,media,exports,airflow-postgres,airflow-data}
mkdir -p airflow/logs
echo -e "${GREEN}✓ 디렉토리 생성 완료${NC}"
echo ""

# 기존 컨테이너 정리
echo "🧹 기존 컨테이너 정리 중..."
docker-compose -f docker-compose.local.yml down
echo ""

# 이미지 빌드
echo "🔨 Docker 이미지 빌드 중..."
echo "   (최초 실행시 5-10분 소요될 수 있습니다)"
docker-compose -f docker-compose.local.yml build
echo ""

# 컨테이너 실행
echo "🚀 모든 서비스 시작 중..."
docker-compose -f docker-compose.local.yml up -d
echo ""

# 서비스 시작 대기
echo "⏳ 서비스 시작 대기 중..."
sleep 15
echo ""

# Airflow 초기화
echo "🔧 Airflow 초기화 중..."
docker-compose -f docker-compose.local.yml exec -T airflow-webserver airflow db init 2>/dev/null || echo "Airflow already initialized"
docker-compose -f docker-compose.local.yml exec -T airflow-webserver airflow users create \
    --username admin \
    --password admin \
    --firstname Admin \
    --lastname User \
    --role Admin \
    --email admin@example.com 2>/dev/null || echo "Airflow admin user already exists"
echo ""

# 상태 확인
echo "📊 서비스 상태 확인 중..."
docker-compose -f docker-compose.local.yml ps
echo ""

# 헬스 체크
echo "🏥 헬스 체크 중..."
sleep 5

# Backend 체크
if curl -f http://localhost:8000/health &> /dev/null; then
    echo -e "${GREEN}✓ Backend API 정상${NC}"
else
    echo -e "${YELLOW}⚠ Backend API 시작 중...${NC}"
fi

# Frontend 체크
if curl -f http://localhost:3000 &> /dev/null; then
    echo -e "${GREEN}✓ Frontend 정상${NC}"
else
    echo -e "${YELLOW}⚠ Frontend 시작 중...${NC}"
fi

# Airflow 체크
if curl -f http://localhost:8080 &> /dev/null; then
    echo -e "${GREEN}✓ Airflow 정상${NC}"
else
    echo -e "${YELLOW}⚠ Airflow 시작 중...${NC}"
fi

echo ""
echo -e "${GREEN}========================================="
echo "✅ Triplan 로컬 환경 시작 완료!"
echo "=========================================${NC}"
echo ""
echo -e "${BLUE}📌 접속 정보:${NC}"
echo "  🌐 Frontend:     http://localhost:3000"
echo "  🔧 Backend API:  http://localhost:8000"
echo "  💬 WebSocket:    ws://localhost:8001"
echo "  🔄 Airflow:      http://localhost:8080 (admin/admin)"
echo "  🗄️  PostgreSQL:   localhost:5432"
echo "  🔴 Redis:        localhost:6379"
echo ""
echo -e "${BLUE}📚 유용한 명령어:${NC}"
echo "  로그 확인:        docker-compose -f docker-compose.local.yml logs -f"
echo "  특정 서비스 로그:  docker-compose -f docker-compose.local.yml logs -f backend"
echo "  서비스 재시작:    docker-compose -f docker-compose.local.yml restart"
echo "  서비스 중지:      docker-compose -f docker-compose.local.yml down"
echo "  Django Shell:    docker-compose -f docker-compose.local.yml exec backend python manage.py shell"
echo "  슈퍼유저 생성:    docker-compose -f docker-compose.local.yml exec backend python manage.py createsuperuser"
echo ""
echo -e "${YELLOW}💡 팁: 로그를 실시간으로 보려면 아래 명령어를 실행하세요:${NC}"
echo "  docker-compose -f docker-compose.local.yml logs -f"
echo ""
