# Agent.py 프롬프트 리팩토링 가이드

이 가이드는 agent.py의 하드코딩된 docstring을 tool_descriptions.py로 분리하는 방법을 설명합니다.

## ✅ 완료된 작업

1. `/backend/apps/chat/prompts/tool_descriptions.py` 생성
   - 모든 도구의 docstring을 중앙 관리
   - `get_tool_description(tool_name)` 함수로 접근
   - `list_all_tools()` 함수로 전체 목록 조회 가능

## 🔧 agent.py 수정 방법

### 기존 코드 (Before):
```python
@tool
def get_planner_info() -> str:
    """현재 플래너의 모든 정보를 가져옵니다. 일정을 확인하거나 수정하기 전에 항상 이 도구를 먼저 사용하세요."""
    from apps.plans.models import TripPlan, TripDay, TripItem

    try:
        trip = TripPlan.objects.get(trip_idx=trip_id)
        # ... 구현 코드 ...
```

### 새로운 코드 (After):
```python
from .prompts.tool_descriptions import get_tool_description

@tool
def get_planner_info() -> str:
    # docstring은 tool_descriptions.py에서 가져옴
    pass

# tool 데코레이터 적용 후 docstring 주입
get_planner_info.__doc__ = get_tool_description('get_planner_info')

# 실제 구현 (원래 코드)
def _impl_get_planner_info():
    from apps.plans.models import TripPlan, TripDay, TripItem

    try:
        trip = TripPlan.objects.get(trip_idx=trip_id)
        # ... 구현 코드 ...
```

**또는 더 간단한 방법:**

```python
from .prompts.tool_descriptions import get_tool_description

@tool
def get_planner_info() -> str:
    from apps.plans.models import TripPlan, TripDay, TripItem

    try:
        trip = TripPlan.objects.get(trip_idx=trip_id)
        # ... 구현 코드 ...

# 각 도구 정의 직후에 docstring만 교체
get_planner_info.__doc__ = get_tool_description('get_planner_info')
```

## 📝 전체 도구 목록

agent.py에서 수정해야 할 도구들:

1. `get_planner_info` ✅ (tool_descriptions.py에 정의됨)
2. `add_place_to_day` ✅
3. `search_place` ✅
4. `get_place_details` ✅
5. `search_nearby` ✅
6. `recommend_places` ✅
7. `recommend_similar_trips` ✅
8. `delete_schedule` ✅
9. `delete_all_schedules` ✅
10. `update_schedule` ✅
11. `move_schedule` ✅
12. `reorder_schedule` ✅
13. `update_trip_info` ✅
14. `update_trip_dates` ✅
15. `search_and_show_on_map` ✅
16. `search_on_map_and_add` ✅

## 🎯 수정 템플릿

agent.py의 `_create_tools()` 메서드 시작 부분에 추가:

```python
def _create_tools(self):
    """Agent가 사용할 도구들"""
    from .prompts.tool_descriptions import get_tool_description

    trip_id = self.trip_id  # Closure로 캡처

    # 각 도구 정의...
```

각 도구 정의 바로 다음에 추가:

```python
    @tool
    def 도구명() -> str:
        # 기존 구현 코드...

    # docstring을 tool_descriptions.py에서 주입
    도구명.__doc__ = get_tool_description('도구명')
```

## ✨ 장점

1. **중앙 관리**: 모든 프롬프트를 한 곳에서 관리
2. **버전 관리**: Git으로 프롬프트 변경 이력 추적 용이
3. **재사용성**: 다른 곳에서도 동일한 설명 사용 가능
4. **가독성**: agent.py가 더 간결해짐
5. **A/B 테스트**: 프롬프트 변경만으로 성능 비교 가능

## 🚀 적용 방법

### 옵션 1: 수동 적용 (권장)
1. agent.py 파일 열기
2. `_create_tools()` 메서드 시작에 import 추가
3. 각 도구 정의 후 `__doc__` 주입 코드 추가
4. 기존 docstring 제거 (선택사항)

### 옵션 2: 자동 스크립트 (고급)
```bash
# 자동 리팩토링 스크립트 실행
python manage.py refactor_agent_prompts
```

## 📊 변경 전후 비교

### Before (agent.py):
- 파일 크기: ~1300 줄
- docstring: 각 도구에 하드코딩
- 수정: agent.py를 직접 수정해야 함

### After:
- agent.py: ~1150 줄 (더 간결)
- tool_descriptions.py: ~250 줄 (별도 관리)
- 수정: tool_descriptions.py만 수정하면 됨

## 🔄 테스트

수정 후 테스트:

```bash
# Backend 재시작
docker-compose restart backend websocket

# 채팅봇 테스트
# "플래너 정보 알려줘" → get_planner_info 도구가 정상 작동하는지 확인
# "경복궁 추가해줘" → add_place_to_day 도구가 정상 작동하는지 확인
```

## 📚 참고

- [tool_descriptions.py](/backend/apps/chat/prompts/tool_descriptions.py)
- [v1.py](/backend/apps/chat/prompts/v1.py) - 시스템 프롬프트
- [README.md](/backend/apps/chat/prompts/README.md) - 프롬프트 관리 가이드
