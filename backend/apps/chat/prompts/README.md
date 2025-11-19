# Travel Planner Agent Prompts

이 디렉토리는 여행 플래너 챗봇 에이전트의 시스템 프롬프트를 버전별로 관리합니다.

## 디렉토리 구조

```
prompts/
├── __init__.py      # 프롬프트 로더 (버전 선택)
├── v1.py           # 프롬프트 버전 1
├── v2.py           # 프롬프트 버전 2 (예정)
└── README.md       # 이 파일
```

## 사용 방법

### 1. 기본 사용 (현재 버전)

```python
from apps.chat.prompts import get_system_prompt

# 현재 활성화된 버전의 프롬프트 가져오기
prompt = get_system_prompt(trip_id=123, room_id=456)
```

### 2. 특정 버전 사용

```python
from apps.chat.prompts import get_system_prompt

# 특정 버전 지정
prompt = get_system_prompt(trip_id=123, room_id=456, version="v1")
```

### 3. 직접 import

```python
from apps.chat.prompts.v1 import get_system_prompt

prompt = get_system_prompt(trip_id=123, room_id=456)
```

## 새 버전 추가하기

### Step 1: 새 버전 파일 생성

`v2.py` 파일을 생성하고 프롬프트 함수를 정의합니다:

```python
# v2.py
"""
Travel Planner Agent System Prompt - Version 2
여행 플래너 에이전트 시스템 프롬프트 - 버전 2

History:
- v2 (2025-01-XX): 새로운 기능 추가
"""

def get_system_prompt(trip_id: int, room_id: int) -> str:
    return f"""당신은 전문 여행 플래너 비서입니다.

    ... 새로운 프롬프트 내용 ...
    """
```

### Step 2: `__init__.py`에 등록

```python
from .v1 import get_system_prompt as get_system_prompt_v1
from .v2 import get_system_prompt as get_system_prompt_v2  # 추가

# 현재 활성 버전 변경
CURRENT_VERSION = "v2"  # v1 → v2로 변경

def get_system_prompt(trip_id: int, room_id: int, version: str = None) -> str:
    if version is None:
        version = CURRENT_VERSION

    if version == "v1":
        return get_system_prompt_v1(trip_id, room_id)
    elif version == "v2":
        return get_system_prompt_v2(trip_id, room_id)  # 추가
    else:
        raise ValueError(f"Unknown prompt version: {version}")
```

### Step 3: 백엔드 재시작

```bash
docker-compose restart backend
```

## 버전 히스토리

### v1 (2025-01-05)
- 초기 버전
- RAG 기반 여행 경로 추천 지원
- 15개 도구 (장소 검색, 일정 관리, 여행 정보 수정)
- 2025년 날짜 자동 처리

## 프롬프트 작성 가이드

### 1. 명확한 역할 정의
- 에이전트의 역할과 책임을 명확히 정의
- 사용자 경험을 최우선으로 고려

### 2. 도구 설명
- 각 도구의 이름, 기능, 사용 시점을 명확히 설명
- 카테고리별로 그룹화 (조회, 수정, 검색, 추천 등)

### 3. 규칙 및 가이드라인
- 반드시 지켜야 할 규칙 명시
- 예외 상황 처리 방법 설명
- 날짜, 시간 등 특수 형식 처리 방법

### 4. 예시 포함
- 실제 사용 예시를 포함하여 이해도 향상
- 입력/출력 형식 예시

### 5. 버전 정보 관리
- 각 파일 상단에 버전 히스토리 작성
- 변경 사항을 명확히 기록

## A/B 테스트

서로 다른 프롬프트의 성능을 비교하려면:

```python
# Agent 초기화 시 버전 지정
agent1 = TravelPlannerAgent(room_id, trip_id, prompt_version="v1")
agent2 = TravelPlannerAgent(room_id, trip_id, prompt_version="v2")

# ChatRequest 테이블에서 성능 분석
# - execution_time_ms (응답 속도)
# - tools_used (도구 사용 패턴)
# - success (성공률)
```

## 환경변수로 버전 관리

`.env` 파일에 프롬프트 버전을 추가할 수도 있습니다:

```bash
# .env
CHAT_AGENT_PROMPT_VERSION=v1
```

```python
# settings/base.py
CHAT_AGENT_PROMPT_VERSION = env('CHAT_AGENT_PROMPT_VERSION', default='v1')

# agent.py
prompt = get_system_prompt(
    trip_id=self.trip_id,
    room_id=self.room_id,
    version=settings.CHAT_AGENT_PROMPT_VERSION
)
```

## 주의사항

1. **프롬프트 길이**: 너무 길면 토큰 비용 증가 및 성능 저하
2. **명확성**: 애매한 표현보다는 명확한 지시문 사용
3. **테스트**: 프롬프트 변경 후 반드시 여러 시나리오로 테스트
4. **버전 관리**: 이전 버전은 삭제하지 말고 유지 (롤백 가능하도록)

## 참고 자료

- [LangChain Prompt Templates](https://python.langchain.com/docs/modules/model_io/prompts/)
- [OpenAI Best Practices](https://platform.openai.com/docs/guides/prompt-engineering)
- [Anthropic Prompt Engineering](https://docs.anthropic.com/claude/docs/prompt-engineering)
