"""
Tool Descriptions for Travel Planner Agent
여행 플래너 에이전트 도구 설명 모음

각 도구의 docstring을 중앙에서 관리합니다.
"""

# 📊 조회 도구
GET_PLANNER_INFO = """현재 플래너의 모든 정보를 가져옵니다. 일정을 확인하거나 수정하기 전에 항상 이 도구를 먼저 사용하세요."""

# 📍 장소 추가 도구
ADD_PLACE_TO_DAY = """특정 일차에 장소를 추가합니다. (자동 검증 포함)

⚠️ 중요: 이 도구를 사용하기 전에 반드시 search_place를 먼저 호출하여
정확한 장소명, 주소, 좌표를 확인한 후 사용하세요!

Args:
    day_no: 추가할 일차 (1, 2, 3...)
    place_name: 장소명 (search_place로 검색한 정확한 이름 사용 권장)
    time: 방문 시간 (HH:MM 형식, 예: 09:00, 14:30)
    notes: 메모나 설명

Returns:
    추가 결과 메시지 (주소, 좌표 포함)
"""

# 🔍 장소 검색 도구
SEARCH_PLACE = """장소를 검색합니다. 내부 DB와 카카오맵 양쪽을 검색하여 풍부한 정보를 제공합니다.

Args:
    keyword: 검색할 장소명
    region: 지역 필터 (선택, 예: '서울', '제주')

Returns:
    검색 결과 (JSON 형식) - 이름, 주소, 좌표, 평점, 카테고리 등
"""

GET_PLACE_DETAILS = """특정 장소의 상세 정보를 조회합니다.

Args:
    place_id: 장소 ID (DB의 place_idx 또는 외부 API ID)

Returns:
    장소의 상세 정보 (JSON 형식)
"""

SEARCH_NEARBY = """특정 위치 주변의 장소를 검색합니다.

Args:
    latitude: 위도
    longitude: 경도
    radius: 검색 반경 (미터, 기본값: 1000)
    category: 카테고리 필터 (선택, 예: '식당', '카페', '관광지')

Returns:
    주변 장소 목록 (JSON 형식)
"""

RECOMMEND_PLACES = """인기 장소를 추천합니다.

Args:
    region: 지역 (예: '서울', '제주')
    category: 카테고리 (선택, 예: '관광지', '맛집', '카페')
    limit: 추천 개수 (기본값: 5)

Returns:
    추천 장소 목록 (평점순, JSON 형식)
"""

# ✨ AI 추천 (RAG)
RECOMMEND_SIMILAR_TRIPS = """실제 여행 블로그/영상 데이터를 검색하여 유사한 여행 경로를 추천합니다.

사용자가 "여행지 추천해줘", "유명한 코스 알려줘" 같은 요청을 할 때 사용하세요.
실제 여행자들이 다녀온 구체적인 일정과 장소를 제공합니다.

Args:
    query: 검색 쿼리 (예: "서울 2박3일", "제주도 가족여행")
    top_k: 추천 개수 (기본값: 3)

Returns:
    유사한 여행 경로 목록 (JSON 형식)
"""

RECOMMEND_AND_ADD_TO_PLANNER = """🚀 RAG 추천 결과를 플래너에 자동으로 추가합니다. (통합 도구)

⭐⭐⭐ 가장 강력한 도구! 사용자가 "여행 일정 추천해줘", "코스 짜줘", "일정 채워줘" 등 요청 시 사용!

이 도구는 자동으로:
1. RAG로 실제 여행 데이터 검색 (유사한 여행 경로 찾기)
2. LLM으로 결과 정제 및 최적화 (현재 플래너에 맞게 조정)
3. 플래너에 Day별로 장소 자동 추가 (중복 확인)
4. 사용자에게 추가된 일정 안내

Args:
    query: 검색 쿼리 (예: "서울 맛집 투어", "제주도 자연 여행", "부산 핫플 코스")
    auto_add: 자동 추가 여부 (기본값: True, False면 추천만 제공)
    top_k: RAG 검색 결과 수 (기본값: 3, 많을수록 다양한 추천)

Returns:
    추천 결과 및 플래너 추가 결과 메시지 (추가된 장소 목록 포함)
"""

# 🗑️ 일정 삭제 도구
DELETE_SCHEDULE = """특정 일차의 장소를 삭제합니다.

Args:
    day_no: 일차 번호
    place_name: 삭제할 장소명

Returns:
    삭제 결과 메시지
"""

DELETE_ALL_SCHEDULES = """특정 일차 또는 전체 일정을 삭제합니다.

⚠️ 주의: 삭제된 데이터는 복구할 수 없습니다!

Args:
    day_no: 일차 번호 (None이면 전체 일정 삭제, 숫자면 해당 일차만 삭제)

Returns:
    삭제 결과 메시지
"""

# ✏️ 일정 수정 도구
UPDATE_SCHEDULE = """일정을 수정합니다.

Args:
    day_no: 일차 번호
    old_place: 수정할 장소의 현재 이름
    new_place: 새로운 장소명 (선택)
    new_time: 새로운 시간 (HH:MM 형식, 선택)
    new_notes: 새로운 메모 (선택)

Returns:
    수정 결과 메시지
"""

MOVE_SCHEDULE = """일정을 다른 날짜로 이동합니다.

Args:
    from_day: 현재 일차 번호
    to_day: 이동할 일차 번호
    place_name: 이동할 장소명

Returns:
    이동 결과 메시지
"""

REORDER_SCHEDULE = """일정의 순서를 변경합니다.

Args:
    day_no: 일차 번호
    place_name: 순서를 변경할 장소명
    new_position: 새로운 순서 (1부터 시작)

Returns:
    순서 변경 결과 메시지
"""

# 🏷️ 여행 정보 수정 도구
UPDATE_TRIP_INFO = """여행의 기본 정보를 수정합니다.

Args:
    title: 여행 제목 (선택)
    party_size: 여행 인원 (선택)
    country_idx: 국가 인덱스 (선택)
    region1_idx: 지역 인덱스 (선택)

Returns:
    수정 결과 메시지
"""

UPDATE_TRIP_DATES = """여행 날짜를 변경하고 Day를 자동으로 생성/조정합니다.

날짜 형식을 유연하게 지원합니다:
- YYYY-MM-DD (예: 2025-11-28)
- MM-DD (예: 11-28, 현재 년도 자동 적용)
- M월 D일 (예: 11월 28일, 현재 년도 자동 적용)
- YYYY년 M월 D일 (예: 2025년 11월 28일)

Args:
    start_date: 시작 날짜
    end_date: 종료 날짜

Returns:
    변경 결과 메시지 및 생성된 Day 목록
"""

# 🗺️ 지도 관련 도구
SEARCH_AND_SHOW_ON_MAP = """UI 지도에서 장소를 검색하고 표시합니다. (일정에는 추가하지 않음)

사용자가 "지도에서 보여줘", "어디 있는지 확인하고 싶어" 같은 요청을 할 때 사용하세요.

Args:
    keyword: 검색할 장소명
    region: 지역 필터 (선택)

Returns:
    지도 검색 명령 전송 확인 메시지
"""

SEARCH_ON_MAP_AND_ADD = """🆕 지도에서 장소를 검색하고 일정에도 자동으로 추가합니다. (통합 도구)

⭐ 우선적으로 사용하세요!
사용자가 "Day 1에 경복궁 추가해줘", "남산타워 넣어줘" 같은 요청을 하면 이 도구를 사용하세요!

이 도구는 자동으로:
1. 지도에 장소 검색 표시
2. DB/Kakao에서 정확한 정보 확인
3. 일정에 추가 (주소, 평점 포함)
4. 사용자에게 결과 알림

Args:
    day_no: 추가할 일차 (1, 2, 3...)
    place_name: 장소명
    time: 방문 시간 (HH:MM 형식, 기본값: "09:00")
    notes: 메모 (선택)

Returns:
    추가 결과 메시지 (주소, 좌표, 평점 포함)
"""


def get_tool_description(tool_name: str) -> str:
    """도구 이름으로 설명 가져오기

    Args:
        tool_name: 도구 이름 (예: 'get_planner_info', 'add_place_to_day')

    Returns:
        도구 설명 문자열

    Raises:
        ValueError: 알 수 없는 도구 이름인 경우
    """
    tool_descriptions = {
        'get_planner_info': GET_PLANNER_INFO,
        'add_place_to_day': ADD_PLACE_TO_DAY,
        'search_place': SEARCH_PLACE,
        'get_place_details': GET_PLACE_DETAILS,
        'search_nearby': SEARCH_NEARBY,
        'recommend_places': RECOMMEND_PLACES,
        'recommend_similar_trips': RECOMMEND_SIMILAR_TRIPS,
        'recommend_and_add_to_planner': RECOMMEND_AND_ADD_TO_PLANNER,
        'delete_schedule': DELETE_SCHEDULE,
        'delete_all_schedules': DELETE_ALL_SCHEDULES,
        'update_schedule': UPDATE_SCHEDULE,
        'move_schedule': MOVE_SCHEDULE,
        'reorder_schedule': REORDER_SCHEDULE,
        'update_trip_info': UPDATE_TRIP_INFO,
        'update_trip_dates': UPDATE_TRIP_DATES,
        'search_and_show_on_map': SEARCH_AND_SHOW_ON_MAP,
        'search_on_map_and_add': SEARCH_ON_MAP_AND_ADD,
    }

    if tool_name not in tool_descriptions:
        raise ValueError(f"Unknown tool: {tool_name}. Available tools: {', '.join(tool_descriptions.keys())}")

    return tool_descriptions[tool_name]


def list_all_tools() -> dict:
    """모든 도구와 설명 반환

    Returns:
        {tool_name: description} 딕셔너리
    """
    return {
        'get_planner_info': GET_PLANNER_INFO,
        'add_place_to_day': ADD_PLACE_TO_DAY,
        'search_place': SEARCH_PLACE,
        'get_place_details': GET_PLACE_DETAILS,
        'search_nearby': SEARCH_NEARBY,
        'recommend_places': RECOMMEND_PLACES,
        'recommend_similar_trips': RECOMMEND_SIMILAR_TRIPS,
        'recommend_and_add_to_planner': RECOMMEND_AND_ADD_TO_PLANNER,
        'delete_schedule': DELETE_SCHEDULE,
        'delete_all_schedules': DELETE_ALL_SCHEDULES,
        'update_schedule': UPDATE_SCHEDULE,
        'move_schedule': MOVE_SCHEDULE,
        'reorder_schedule': REORDER_SCHEDULE,
        'update_trip_info': UPDATE_TRIP_INFO,
        'update_trip_dates': UPDATE_TRIP_DATES,
        'search_and_show_on_map': SEARCH_AND_SHOW_ON_MAP,
        'search_on_map_and_add': SEARCH_ON_MAP_AND_ADD,
    }
