#!/bin/bash

###############################################
# Triplan Backend EC2 배포 스크립트
###############################################

set -e

echo "=================================="
echo "Triplan Backend 배포 시작"
echo "=================================="

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 환경 변수 파일 확인
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env 파일이 없습니다!${NC}"
    echo "   필수 환경 변수:"
    echo "   - SECRET_KEY"
    echo "   - DATABASE_URL (PostgreSQL 연결 정보)"
    echo "   - OPENAI_API_KEY"
    exit 1
fi

echo -e "${GREEN}✓ 환경 변수 파일 확인 완료${NC}"

# Docker 설치 확인
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker가 설치되어 있지 않습니다!${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose가 설치되어 있지 않습니다!${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker 환경 확인 완료${NC}"

# 기존 컨테이너 중지
echo ""
echo "📦 기존 컨테이너 정리 중..."
docker-compose down

# 이미지 빌드
echo ""
echo "🔨 Docker 이미지 빌드 중..."
docker-compose build --no-cache

# 컨테이너 실행
echo ""
echo "🚀 컨테이너 실행 중..."
docker-compose up -d

# 마이그레이션 대기
echo ""
echo "⏳ 마이그레이션 완료 대기 중..."
sleep 10

# 상태 확인
echo ""
echo "📊 컨테이너 상태 확인 중..."
docker-compose ps

# 헬스 체크
echo ""
echo "🏥 헬스 체크 중..."
sleep 5

if curl -f http://localhost:8000/health &> /dev/null; then
    echo -e "${GREEN}✓ Backend API 정상 작동${NC}"
else
    echo -e "${YELLOW}⚠ Backend API 헬스 체크 실패 (아직 시작 중일 수 있음)${NC}"
fi

# 로그 확인
echo ""
echo "📝 최근 로그 (Ctrl+C로 종료):"
docker-compose logs -f --tail=50

echo ""
echo -e "${GREEN}=================================="
echo "✅ Backend 배포 완료!"
echo "==================================${NC}"
echo ""
echo "접속 정보:"
echo "  - Backend API: http://$(hostname -I | awk '{print $1}'):8000"
echo "  - WebSocket: ws://$(hostname -I | awk '{print $1}'):8001"
echo "  - Redis: $(hostname -I | awk '{print $1}'):6379"
echo ""
echo "유용한 명령어:"
echo "  - 로그 확인: docker-compose logs -f backend"
echo "  - Django Shell: docker-compose exec backend python manage.py shell"
echo "  - 마이그레이션: docker-compose exec backend python manage.py migrate"
echo "  - 슈퍼유저 생성: docker-compose exec backend python manage.py createsuperuser"
