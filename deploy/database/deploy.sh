#!/bin/bash

###############################################
# Triplan Database + Airflow EC2 배포 스크립트
###############################################

set -e

echo "=================================="
echo "Triplan Database + Airflow 배포 시작"
echo "=================================="

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 환경 변수 파일 확인
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env 파일이 없습니다!${NC}"
    echo "   필수 환경 변수:"
    echo "   - POSTGRES_PASSWORD"
    echo "   - AIRFLOW_FERNET_KEY"
    echo "   - AIRFLOW_WEBSERVER_SECRET_KEY"
    exit 1
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

# PostgreSQL 시작 대기
echo ""
echo "⏳ PostgreSQL 시작 대기 중..."
sleep 15

# Airflow 초기화 (최초 실행시)
echo ""
echo "🔧 Airflow 초기화 중..."
docker-compose exec -T airflow-webserver airflow db init || echo "Airflow DB already initialized"

# Airflow 관리자 생성 (이미 존재하면 스킵)
echo ""
echo "👤 Airflow 관리자 계정 생성 중..."
docker-compose exec -T airflow-webserver airflow users create \
    --username admin \
    --password admin \
    --firstname Admin \
    --lastname User \
    --role Admin \
    --email admin@example.com 2>/dev/null || echo "Admin user already exists"

# 상태 확인
echo ""
echo "📊 컨테이너 상태 확인 중..."
docker-compose ps

# 데이터베이스 연결 테스트
echo ""
echo "🔍 PostgreSQL 연결 테스트 중..."
if docker-compose exec -T postgres psql -U postgres -d triplan -c "SELECT 1" &> /dev/null; then
    echo -e "${GREEN}✓ PostgreSQL 정상 작동${NC}"
else
    echo -e "${YELLOW}⚠ PostgreSQL 연결 실패${NC}"
fi

# 로그 확인
echo ""
echo "📝 최근 로그 (Ctrl+C로 종료):"
docker-compose logs -f --tail=50

echo ""
echo -e "${GREEN}=================================="
echo "✅ Database + Airflow 배포 완료!"
echo "==================================${NC}"
echo ""
echo "접속 정보:"
echo "  - PostgreSQL: $(hostname -I | awk '{print $1}'):5432"
echo "  - Airflow Web: http://$(hostname -I | awk '{print $1}'):8080"
echo "  - Airflow 계정: admin / admin"
echo ""
echo "유용한 명령어:"
echo "  - PostgreSQL 접속: docker-compose exec postgres psql -U postgres -d triplan"
echo "  - Airflow 로그: docker-compose logs -f airflow-scheduler"
echo "  - 데이터베이스 백업: docker-compose exec postgres pg_dump -U postgres triplan > backup.sql"
