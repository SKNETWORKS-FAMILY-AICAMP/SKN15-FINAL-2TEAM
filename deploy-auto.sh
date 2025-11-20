#!/bin/bash

##############################################################################
# Triplan Auto Deploy Script
#
# 사용법:
#   1. 각 EC2 인스턴스에 이 스크립트를 복사
#   2. .env 파일을 미리 복사 (수동)
#   3. ./deploy-auto.sh 실행
#   4. 번호 선택하면 자동 설정 완료
#
# 주의사항:
#   - .env 파일은 미리 준비해야 합니다
#   - 인스턴스별로 올바른 번호를 선택하세요
##############################################################################

set -e  # 에러 발생 시 즉시 종료

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# 로고 출력
print_logo() {
    echo -e "${CYAN}${BOLD}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║                                                            ║"
    echo "║          ████████╗██████╗ ██╗██████╗ ██╗      █████╗      ║"
    echo "║          ╚══██╔══╝██╔══██╗██║██╔══██╗██║     ██╔══██╗     ║"
    echo "║             ██║   ██████╔╝██║██████╔╝██║     ███████║     ║"
    echo "║             ██║   ██╔══██╗██║██╔═══╝ ██║     ██╔══██║     ║"
    echo "║             ██║   ██║  ██║██║██║     ███████╗██║  ██║     ║"
    echo "║             ╚═╝   ╚═╝  ╚═╝╚═╝╚═╝     ╚══════╝╚═╝  ╚═╝     ║"
    echo "║                                                            ║"
    echo "║              Automated Deployment Script v1.0             ║"
    echo "║                                                            ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# 진행 상황 출력
print_step() {
    echo -e "\n${BLUE}${BOLD}[$(date '+%H:%M:%S')] ▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}${BOLD}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}${BOLD}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}${BOLD}✗ $1${NC}"
}

# 인스턴스 선택 메뉴
select_instance() {
    echo -e "\n${BOLD}${CYAN}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}${CYAN}  이 서버의 역할을 선택하세요 (번호 입력)${NC}"
    echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════${NC}\n"

    echo -e "${BOLD} 1)${NC} ${GREEN}Nginx${NC}        - 리버스 프록시 (Entry Point)"
    echo -e "${BOLD} 2)${NC} ${GREEN}Frontend${NC}     - Next.js UI 서버"
    echo -e "${BOLD} 3)${NC} ${GREEN}Backend${NC}      - Django REST API (Gunicorn)"
    echo -e "${BOLD} 4)${NC} ${GREEN}WebSocket${NC}    - Django WebSocket (Daphne)"
    echo -e "${BOLD} 5)${NC} ${GREEN}Redis${NC}        - 캐시 및 메시지 브로커"
    echo -e "${BOLD} 6)${NC} ${GREEN}PostgreSQL${NC}   - 메인 데이터베이스 (pgvector)"
    echo -e "${BOLD} 7)${NC} ${GREEN}Airflow${NC}      - RAG 데이터 파이프라인"
    echo -e "${BOLD} 0)${NC} ${RED}종료${NC}\n"

    read -p "$(echo -e ${BOLD}선택: ${NC})" choice
    echo ""

    case $choice in
        1) INSTANCE_TYPE="nginx" ;;
        2) INSTANCE_TYPE="frontend" ;;
        3) INSTANCE_TYPE="backend" ;;
        4) INSTANCE_TYPE="websocket" ;;
        5) INSTANCE_TYPE="redis" ;;
        6) INSTANCE_TYPE="postgres" ;;
        7) INSTANCE_TYPE="airflow" ;;
        0)
            echo -e "${YELLOW}종료합니다.${NC}"
            exit 0
            ;;
        *)
            print_error "잘못된 선택입니다. 1-7 또는 0을 입력하세요."
            exit 1
            ;;
    esac
}

# .env 파일 확인
check_env_file() {
    print_step ".env 파일 확인 중..."

    if [ ! -f ".env" ]; then
        print_error ".env 파일이 없습니다!"
        echo -e "\n${YELLOW}다음 단계를 따라주세요:${NC}"
        echo "  1. .env.aws.example을 복사하여 .env 파일 생성"
        echo "  2. .env 파일의 IP 주소를 실제 AWS IP로 수정"
        echo "  3. 다시 이 스크립트를 실행"
        echo ""
        echo -e "${CYAN}명령어:${NC}"
        echo "  cp .env.aws.example .env"
        echo "  nano .env  # 또는 vi .env"
        exit 1
    fi

    print_success ".env 파일 발견"
}

# Docker 및 Docker Compose 설치 확인
check_docker() {
    print_step "Docker 설치 확인 중..."

    if ! command -v docker &> /dev/null; then
        print_warning "Docker가 설치되어 있지 않습니다. 설치를 시작합니다..."

        # Docker 설치
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh
        sudo usermod -aG docker $USER
        rm get-docker.sh

        print_success "Docker 설치 완료"
    else
        print_success "Docker가 이미 설치되어 있습니다 ($(docker --version))"
    fi

    # Docker Compose 확인
    if ! command -v docker-compose &> /dev/null; then
        print_warning "Docker Compose가 설치되어 있지 않습니다. 설치를 시작합니다..."

        sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose

        print_success "Docker Compose 설치 완료"
    else
        print_success "Docker Compose가 이미 설치되어 있습니다 ($(docker-compose --version))"
    fi
}

# Git repository 클론 또는 업데이트
setup_repository() {
    print_step "Git repository 설정 중..."

    REPO_URL="https://github.com/YOUR_USERNAME/SKN15-FINAL-2TEAM.git"  # TODO: 실제 URL로 변경
    TARGET_DIR="$HOME/triplan"

    if [ -d "$TARGET_DIR" ]; then
        print_warning "기존 프로젝트 발견. 업데이트를 시작합니다..."
        cd "$TARGET_DIR"
        git pull origin main
        print_success "프로젝트 업데이트 완료"
    else
        print_step "프로젝트를 클론합니다..."
        git clone "$REPO_URL" "$TARGET_DIR"
        cd "$TARGET_DIR"
        print_success "프로젝트 클론 완료"
    fi
}

# 1. Nginx 인스턴스 배포
deploy_nginx() {
    print_step "Nginx 인스턴스 배포 중..."

    # docker-compose.nginx.yml 생성
    cat > docker-compose.nginx.yml <<'EOF'

services:
  nginx:
    image: nginx:alpine
    container_name: triplan-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    restart: always
    networks:
      - triplan-network

networks:
  triplan-network:
    driver: bridge
EOF

    # Nginx 설정 파일 확인 및 생성
    if [ ! -f "nginx/nginx.conf" ]; then
        print_error "nginx/nginx.conf 파일이 없습니다!"
        exit 1
    fi

    # Docker Compose로 실행
    sudo docker-compose -f docker-compose.nginx.yml up -d

    print_success "Nginx 배포 완료"
    print_success "접속 주소: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"
}

# 2. Frontend 인스턴스 배포
deploy_frontend() {
    print_step "Frontend 인스턴스 배포 중..."

    # Node.js 설치 확인
    if ! command -v node &> /dev/null; then
        print_warning "Node.js가 설치되어 있지 않습니다. 설치를 시작합니다..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
        print_success "Node.js 설치 완료"
    fi

    # docker-compose.frontend.yml 생성
    cat > docker-compose.frontend.yml <<'EOF'

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: triplan-frontend
    ports:
      - "3000:3000"
    env_file:
      - .env
    restart: always
    networks:
      - triplan-network

networks:
  triplan-network:
    driver: bridge
EOF

    # 빌드 및 실행
    sudo docker-compose -f docker-compose.frontend.yml up -d --build

    print_success "Frontend 배포 완료"
    print_success "Frontend 포트: 3000"
}

# 3. Backend 인스턴스 배포
deploy_backend() {
    print_step "Backend 인스턴스 배포 중..."

    # docker-compose.backend.yml 생성
    cat > docker-compose.backend.yml <<'EOF'
services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: triplan-backend
    ports:
      - "8000:8000"
    env_file:
      - .env
    command: gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 4
    restart: always
    networks:
      - triplan-network

networks:
  triplan-network:
    driver: bridge
EOF

    # 빌드 및 실행
    sudo docker-compose -f docker-compose.backend.yml up -d --build

    # 마이그레이션 실행
    print_step "데이터베이스 마이그레이션 실행 중..."
    sudo docker-compose -f docker-compose.backend.yml exec backend python manage.py migrate

    print_success "Backend 배포 완료"
    print_success "Backend API 포트: 8000"
}

# 4. WebSocket 인스턴스 배포
deploy_websocket() {
    print_step "WebSocket 인스턴스 배포 중..."

    # docker-compose.websocket.yml 생성
    cat > docker-compose.websocket.yml <<'EOF'
services:
  websocket:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: triplan-websocket
    ports:
      - "8001:8001"
    env_file:
      - .env
    command: daphne -b 0.0.0.0 -p 8001 config.asgi:application
    restart: always
    networks:
      - triplan-network

networks:
  triplan-network:
    driver: bridge
EOF

    # 빌드 및 실행
    sudo docker-compose -f docker-compose.websocket.yml up -d --build

    print_success "WebSocket 배포 완료"
    print_success "WebSocket 포트: 8001"
}

# 5. Redis 인스턴스 배포
deploy_redis() {
    print_step "Redis 인스턴스 배포 중..."

    # docker-compose.redis.yml 생성
    cat > docker-compose.redis.yml <<'EOF'

services:
  redis:
    image: redis:7-alpine
    container_name: triplan-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    restart: always
    networks:
      - triplan-network

volumes:
  redis_data:

networks:
  triplan-network:
    driver: bridge
EOF

    # 실행
    sudo docker-compose -f docker-compose.redis.yml up -d

    print_success "Redis 배포 완료"
    print_success "Redis 포트: 6379"
}

# 6. PostgreSQL 인스턴스 배포
deploy_postgres() {
    print_step "PostgreSQL 인스턴스 배포 중..."

    # docker-compose.postgres.yml 생성
    cat > docker-compose.postgres.yml <<'EOF'

services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: triplan-postgres
    ports:
      - "5432:5432"
    env_file:
      - .env
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: always
    networks:
      - triplan-network

volumes:
  postgres_data:

networks:
  triplan-network:
    driver: bridge
EOF

    # 실행
    sudo docker-compose -f docker-compose.postgres.yml up -d

    # pgvector 확장 설치 확인
    sleep 5
    print_step "pgvector 확장 설치 확인 중..."
    sudo docker-compose -f docker-compose.postgres.yml exec -T postgres psql -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-lecun2} -c "CREATE EXTENSION IF NOT EXISTS vector;"

    print_success "PostgreSQL 배포 완료"
    print_success "PostgreSQL 포트: 5432"
}

# 7. Airflow 인스턴스 배포
deploy_airflow() {
    print_step "Airflow 인스턴스 배포 중..."

    # Airflow 디렉토리 생성 및 권한 설정
    print_step "Airflow 디렉토리 설정 중..."
    mkdir -p airflow/dags airflow/logs airflow/plugins

    # Airflow가 사용할 로그 디렉토리 권한 설정 (UID 50000은 Airflow 기본 사용자)
    sudo chown -R 50000:50000 airflow/logs 2>/dev/null || chmod -R 777 airflow/logs

    # docker-compose.airflow.yml 생성
    cat > docker-compose.airflow.yml <<'EOF'
version: '3.8'

services:
  # Airflow Postgres (Airflow 메타데이터용)
  airflow-postgres:
    image: postgres:15-alpine
    container_name: triplan-airflow-db
    environment:
      POSTGRES_DB: airflow
      POSTGRES_USER: airflow
      POSTGRES_PASSWORD: ${AIRFLOW_POSTGRES_PASSWORD:-airflow}
    volumes:
      - ./data/airflow-postgres:/var/lib/postgresql/data
    restart: unless-stopped
    networks:
      - triplan-network

  # Airflow Webserver
  airflow-webserver:
    build:
      context: ./airflow
      dockerfile: Dockerfile
    container_name: triplan-airflow-webserver
    command: webserver
    environment:
      - AIRFLOW__CORE__EXECUTOR=LocalExecutor
      - AIRFLOW__CORE__SQL_ALCHEMY_CONN=postgresql+psycopg2://airflow:${AIRFLOW_POSTGRES_PASSWORD:-airflow}@airflow-postgres/airflow
      - AIRFLOW__CORE__FERNET_KEY=${AIRFLOW_FERNET_KEY}
      - AIRFLOW__CORE__LOAD_EXAMPLES=False
      - AIRFLOW__WEBSERVER__SECRET_KEY=${AIRFLOW_WEBSERVER_SECRET_KEY}
      - AIRFLOW_WWW_USER_USERNAME=${AIRFLOW_USERNAME:-admin}
      - AIRFLOW_WWW_USER_PASSWORD=${AIRFLOW_PASSWORD:-admin}
      - MAIN_DATABASE_URL=${DATABASE_URL}
    volumes:
      - ./airflow/dags:/opt/airflow/dags
      - ./airflow/logs:/opt/airflow/logs
      - ./airflow/plugins:/opt/airflow/plugins
      - ./airflow/scripts:/opt/airflow/scripts
      - ./data/airflow-data:/opt/airflow/data
    ports:
      - "8080:8080"
    depends_on:
      - airflow-postgres
    restart: unless-stopped
    networks:
      - triplan-network

  # Airflow Scheduler
  airflow-scheduler:
    build:
      context: ./airflow
      dockerfile: Dockerfile
    container_name: triplan-airflow-scheduler
    command: scheduler
    environment:
      - AIRFLOW__CORE__EXECUTOR=LocalExecutor
      - AIRFLOW__CORE__SQL_ALCHEMY_CONN=postgresql+psycopg2://airflow:${AIRFLOW_POSTGRES_PASSWORD:-airflow}@airflow-postgres/airflow
      - AIRFLOW__CORE__FERNET_KEY=${AIRFLOW_FERNET_KEY}
      - AIRFLOW__CORE__LOAD_EXAMPLES=False
      - MAIN_DATABASE_URL=${DATABASE_URL}
    volumes:
      - ./airflow/dags:/opt/airflow/dags
      - ./airflow/logs:/opt/airflow/logs
      - ./airflow/plugins:/opt/airflow/plugins
      - ./airflow/scripts:/opt/airflow/scripts
      - ./data/airflow-data:/opt/airflow/data
    depends_on:
      - airflow-postgres
    restart: unless-stopped
    networks:
      - triplan-network

networks:
  triplan-network:
    driver: bridge
EOF

    # 빌드 및 실행
    print_step "Airflow 컨테이너 시작 중..."
    sudo docker-compose -f docker-compose.airflow.yml up -d --build

    # 컨테이너가 완전히 시작될 때까지 대기
    print_step "Airflow 시작 대기 중..."
    sleep 10

    # Airflow 초기화 (DB 및 사용자 생성)
    print_step "Airflow 초기화 중..."

    # DB 초기화
    sudo docker-compose -f docker-compose.airflow.yml exec -T airflow-webserver airflow db init 2>/dev/null || \
        print_warning "Airflow DB는 이미 초기화되어 있습니다."

    # Admin 사용자 생성 (이미 존재하면 스킵)
    sudo docker-compose -f docker-compose.airflow.yml exec -T airflow-webserver airflow users create \
        --username ${AIRFLOW_USERNAME:-admin} \
        --password ${AIRFLOW_PASSWORD:-admin} \
        --firstname Admin \
        --lastname User \
        --role Admin \
        --email admin@example.com 2>/dev/null || \
        print_warning "Airflow admin 사용자는 이미 존재합니다."

    print_success "Airflow 배포 완료"
    print_success "Airflow 웹 UI: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):8080"
    print_success "로그인: admin / ${AIRFLOW_PASSWORD:-admin}"
}

# 배포 후 상태 확인
check_deployment_status() {
    print_step "배포 상태 확인 중..."

    echo -e "\n${BOLD}${CYAN}════════════════ 컨테이너 상태 ════════════════${NC}"
    sudo docker ps

    echo -e "\n${BOLD}${CYAN}════════════════ 로그 확인 ════════════════${NC}"
    echo -e "${YELLOW}로그 확인 명령어:${NC}"
    case $INSTANCE_TYPE in
        nginx)      echo "  sudo docker-compose -f docker-compose.nginx.yml logs -f" ;;
        frontend)   echo "  sudo docker-compose -f docker-compose.frontend.yml logs -f" ;;
        backend)    echo "  sudo docker-compose -f docker-compose.backend.yml logs -f" ;;
        websocket)  echo "  sudo docker-compose -f docker-compose.websocket.yml logs -f" ;;
        redis)      echo "  sudo docker-compose -f docker-compose.redis.yml logs -f" ;;
        postgres)   echo "  sudo docker-compose -f docker-compose.postgres.yml logs -f" ;;
        airflow)    echo "  sudo docker-compose -f docker-compose.airflow.yml logs -f" ;;
    esac

    echo -e "\n${BOLD}${CYAN}════════════════ 재시작 명령어 ════════════════${NC}"
    case $INSTANCE_TYPE in
        nginx)      echo "  sudo docker-compose -f docker-compose.nginx.yml restart" ;;
        frontend)   echo "  sudo docker-compose -f docker-compose.frontend.yml restart" ;;
        backend)    echo "  sudo docker-compose -f docker-compose.backend.yml restart" ;;
        websocket)  echo "  sudo docker-compose -f docker-compose.websocket.yml restart" ;;
        redis)      echo "  sudo docker-compose -f docker-compose.redis.yml restart" ;;
        postgres)   echo "  sudo docker-compose -f docker-compose.postgres.yml restart" ;;
        airflow)    echo "  sudo docker-compose -f docker-compose.airflow.yml restart" ;;
    esac
}

# 메인 실행 함수
main() {
    print_logo

    # 인스턴스 선택
    select_instance

    print_step "선택한 인스턴스: ${GREEN}${BOLD}${INSTANCE_TYPE}${NC}"

    # .env 파일 확인
    check_env_file

    # Docker 확인
    check_docker

    # Git repository 설정 (선택사항)
    # setup_repository  # 주석 처리: 이미 코드가 있다고 가정

    # 선택한 인스턴스 배포
    case $INSTANCE_TYPE in
        nginx)      deploy_nginx ;;
        frontend)   deploy_frontend ;;
        backend)    deploy_backend ;;
        websocket)  deploy_websocket ;;
        redis)      deploy_redis ;;
        postgres)   deploy_postgres ;;
        airflow)    deploy_airflow ;;
    esac

    # 배포 상태 확인
    check_deployment_status

    # 완료 메시지
    echo -e "\n${GREEN}${BOLD}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}${BOLD}║                                                            ║${NC}"
    echo -e "${GREEN}${BOLD}║              🎉 배포가 완료되었습니다! 🎉                  ║${NC}"
    echo -e "${GREEN}${BOLD}║                                                            ║${NC}"
    echo -e "${GREEN}${BOLD}╚════════════════════════════════════════════════════════════╝${NC}\n"
}

# 스크립트 실행
main
