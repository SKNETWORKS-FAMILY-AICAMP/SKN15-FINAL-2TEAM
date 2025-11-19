#!/usr/bin/env python3
"""
RAG Auto-Add 기능 테스트 스크립트
"""

import sys
import os
sys.path.insert(0, '/home/playdata/SKN15-FINAL-2TEAM/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from apps.chat.agent import TravelPlannerAgent
from apps.plans.models import TripPlan, TripDay, TripItem
from apps.accounts.models import User
from datetime import date, timedelta
import json

def create_test_trip():
    """테스트용 여행 생성"""
    print("=" * 60)
    print("🔧 테스트 여행 생성 중...")
    print("=" * 60)

    # 테스트 사용자 가져오기
    try:
        user = User.objects.get(email='test@example.com')
    except User.DoesNotExist:
        print("❌ test@example.com 사용자가 없습니다!")
        return None

    # 기존 테스트 여행 삭제
    TripPlan.objects.filter(title__contains='RAG 테스트').delete()

    # 새 여행 생성
    trip = TripPlan.objects.create(
        user_idx=user,
        title='RAG 테스트 여행 - 서울 2박3일',
        start_date=date.today(),
        end_date=date.today() + timedelta(days=2),
        party_size=2,
        is_public=False
    )

    # Day 생성
    for i in range(3):
        TripDay.objects.create(
            trip_idx=trip,
            day_no=i + 1,
            date=date.today() + timedelta(days=i)
        )

    print(f"✅ 여행 생성 완료: {trip.title} (ID: {trip.trip_idx})")
    print(f"   기간: {trip.start_date} ~ {trip.end_date}")
    print(f"   일수: 3일")
    print()

    return trip

def test_rag_search():
    """RAG 검색 테스트"""
    print("=" * 60)
    print("🔍 RAG 검색 테스트")
    print("=" * 60)

    from apps.ai.rag import get_rag

    rag = get_rag()
    results = rag.search_similar_trips(
        query="서울 맛집",
        limit=3
    )

    print(f"✅ RAG 검색 결과: {len(results)}개")
    print()

    for idx, result in enumerate(results, 1):
        print(f"{idx}. {result['title']}")
        print(f"   유사도: {int(result['similarity_score'] * 100)}%")
        if result.get('schedules'):
            print(f"   일정: {len(result['schedules'])}일")
            for day_idx, places in enumerate(result['schedules'][:2], 1):
                if isinstance(places, list) and places:
                    print(f"      Day {day_idx}: {' → '.join(places[:3])}")
        print()

    return results

def test_recommend_and_add(trip):
    """recommend_and_add_to_planner 도구 테스트"""
    print("=" * 60)
    print("🚀 recommend_and_add_to_planner 도구 테스트")
    print("=" * 60)

    # Agent 생성 (room_id는 임시로 999 사용)
    agent = TravelPlannerAgent(room_id=999, trip_id=trip.trip_idx)

    # 사용자 메시지
    user_message = "서울 맛집으로 일정 채워줘"

    print(f"📝 사용자 요청: '{user_message}'")
    print()
    print("⏳ Agent 실행 중...")
    print()

    # Agent 실행
    try:
        response = agent.run(user_message)

        print("=" * 60)
        print("✅ Agent 응답:")
        print("=" * 60)
        print(response)
        print()

        # 추가된 일정 확인
        days = TripDay.objects.filter(trip_idx=trip.trip_idx).order_by('day_no')

        print("=" * 60)
        print("📅 플래너 현황:")
        print("=" * 60)

        total_items = 0
        for day in days:
            items = TripItem.objects.filter(day_idx=day.day_idx).order_by('order_in_day')
            print(f"\nDay {day.day_no} ({day.date}): {items.count()}개 장소")

            for item in items:
                print(f"  {item.start_time or '미정'} - {item.title}")
                if item.notes:
                    # 첫 줄만 출력
                    first_line = item.notes.split('\n')[0]
                    print(f"           {first_line}")
                total_items += 1

        print()
        print(f"총 {total_items}개 장소 추가됨")
        print()

        return True

    except Exception as e:
        print(f"❌ 에러 발생: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("\n")
    print("=" * 60)
    print("🎯 RAG Auto-Add 기능 종합 테스트")
    print("=" * 60)
    print()

    # 1. 테스트 여행 생성
    trip = create_test_trip()
    if not trip:
        return

    # 2. RAG 검색 테스트
    rag_results = test_rag_search()

    if not rag_results:
        print("❌ RAG 검색 결과가 없습니다!")
        return

    # 3. recommend_and_add_to_planner 도구 테스트
    success = test_recommend_and_add(trip)

    if success:
        print("=" * 60)
        print("✅ 모든 테스트 완료!")
        print("=" * 60)
        print()
        print("📌 다음 단계:")
        print("1. 웹 브라우저에서 http://localhost 접속")
        print("2. test@example.com으로 로그인")
        print("3. 'RAG 테스트 여행 - 서울 2박3일' 여행 확인")
        print("4. 채팅창에서 추가 테스트:")
        print("   - '여행 일정 추천해줘'")
        print("   - '맛집 추가해줘'")
        print("   - '관광지 추천해줘'")
        print()
    else:
        print("❌ 테스트 실패")

if __name__ == '__main__':
    main()
