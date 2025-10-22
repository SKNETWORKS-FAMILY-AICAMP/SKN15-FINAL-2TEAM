#!/bin/bash

# ========================================
# 인스턴스별 자동 배포 스크립트
# ========================================
# 각 EC2 인스턴스에서 실행
# 번호만 선택하면 자동으로 환경 구축 + Docker 실행
#
# 사용법:
#   chmod +x deploy-instance.sh
#   ./deploy-instance.sh
# ========================================

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 로고
echo -e "${BLUE}"
cat << 'EOF'
========================================
   🚀 Triplan 인스턴스 자동 배포
========================================
EOF
echo -e "${NC}"

# 인스턴스 선택 메뉴
echo -e "${GREEN}이 서버의 역할을 선택하세요:${NC}"
echo ""
echo "  1) Nginx (Entry Point)"
echo "  2) Frontend (Next.js)"
echo "  3) Backend API (Django/Gunicorn)"
echo "  4) WebSocket Server (Django/Daphne)"
echo "  5) Redis (Cache & Channel Layer)"
echo "  6) PostgreSQL (메인 DB)"
echo "  7) Airflow (데이터 파이프라인)"
echo ""
read -p "선택 (1-7): " instance_type
echo ""

# 인스턴스 타입에 따른 설정
case $instance_type in
    1)
        INSTANCE_NAME="Nginx"
        COMPOSE_FILE="docker-compose.nginx.yml"
        NEEDS_ENV=true
        ENV_TEMPLATE="nginx"
        ;;
    2)
        INSTANCE_NAME="Frontend"
        COMPOSE_FILE="docker-compose.frontend.yml"
        NEEDS_ENV=true
        ENV_TEMPLATE="frontend"
        ;;
    3)
        INSTANCE_NAME="Backend"
        COMPOSE_FILE="docker-compose.backend.yml"
        NEEDS_ENV=true
        ENV_TEMPLATE="backend"
        ;;
    4)
        INSTANCE_NAME="WebSocket"
        COMPOSE_FILE="docker-compose.websocket.yml"
        NEEDS_ENV=true
        ENV_TEMPLATE="websocket"
        ;;
    5)
        INSTANCE_NAME="Redis"
        COMPOSE_FILE="docker-compose.redis.yml"
        NEEDS_ENV=false
        ;;
    6)
        INSTANCE_NAME="PostgreSQL"
        COMPOSE_FILE="docker-compose.postgres.yml"
        NEEDS_ENV=true
        ENV_TEMPLATE="postgres"
        ;;
    7)
        INSTANCE_NAME="Airflow"
        COMPOSE_FILE="docker-compose.airflow.yml"
        NEEDS_ENV=true
        ENV_TEMPLATE="airflow"
        ;;
    *)
        echo -e "${RED}잘못된 선택입니다.${NC}"
        exit 1
        ;;
esac

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}선택된 인스턴스: ${INSTANCE_NAME}${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# 1단계: Git 설치 확인
echo -e "${BLUE}[1/6] Git 설치 확인 중...${NC}"
if ! command -v git &> /dev/null; then
    echo -e "${YELLOW}Git이 없습니다. 설치 중...${NC}"
    sudo apt update
    sudo apt install -y git
    echo -e "${GREEN}✅ Git 설치 완료${NC}"
else
    echo -e "${GREEN}✅ Git 이미 설치됨${NC}"
fi
echo ""

# 2단계: Docker 설치 확인
echo -e "${BLUE}[2/6] Docker 설치 확인 중...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}Docker가 없습니다. 설치 중...${NC}"
    sudo apt update
    sudo apt install -y docker.io
    sudo systemctl start docker
    sudo systemctl enable docker
    sudo usermod -aG docker $USER
    echo -e "${GREEN}✅ Docker 설치 완료${NC}"

    # Docker Compose 설치
    echo -e "${YELLOW}Docker Compose 설치 중...${NC}"
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
    sudo curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    sudo ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose

    echo -e "${GREEN}✅ Docker Compose 설치 완료${NC}"
    echo -e "${YELLOW}⚠️  Docker 그룹 적용을 위해 재로그인이 필요합니다.${NC}"
    echo -e "${YELLOW}   이 스크립트를 종료하고 다시 접속한 후 재실행해주세요.${NC}"
    exit 0
else
    echo -e "${GREEN}✅ Docker 이미 설치됨${NC}"

    # Docker Compose 확인
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null 2>&1; then
        echo -e "${YELLOW}Docker Compose가 없습니다. 설치 중...${NC}"
        COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
        sudo curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
        sudo ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
        echo -e "${GREEN}✅ Docker Compose 설치 완료${NC}"
    else
        echo -e "${GREEN}✅ Docker Compose 이미 설치됨${NC}"
    fi
fi
echo ""

# 3단계: 프로젝트 디렉토리 확인/생성
echo -e "${BLUE}[3/6] 프로젝트 디렉토리 설정 중...${NC}"
PROJECT_DIR="/home/$USER/triplan"

if [ -d "$PROJECT_DIR" ]; then
    echo -e "${YELLOW}프로젝트 디렉토리가 이미 존재합니다: $PROJECT_DIR${NC}"
    read -p "최신 코드로 업데이트하시겠습니까? (y/N): " update_code
    if [ "$update_code" = "y" ] || [ "$update_code" = "Y" ]; then
        cd "$PROJECT_DIR"
        git pull origin main
        echo -e "${GREEN}✅ 코드 업데이트 완료${NC}"
    fi
else
    echo -e "${YELLOW}GitHub Repository URL을 입력하세요:${NC}"
    read -p "URL (예: https://github.com/username/repo.git): " repo_url

    cd /home/$USER
    git clone "$repo_url" triplan
    echo -e "${GREEN}✅ 코드 클론 완료${NC}"
fi

cd "$PROJECT_DIR"
echo ""

# 4단계: data 폴더 생성
echo -e "${BLUE}[4/6] 데이터 디렉토리 생성 중...${NC}"
mkdir -p data/{postgres,redis,static,media,exports,airflow-postgres,airflow-data}
echo -e "${GREEN}✅ 데이터 디렉토리 생성 완료${NC}"
echo ""

# 5단계: .env 파일 설정
echo -e "${BLUE}[5/6] 환경 변수 설정 중...${NC}"
if [ "$NEEDS_ENV" = true ]; then
    if [ -f .env ]; then
        echo -e "${YELLOW}.env 파일이 이미 존재합니다.${NC}"
        read -p "덮어쓰시겠습니까? (y/N): " overwrite_env
        if [ "$overwrite_env" != "y" ] && [ "$overwrite_env" != "Y" ]; then
            echo -e "${GREEN}✅ 기존 .env 파일 사용${NC}"
        else
            create_env=true
        fi
    else
        create_env=true
    fi

    if [ "$create_env" = true ]; then
        echo -e "${YELLOW}.env 파일을 생성합니다.${NC}"
        echo -e "${CYAN}.env.aws.example을 복사하여 .env를 생성합니다.${NC}"
        echo ""

        # .env.aws.example을 우선적으로 복사 (AWS 배포용)
        if [ -f .env.aws.example ]; then
            cp .env.aws.example .env
            echo -e "${GREEN}✅ .env.aws.example을 .env로 복사했습니다.${NC}"
        elif [ -f .env.example ]; then
            cp .env.example .env
            echo -e "${GREEN}✅ .env.example을 .env로 복사했습니다.${NC}"
        else
            echo -e "${RED}⚠️  .env.example 파일이 없습니다!${NC}"
            echo -e "${YELLOW}기본 템플릿으로 .env를 생성합니다.${NC}"
            cat > .env << 'EOL'
# Triplan 환경변수 - 모든 인스턴스 공통 사용
# 각 인스턴스에 맞게 IP 주소를 수정하세요.

DEBUG=False
SECRET_KEY=change-this-to-random-50-characters

POSTGRES_DB=lecun2
POSTGRES_USER=postgres
POSTGRES_PASSWORD=change-this-password
DATABASE_URL=postgresql://postgres:change-this-password@POSTGRES_PRIVATE_IP:5432/lecun2

REDIS_URL=redis://REDIS_PRIVATE_IP:6379/0

OPENAI_API_KEY=sk-proj-your-openai-api-key
KAKAO_API_KEY=your-kakao-api-key
KAKAO_MAP_API_KEY=your-kakao-map-api-key

ALLOWED_HOSTS=NGINX_PUBLIC_IP,localhost
CORS_ALLOWED_ORIGINS=http://NGINX_PUBLIC_IP,http://localhost:3000

NODE_ENV=production
NEXT_PUBLIC_API_URL=http://NGINX_PUBLIC_IP
NEXT_PUBLIC_WS_URL=ws://NGINX_PUBLIC_IP
NEXT_PUBLIC_KAKAO_API_KEY=your-kakao-javascript-api-key

FRONTEND_HOST=FRONTEND_PRIVATE_IP
BACKEND_HOST=BACKEND_PRIVATE_IP
WEBSOCKET_HOST=WEBSOCKET_PRIVATE_IP

AIRFLOW_POSTGRES_PASSWORD=airflow
AIRFLOW_FERNET_KEY=generate-fernet-key-here
AIRFLOW_WEBSERVER_SECRET_KEY=generate-secret-key-here
AIRFLOW_USERNAME=admin
AIRFLOW_PASSWORD=admin
EOL
        fi

        echo ""
        echo -e "${YELLOW}==================================================${NC}"
        echo -e "${YELLOW}  nano 에디터로 .env 파일을 수정하세요.${NC}"
        echo -e "${YELLOW}  수정 필요한 값들:${NC}"
        echo -e "${CYAN}  - POSTGRES_PRIVATE_IP (PostgreSQL Private IP)${NC}"
        echo -e "${CYAN}  - REDIS_PRIVATE_IP (Redis Private IP)${NC}"
        echo -e "${CYAN}  - NGINX_PUBLIC_IP (Nginx Public IP)${NC}"
        echo -e "${CYAN}  - FRONTEND_PRIVATE_IP (Frontend Private IP)${NC}"
        echo -e "${CYAN}  - BACKEND_PRIVATE_IP (Backend Private IP)${NC}"
        echo -e "${CYAN}  - WEBSOCKET_PRIVATE_IP (WebSocket Private IP)${NC}"
        echo -e "${CYAN}  - 모든 비밀번호와 API 키${NC}"
        echo -e "${YELLOW}==================================================${NC}"
        echo -e "${YELLOW}  저장: Ctrl+O, Enter / 종료: Ctrl+X${NC}"
        echo -e "${YELLOW}==================================================${NC}"
        read -p "Enter를 눌러 에디터를 여세요..."
        nano .env

        echo -e "${GREEN}✅ .env 파일 설정 완료${NC}"
    fi
else
    echo -e "${GREEN}✅ 이 인스턴스는 .env 파일이 필요없습니다.${NC}"
fi
echo ""

# 6단계: Docker Compose 실행
echo -e "${BLUE}[6/6] Docker 컨테이너 빌드 및 실행 중...${NC}"
echo -e "${CYAN}Docker Compose 파일: $COMPOSE_FILE${NC}"
echo ""

# 기존 컨테이너 정리
if docker compose -f "$COMPOSE_FILE" ps -q 2>/dev/null | grep -q .; then
    echo -e "${YELLOW}기존 컨테이너를 중지하고 제거합니다...${NC}"
    docker compose -f "$COMPOSE_FILE" down
fi

# 빌드 및 실행
echo -e "${YELLOW}Docker 이미지 빌드 중... (시간이 걸릴 수 있습니다)${NC}"
docker compose -f "$COMPOSE_FILE" build --no-cache

echo -e "${YELLOW}컨테이너 시작 중...${NC}"
docker compose -f "$COMPOSE_FILE" up -d

echo ""
echo -e "${GREEN}✅ Docker 컨테이너 실행 완료!${NC}"
echo ""

# 상태 확인
echo -e "${BLUE}컨테이너 상태:${NC}"
docker compose -f "$COMPOSE_FILE" ps
echo ""

# 로그 확인 옵션
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}배포 완료!${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "${GREEN}다음 명령어로 로그를 확인할 수 있습니다:${NC}"
echo -e "  ${YELLOW}docker compose -f $COMPOSE_FILE logs -f${NC}"
echo ""
echo -e "${GREEN}컨테이너 재시작:${NC}"
echo -e "  ${YELLOW}docker compose -f $COMPOSE_FILE restart${NC}"
echo ""
echo -e "${GREEN}컨테이너 중지:${NC}"
echo -e "  ${YELLOW}docker compose -f $COMPOSE_FILE down${NC}"
echo ""

read -p "지금 로그를 확인하시겠습니까? (y/N): " show_logs
if [ "$show_logs" = "y" ] || [ "$show_logs" = "Y" ]; then
    docker compose -f "$COMPOSE_FILE" logs -f
fi

echo -e "${GREEN}완료! 🎉${NC}"
