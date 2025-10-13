#!/bin/bash

###############################################
# Triplan Frontend EC2 배포 스크립트
###############################################

set -e  # 에러 발생 시 스크립트 중단

echo "=================================="
echo "Triplan Frontend 배포 시작"
echo "=================================="

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 환경 변수 파일 확인
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env 파일이 없습니다!${NC}"
    echo "   .env.template을 복사하여 .env 파일을 생성하세요."
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

# 기존 컨테이너 중지 및 제거
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

# 상태 확인
echo ""
echo "📊 컨테이너 상태 확인 중..."
sleep 5
docker-compose ps

# 로그 확인
echo ""
echo "📝 최근 로그 (Ctrl+C로 종료):"
docker-compose logs -f --tail=50

echo ""
echo -e "${GREEN}=================================="
echo "✅ Frontend 배포 완료!"
echo "==================================${NC}"
echo ""
echo "접속 정보:"
echo "  - Frontend: http://$(hostname -I | awk '{print $1}'):3000"
echo "  - Nginx: http://$(hostname -I | awk '{print $1}'):80"
echo ""
echo "유용한 명령어:"
echo "  - 로그 확인: docker-compose logs -f"
echo "  - 재시작: docker-compose restart"
echo "  - 중지: docker-compose down"
echo "  - 상태 확인: docker-compose ps"
