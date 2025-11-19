# Triplan AWS Microservices Architecture

## 전체 시스템 아키텍처

```mermaid
graph TB
    subgraph Internet["🌐 Internet"]
        User["👤 User<br/>Browser"]
    end

    subgraph AWS["☁️ AWS Cloud"]
        subgraph VPC["🔒 VPC (Virtual Private Cloud)"]

            subgraph PublicSubnet["📡 Public Subnet"]
                Nginx["🔀 EC2 Instance 1<br/>Nginx Reverse Proxy<br/>Public IP: 43.203.203.121<br/>Port: 80, 443"]
            end

            subgraph PrivateSubnet["🔐 Private Subnet"]
                Frontend["⚛️ EC2 Instance 2<br/>Next.js Frontend<br/>Private IP: 3.34.134.229<br/>Port: 3000"]

                Backend["🐍 EC2 Instance 3<br/>Django Backend API<br/>Private IP: 52.78.244.5<br/>Port: 8000"]

                WebSocket["🔌 EC2 Instance 4<br/>Django WebSocket<br/>Private IP: 52.78.77.9<br/>Port: 8001"]

                Redis["💾 EC2 Instance 5<br/>Redis Cache<br/>Private IP: 54.180.88.160<br/>Port: 6379"]

                PostgreSQL["🗄️ EC2 Instance 6<br/>PostgreSQL + pgvector<br/>Private IP: 13.124.104.187<br/>Port: 5432"]

                Airflow["📊 EC2 Instance 7<br/>Apache Airflow<br/>Private IP: 52.79.182.97<br/>Port: 8080"]
            end
        end

        subgraph ExternalServices["🌍 External Services"]
            OpenAI["🤖 OpenAI API<br/>GPT-4o-mini"]
            KakaoMap["🗺️ Kakao Map API"]
        end
    end

    %% User connections
    User -->|HTTP/HTTPS<br/>Port 80/443| Nginx

    %% Nginx routing
    Nginx -->|Proxy Pass<br/>Port 3000| Frontend
    Nginx -->|API Requests<br/>Port 8000| Backend
    Nginx -->|WebSocket<br/>Port 8001| WebSocket

    %% Frontend connections
    Frontend -->|API Calls| Backend
    Frontend -->|Real-time WS| WebSocket

    %% Backend connections
    Backend -->|Database Queries| PostgreSQL
    Backend -->|Cache R/W| Redis
    Backend -->|AI Requests| OpenAI
    Backend -->|Map Data| KakaoMap
    Backend -->|Async Tasks| Redis

    %% WebSocket connections
    WebSocket -->|Channel Layer| Redis
    WebSocket -->|Database Queries| PostgreSQL

    %% Airflow connections
    Airflow -->|ETL Jobs| PostgreSQL
    Airflow -->|Data Pipeline| Backend

    %% Styling
    classDef publicNode fill:#e1f5ff,stroke:#01579b,stroke-width:3px,color:#000
    classDef privateNode fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#000
    classDef dbNode fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000
    classDef externalNode fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px,color:#000

    class Nginx publicNode
    class Frontend,Backend,WebSocket,Airflow privateNode
    class Redis,PostgreSQL dbNode
    class OpenAI,KakaoMap externalNode
```

---

## 상세 데이터 흐름

```mermaid
sequenceDiagram
    actor User
    participant Nginx as Nginx<br/>(Entry Point)
    participant Frontend as Next.js
    participant Backend as Django API
    participant WebSocket as Django WS
    participant Redis as Redis
    participant PostgreSQL as PostgreSQL
    participant OpenAI as OpenAI API

    User->>Nginx: 1. HTTP Request (Port 80)
    Nginx->>Frontend: 2. Forward to Frontend (Port 3000)
    Frontend->>User: 3. Return HTML/JS/CSS

    User->>Nginx: 4. API Request (/api/*)
    Nginx->>Backend: 5. Proxy to Backend (Port 8000)
    Backend->>Redis: 6. Check Cache

    alt Cache Hit
        Redis-->>Backend: 7a. Return Cached Data
    else Cache Miss
        Backend->>PostgreSQL: 7b. Query Database
        PostgreSQL-->>Backend: 8. Return Data
        Backend->>Redis: 9. Store in Cache
    end

    Backend->>OpenAI: 10. AI Request (GPT-4o-mini)
    OpenAI-->>Backend: 11. AI Response

    Backend-->>Nginx: 12. JSON Response
    Nginx-->>User: 13. Return to Client

    User->>Nginx: 14. WebSocket Connection
    Nginx->>WebSocket: 15. Upgrade to WebSocket (Port 8001)
    WebSocket->>Redis: 16. Subscribe to Channel
    WebSocket-->>User: 17. Real-time Updates
```

---

## 보안 그룹 설정

```mermaid
graph LR
    subgraph SG1["🛡️ Nginx Security Group"]
        direction TB
        IN1["Inbound:<br/>- HTTP (80): 0.0.0.0/0<br/>- HTTPS (443): 0.0.0.0/0<br/>- SSH (22): My IP"]
        OUT1["Outbound:<br/>- All Traffic"]
    end

    subgraph SG2["🛡️ Frontend Security Group"]
        direction TB
        IN2["Inbound:<br/>- Port 3000: Nginx SG<br/>- SSH (22): My IP"]
        OUT2["Outbound:<br/>- All Traffic"]
    end

    subgraph SG3["🛡️ Backend/WebSocket SG"]
        direction TB
        IN3["Inbound:<br/>- Port 8000: Nginx SG<br/>- Port 8001: Nginx SG<br/>- SSH (22): My IP"]
        OUT3["Outbound:<br/>- All Traffic"]
    end

    subgraph SG4["🛡️ Database Security Group"]
        direction TB
        IN4["Inbound:<br/>- Port 5432: Backend SG<br/>- Port 6379: Backend SG<br/>- SSH (22): My IP"]
        OUT4["Outbound:<br/>- All Traffic"]
    end

    SG1 --> SG2
    SG1 --> SG3
    SG3 --> SG4
```

---

## Docker 컨테이너 구성

```mermaid
graph TB
    subgraph EC2-1["EC2 Instance 1 - Nginx"]
        D1["docker-compose.nginx.yml"]
        C1["triplan-nginx<br/>(nginx:alpine)"]
        V1["Volumes:<br/>- static/<br/>- media/"]
        D1 --> C1
        C1 --> V1
    end

    subgraph EC2-2["EC2 Instance 2 - Frontend"]
        D2["docker-compose.frontend.yml"]
        C2["triplan-frontend<br/>(node:20-alpine)"]
        V2["Env:<br/>- NEXT_PUBLIC_API_URL<br/>- NEXT_PUBLIC_WS_URL"]
        D2 --> C2
        C2 --> V2
    end

    subgraph EC2-3["EC2 Instance 3 - Backend"]
        D3["docker-compose.backend.yml"]
        C3["triplan-backend<br/>(python:3.11-slim)"]
        CMD3["gunicorn config.wsgi"]
        V3["Env:<br/>- DATABASE_URL<br/>- REDIS_URL<br/>- OPENAI_API_KEY"]
        D3 --> C3
        C3 --> CMD3
        C3 --> V3
    end

    subgraph EC2-4["EC2 Instance 4 - WebSocket"]
        D4["docker-compose.websocket.yml"]
        C4["triplan-websocket<br/>(python:3.11-slim)"]
        CMD4["daphne config.asgi"]
        V4["Env:<br/>- DATABASE_URL<br/>- REDIS_URL"]
        D4 --> C4
        C4 --> CMD4
        C4 --> V4
    end

    subgraph EC2-5["EC2 Instance 5 - Redis"]
        D5["docker-compose.redis.yml"]
        C5["triplan-redis<br/>(redis:7-alpine)"]
        V5["Volume:<br/>- ./data/redis:/data"]
        D5 --> C5
        C5 --> V5
    end

    subgraph EC2-6["EC2 Instance 6 - PostgreSQL"]
        D6["docker-compose.postgres.yml"]
        C6["triplan-postgres<br/>(pgvector/pgvector:pg16)"]
        V6["Volume:<br/>- ./data/postgres:/var/lib/postgresql/data"]
        D6 --> C6
        C6 --> V6
    end

    subgraph EC2-7["EC2 Instance 7 - Airflow"]
        D7["docker-compose.airflow.yml"]
        C7A["triplan-airflow-webserver"]
        C7B["triplan-airflow-scheduler"]
        C7C["triplan-airflow-postgres"]
        D7 --> C7A
        D7 --> C7B
        D7 --> C7C
    end

    classDef docker fill:#2496ed,stroke:#1d7bb8,color:#fff
    classDef container fill:#4caf50,stroke:#388e3c,color:#fff
    classDef config fill:#ff9800,stroke:#f57c00,color:#000

    class D1,D2,D3,D4,D5,D6,D7 docker
    class C1,C2,C3,C4,C5,C6,C7A,C7B,C7C container
    class V1,V2,V3,V4,V5,V6,CMD3,CMD4 config
```

---

## 배포 흐름

```mermaid
graph LR
    A["1️⃣ Git Clone"] --> B["2️⃣ .env 설정"]
    B --> C["3️⃣ deploy-instance.sh 실행"]
    C --> D["4️⃣ Docker 설치"]
    D --> E["5️⃣ Docker Compose 빌드"]
    E --> F["6️⃣ 컨테이너 실행"]
    F --> G["7️⃣ 헬스체크"]

    G -->|Success| H["✅ 배포 완료"]
    G -->|Fail| I["🔄 로그 확인 & 재배포"]
    I --> E

    style A fill:#e3f2fd
    style B fill:#fff3e0
    style C fill:#f3e5f5
    style D fill:#e8f5e9
    style E fill:#fce4ec
    style F fill:#e0f2f1
    style G fill:#fff9c4
    style H fill:#c8e6c9
    style I fill:#ffcdd2
```

---

## 기술 스택

| 계층 | 기술 | 버전 | 용도 |
|------|------|------|------|
| **Infrastructure** | AWS EC2 | - | 컴퓨팅 리소스 |
| **Reverse Proxy** | Nginx | Alpine | 라우팅, SSL, 정적 파일 서빙 |
| **Frontend** | Next.js | 14 | SSR React 앱 |
| **Backend API** | Django | 5.0 | REST API |
| **WebSocket** | Django Channels + Daphne | 4.0 | 실시간 통신 |
| **Database** | PostgreSQL + pgvector | 16 | 메인 DB + 벡터 검색 |
| **Cache** | Redis | 7 | 캐시 + 채널 레이어 |
| **Workflow** | Apache Airflow | 2.7 | 데이터 파이프라인 |
| **Container** | Docker + Docker Compose | - | 컨테이너화 |
| **AI** | OpenAI GPT-4o-mini | - | 자연어 처리 |
| **Map** | Kakao Map API | - | 지도 서비스 |

---

## 환경변수 설정

각 인스턴스별 `.env` 파일:

### Nginx (Instance 1)
```bash
FRONTEND_HOST=3.34.134.229
BACKEND_HOST=52.78.244.5
WEBSOCKET_HOST=52.78.77.9
```

### Frontend (Instance 2)
```bash
NEXT_PUBLIC_API_URL=http://43.203.203.121
NEXT_PUBLIC_WS_URL=ws://43.203.203.121
NEXT_PUBLIC_KAKAO_API_KEY=your-key
```

### Backend/WebSocket (Instance 3, 4)
```bash
DATABASE_URL=postgresql://postgres:password@13.124.104.187:5432/lecun2
REDIS_URL=redis://54.180.88.160:6379/0
OPENAI_API_KEY=sk-proj-***
ALLOWED_HOSTS=43.203.203.121,localhost
CORS_ALLOWED_ORIGINS=http://43.203.203.121,http://localhost:3000
```

### PostgreSQL (Instance 6)
```bash
POSTGRES_DB=lecun2
POSTGRES_USER=postgres
POSTGRES_PASSWORD=lecun123!@#
```

### Redis (Instance 5)
```bash
# No special env required
```

### Airflow (Instance 7)
```bash
AIRFLOW_USERNAME=admin
AIRFLOW_PASSWORD=admin
AIRFLOW_FERNET_KEY=***
DATABASE_URL=postgresql://postgres:password@13.124.104.187:5432/lecun2
```

---

## 배포 순서

1. **PostgreSQL (6번)** - 데이터베이스 먼저 실행
2. **Redis (5번)** - 캐시/채널 레이어
3. **Backend (3번)** - API 서버
4. **WebSocket (4번)** - 실시간 통신 서버
5. **Frontend (2번)** - Next.js 앱
6. **Nginx (1번)** - 리버스 프록시 (마지막!)
7. **Airflow (7번)** - 데이터 파이프라인 (선택)

---

## 접속 주소

- **사용자 접속**: http://43.203.203.121
- **Airflow 대시보드**: http://52.79.182.97:8080

---

## 모니터링

각 인스턴스에서:

```bash
# 컨테이너 상태 확인
docker-compose -f docker-compose.{service}.yml ps

# 로그 확인
docker-compose -f docker-compose.{service}.yml logs -f

# 리소스 사용량
docker stats
```

---

## 트러블슈팅

### Nginx 연결 실패
- `.env`에서 `BACKEND_HOST`, `FRONTEND_HOST` IP 확인
- 보안 그룹에서 해당 포트 오픈 확인

### Database 연결 실패
- `DATABASE_URL`의 IP 주소 확인
- PostgreSQL 인스턴스 실행 상태 확인
- 보안 그룹에서 5432 포트 확인

### 디스크 용량 부족
```bash
docker system prune -a --volumes
docker builder prune -a
```

---

생성일: 2025-10-22
