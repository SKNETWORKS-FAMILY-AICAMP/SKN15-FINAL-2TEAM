"""
Chat Agent Prompts Package
프롬프트 버전 관리를 위한 패키지
"""

from .v1 import get_system_prompt as get_system_prompt_v1

# 현재 활성 프롬프트 버전
CURRENT_VERSION = "v1"

def get_system_prompt(trip_id: int, room_id: int, version: str = None) -> str:
    """
    시스템 프롬프트 가져오기

    Args:
        trip_id: 여행 ID
        room_id: 채팅방 ID
        version: 프롬프트 버전 (기본값: CURRENT_VERSION)

    Returns:
        시스템 프롬프트 문자열
    """
    if version is None:
        version = CURRENT_VERSION

    if version == "v1":
        return get_system_prompt_v1(trip_id, room_id)
    else:
        raise ValueError(f"Unknown prompt version: {version}")
