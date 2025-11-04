"""
Travel Planner Agent Service
진짜 여행 플래너 비서 에이전트
"""

from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain_openai import ChatOpenAI
from langchain.memory import ConversationBufferMemory
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.tools import tool
from django.conf import settings
from asgiref.sync import sync_to_async
import json
import logging

logger = logging.getLogger(__name__)


class TravelPlannerAgent:
    """여행 플래너 비서 에이전트"""

    def __init__(self, room_id: int, trip_id: int):
        self.room_id = room_id
        self.trip_id = trip_id

        logger.info(f"🤖 Initializing TravelPlannerAgent for room={room_id}, trip={trip_id}")

        # LLM 초기화
        self.llm = ChatOpenAI(
            model="gpt-4-turbo-preview",
            temperature=0.7,
            openai_api_key=settings.OPENAI_API_KEY
        )

        # 메모리 초기화 (대화 기억)
        self.memory = ConversationBufferMemory(
            memory_key="chat_history",
            return_messages=True
        )

        # Agent 도구들
        self.tools = self._create_tools()

        # Agent 프롬프트
        self.prompt = self._create_prompt()

        # Agent 생성
        self.agent = create_openai_tools_agent(
            llm=self.llm,
            tools=self.tools,
            prompt=self.prompt
        )

        # Agent Executor
        self.agent_executor = AgentExecutor(
            agent=self.agent,
            tools=self.tools,
            memory=self.memory,
            verbose=True,
            max_iterations=5,
            handle_parsing_errors=True
        )

    def _create_prompt(self):
        """Agent 시스템 프롬프트"""
        system_message = f"""당신은 전문 여행 플래너 비서입니다.

당신의 역할:
1. 사용자들의 여행 계획을 도와주기
2. 일정에 장소를 추가/수정/삭제하기
3. 여행지 정보 제공하기
4. 최적의 여행 루트 제안하기
5. 사용자의 모든 대화를 기억하고 맥락을 이해하기

현재 여행 정보:
- Trip ID: {self.trip_id}
- Room ID: {self.room_id}

사용 가능한 도구:
📊 조회:
- get_planner_info: 현재 플래너 정보 조회

🏷️ 여행 정보 수정:
- update_trip_info: 여행 제목, 인원, 국가/지역 변경
- update_trip_dates: 여행 날짜 변경 (시작일, 종료일, Day 자동 생성)
  * 날짜 형식: YYYY-MM-DD, MM-DD, M월 D일 모두 가능
  * **매우 중요**: 년도 생략시 무조건 2025년 적용! (예: "28일"은 "2025-11-28", "1월 15일"은 "2025-01-15")
  * 절대로 2023년, 2024년 사용 금지! 현재는 2025년입니다!

📍 일정 추가/수정:
- add_place_to_day: 특정 일차에 장소 추가
- update_schedule: 일정 수정 (장소명, 시간, 메모)
- move_schedule: 일정을 다른 날짜로 이동
- reorder_schedule: 일정 순서 변경

🗑️ 일정 삭제:
- delete_schedule: 특정 장소 삭제
- delete_all_schedules: 특정 일차 또는 전체 일정 삭제

🔍 장소 검색 (강화된 기능):
- search_place: 장소 검색 (DB + 카카오맵, 평점/좌표/카테고리 포함)
- get_place_details: 특정 장소의 상세 정보 조회
- search_nearby: 특정 위치 주변 장소 검색 (위도/경도 기반)
- recommend_places: 인기 장소 추천 (지역/카테고리 필터 가능)
- search_and_show_on_map: UI 지도에서 검색 (사용자가 지도에서 보고 싶어할 때)

중요한 규칙:
1. 항상 먼저 get_planner_info로 현재 일정을 확인하세요
2. 장소를 추가할 때는 search_place로 정확한 이름을 확인하세요
3. 사용자가 특정 장소 근처의 추천을 원하면 search_nearby를 사용하세요
4. 지역별 인기 장소를 추천할 때는 recommend_places를 사용하세요
5. 사용자가 "지도에서 보여줘", "지도로 찾아줘" 같은 요청을 하면 search_and_show_on_map을 사용하세요
6. 친절하고 자세하게 답변하세요 (평점, 리뷰 수 등 유용한 정보 포함)
7. 작업을 수행한 후 결과를 명확하게 알려주세요
8. **날짜 처리 (매우 중요!)**:
   - 현재 년도는 2025년입니다!
   - 사용자가 년도 없이 날짜를 말하면 (예: "28일에서 30일로", "1월 15일로"),
   - update_trip_dates 호출 시 반드시 "2025-MM-DD" 형식으로 전달하세요!
   - 예: "28일에서 30일" → start_date="2025-11-28", end_date="2025-11-30"
   - 절대로 2023년이나 2024년을 사용하지 마세요!

사용자 요청 처리 가이드:
- "어디갈지 추천해줘", "여행지 추천" 같은 요청: 먼저 get_planner_info로 여행 정보를 확인하고, 여행지 제목이나 국가/지역 정보를 바탕으로 recommend_places를 사용하세요.
- 구체적인 지역이 없으면 사용자에게 어떤 지역이나 카테고리를 원하는지 물어보세요.
- 예: "서울 여행이시군요! 서울의 인기 관광지를 추천해드릴까요, 아니면 맛집을 찾으시나요?"

**중요: 장소 추천 응답 형식**
- recommend_places 도구를 사용한 후에는 추천 결과를 마크다운 리스트로 정리해서 보여주세요.
- 형식: "1. **장소명**: 설명" 또는 "1. **장소명** - 설명"
- 각 장소마다 주소, 평점, 카테고리 등 유용한 정보를 포함하세요.
- 사용자가 선택할 수 있도록 명확하고 읽기 쉽게 작성하세요.

항상 한국어로 답변하세요.
"""

        return ChatPromptTemplate.from_messages([
            ("system", system_message),
            MessagesPlaceholder(variable_name="chat_history"),
            ("human", "{input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad"),
        ])

    def _create_tools(self):
        """Agent가 사용할 도구들"""

        trip_id = self.trip_id  # Closure로 캡처

        @tool
        def get_planner_info() -> str:
            """현재 플래너의 모든 정보를 가져옵니다. 일정을 확인하거나 수정하기 전에 항상 이 도구를 먼저 사용하세요."""
            from apps.plans.models import TripPlan, TripDay, TripItem

            try:
                trip = TripPlan.objects.get(trip_idx=trip_id)
                days = TripDay.objects.filter(trip_idx=trip_id).order_by('day_no')

                info = {
                    "trip": {
                        "title": trip.title,
                        "start_date": str(trip.start_date),
                        "end_date": str(trip.end_date),
                        "party_size": trip.party_size,
                    },
                    "days": []
                }

                for day in days:
                    items = TripItem.objects.filter(day_idx=day.day_idx).order_by('order_in_day')
                    info["days"].append({
                        "day_no": day.day_no,
                        "date": str(day.date),
                        "items": [
                            {
                                "title": item.title,
                                "start_time": str(item.start_time) if item.start_time else "미정",
                                "notes": item.notes or ""
                            }
                            for item in items
                        ]
                    })

                return json.dumps(info, ensure_ascii=False, indent=2)
            except Exception as e:
                logger.error(f"❌ get_planner_info error: {e}")
                return f"오류 발생: {str(e)}"

        @tool
        def add_place_to_day(day_no: int, place_name: str, time: str = "09:00", notes: str = "") -> str:
            """특정 일차에 장소를 추가합니다.

            Args:
                day_no: 추가할 일차 (1, 2, 3...)
                place_name: 장소명
                time: 방문 시간 (HH:MM 형식, 예: 09:00, 14:30)
                notes: 메모나 설명

            Returns:
                추가 결과 메시지
            """
            from apps.plans.models import TripDay, TripItem

            try:
                day = TripDay.objects.get(trip_idx=trip_id, day_no=day_no)

                # 마지막 order 찾기
                last_item = TripItem.objects.filter(day_idx=day.day_idx).order_by('-order_in_day').first()
                order = (last_item.order_in_day + 1) if last_item else 1

                # 장소 추가
                TripItem.objects.create(
                    day_idx=day,
                    item_type='custom',
                    title=place_name,
                    start_time=time,
                    notes=notes,
                    order_in_day=order,
                    lock_flag=False
                )

                logger.info(f"✅ Added '{place_name}' to Day {day_no} at {time}")
                return f"✅ Day {day_no}에 '{place_name}'을(를) 추가했습니다 (시간: {time})"
            except TripDay.DoesNotExist:
                return f"❌ Day {day_no}을(를) 찾을 수 없습니다. 먼저 여행 날짜를 설정해주세요."
            except Exception as e:
                logger.error(f"❌ add_place_to_day error: {e}")
                return f"❌ 추가 실패: {str(e)}"

        @tool
        def search_place(keyword: str, region: str = None) -> str:
            """장소를 검색합니다. 내부 DB와 카카오맵 양쪽을 검색하여 풍부한 정보를 제공합니다.

            Args:
                keyword: 검색할 장소명
                region: 지역 필터 (선택, 예: '서울', '제주')

            Returns:
                검색 결과 (JSON 형식) - 이름, 주소, 좌표, 평점, 카테고리 등
            """
            import requests
            from django.conf import settings
            from apps.places.models import Place
            from django.db.models import Q

            try:
                results = []

                # 1. 내부 DB에서 검색 (더 풍부한 정보)
                try:
                    db_query = Q(name__icontains=keyword) | Q(ko_name__icontains=keyword)
                    if region:
                        db_query &= (Q(region1_idx__city_name__icontains=region) |
                                    Q(address__icontains=region))

                    db_places = Place.objects.filter(db_query)[:3]

                    for place in db_places:
                        results.append({
                            "source": "DB",
                            "name": place.ko_name or place.name,
                            "english_name": place.name if place.ko_name else None,
                            "address": place.address,
                            "category": place.types,
                            "rating": float(place.rating) if place.rating else None,
                            "reviews": place.user_ratings_total,
                            "latitude": float(place.latitude) if place.latitude else None,
                            "longitude": float(place.longitude) if place.longitude else None,
                            "phone": place.phone_number,
                            "website": place.website,
                        })

                    if db_places:
                        logger.info(f"🔍 Found {len(db_places)} places in DB for '{keyword}'")
                except Exception as db_error:
                    logger.warning(f"⚠️ DB search failed: {db_error}")

                # 2. 카카오맵 검색 (최신 정보)
                try:
                    url = "https://dapi.kakao.com/v2/local/search/keyword.json"
                    headers = {"Authorization": f"KakaoAK {settings.KAKAO_REST_API_KEY}"}
                    params = {"query": keyword, "size": 5}

                    response = requests.get(url, headers=headers, params=params, timeout=5)
                    data = response.json()

                    if data.get('documents'):
                        kakao_places = data['documents'][:3]
                        for p in kakao_places:
                            results.append({
                                "source": "Kakao",
                                "name": p['place_name'],
                                "address": p.get('road_address_name') or p.get('address_name'),
                                "category": p.get('category_name', ''),
                                "phone": p.get('phone', ''),
                                "latitude": float(p.get('y', 0)) if p.get('y') else None,
                                "longitude": float(p.get('x', 0)) if p.get('x') else None,
                                "place_url": p.get('place_url', ''),
                            })
                        logger.info(f"🔍 Found {len(kakao_places)} places in Kakao for '{keyword}'")
                except Exception as kakao_error:
                    logger.warning(f"⚠️ Kakao search failed: {kakao_error}")

                if results:
                    return json.dumps(results, ensure_ascii=False, indent=2)
                return "검색 결과가 없습니다."

            except Exception as e:
                logger.error(f"❌ search_place error: {e}")
                return f"검색 실패: {str(e)}"

        @tool
        def delete_schedule(day_no: int, place_name: str) -> str:
            """특정 일차의 장소를 삭제합니다.

            Args:
                day_no: 일차 번호
                place_name: 삭제할 장소명

            Returns:
                삭제 결과 메시지
            """
            from apps.plans.models import TripDay, TripItem

            try:
                day = TripDay.objects.get(trip_idx=trip_id, day_no=day_no)
                item = TripItem.objects.filter(day_idx=day.day_idx, title__icontains=place_name).first()

                if item:
                    item.delete()
                    logger.info(f"🗑️ Deleted '{place_name}' from Day {day_no}")
                    return f"✅ Day {day_no}의 '{place_name}'을(를) 삭제했습니다"
                return f"⚠️ Day {day_no}에서 '{place_name}'을(를) 찾을 수 없습니다"
            except TripDay.DoesNotExist:
                return f"❌ Day {day_no}을(를) 찾을 수 없습니다"
            except Exception as e:
                logger.error(f"❌ delete_schedule error: {e}")
                return f"❌ 삭제 실패: {str(e)}"

        @tool
        def update_schedule(day_no: int, old_place: str, new_place: str = None, new_time: str = None, new_notes: str = None) -> str:
            """일정을 수정합니다.

            Args:
                day_no: 일차 번호
                old_place: 수정할 장소의 현재 이름
                new_place: 새로운 장소명 (선택)
                new_time: 새로운 시간 (HH:MM 형식, 선택)
                new_notes: 새로운 메모 (선택)

            Returns:
                수정 결과 메시지
            """
            from apps.plans.models import TripDay, TripItem

            try:
                day = TripDay.objects.get(trip_idx=trip_id, day_no=day_no)
                item = TripItem.objects.filter(day_idx=day.day_idx, title__icontains=old_place).first()

                if item:
                    changes = []
                    if new_place:
                        item.title = new_place
                        changes.append(f"장소명: {new_place}")
                    if new_time:
                        item.start_time = new_time
                        changes.append(f"시간: {new_time}")
                    if new_notes:
                        item.notes = new_notes
                        changes.append(f"메모: {new_notes}")

                    item.save()
                    logger.info(f"📝 Updated '{old_place}' in Day {day_no}")
                    return f"✅ Day {day_no}의 '{old_place}' 수정 완료 ({', '.join(changes)})"
                return f"⚠️ Day {day_no}에서 '{old_place}'을(를) 찾을 수 없습니다"
            except TripDay.DoesNotExist:
                return f"❌ Day {day_no}을(를) 찾을 수 없습니다"
            except Exception as e:
                logger.error(f"❌ update_schedule error: {e}")
                return f"❌ 수정 실패: {str(e)}"

        @tool
        def update_trip_info(title: str = None, party_size: int = None, country_idx: int = None, region1_idx: int = None) -> str:
            """여행의 기본 정보를 수정합니다.

            Args:
                title: 여행 제목 (선택)
                party_size: 여행 인원 (선택)
                country_idx: 국가 인덱스 (선택)
                region1_idx: 지역 인덱스 (선택)

            Returns:
                수정 결과 메시지
            """
            from apps.plans.models import TripPlan

            try:
                trip = TripPlan.objects.get(trip_idx=trip_id)
                changes = []

                if title:
                    trip.title = title
                    changes.append(f"제목: {title}")
                if party_size and party_size > 0:
                    trip.party_size = party_size
                    changes.append(f"인원: {party_size}명")
                if country_idx:
                    trip.country_idx = country_idx
                    changes.append(f"국가: {country_idx}")
                if region1_idx:
                    trip.region1_idx = region1_idx
                    changes.append(f"지역: {region1_idx}")

                if not changes:
                    return "⚠️ 변경할 내용을 입력해주세요."

                trip.save()
                logger.info(f"✏️ Updated trip info: {', '.join(changes)}")
                return f"✅ 여행 정보를 수정했습니다: {', '.join(changes)}"

            except TripPlan.DoesNotExist:
                return "❌ 여행을 찾을 수 없습니다."
            except Exception as e:
                logger.error(f"❌ update_trip_info error: {e}")
                return f"❌ 수정 실패: {str(e)}"

        @tool
        def update_trip_dates(start_date: str, end_date: str) -> str:
            """여행 날짜를 변경합니다. 날짜에 맞춰 Day들을 자동으로 생성합니다.

            Args:
                start_date: 시작일 (YYYY-MM-DD, MM-DD, M월 D일 형식, 예: 2025-10-28, 10-28, 10월 28일)
                end_date: 종료일 (YYYY-MM-DD, MM-DD, M월 D일 형식, 예: 2025-10-31, 10-31, 10월 31일)
                * 년도가 없으면 현재 년도(2025)가 자동으로 적용됩니다.

            Returns:
                날짜 변경 결과 메시지
            """
            from apps.plans.models import TripPlan, TripDay
            from datetime import datetime, timedelta
            from django.db import connection
            import re

            def parse_flexible_date(date_str: str, current_year: int = 2025) -> datetime.date:
                """다양한 형식의 날짜를 파싱합니다. 년도가 없으면 current_year를 사용합니다."""
                date_str = date_str.strip()

                # 1. YYYY-MM-DD 형식
                try:
                    return datetime.strptime(date_str, "%Y-%m-%d").date()
                except ValueError:
                    pass

                # 2. MM-DD 형식 (년도 없음)
                try:
                    parsed = datetime.strptime(date_str, "%m-%d")
                    return parsed.replace(year=current_year).date()
                except ValueError:
                    pass

                # 3. M-D 형식 (년도 없음, 한자리 월/일)
                try:
                    parsed = datetime.strptime(date_str, "%m-%d")
                    return parsed.replace(year=current_year).date()
                except ValueError:
                    pass

                # 4. M월 D일 형식 (한국어)
                korean_pattern = r'(\d{1,2})월\s*(\d{1,2})일'
                match = re.match(korean_pattern, date_str)
                if match:
                    month, day = int(match.group(1)), int(match.group(2))
                    return datetime(current_year, month, day).date()

                # 5. YYYY년 M월 D일 형식 (한국어, 년도 포함)
                korean_year_pattern = r'(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일'
                match = re.match(korean_year_pattern, date_str)
                if match:
                    year, month, day = int(match.group(1)), int(match.group(2)), int(match.group(3))
                    return datetime(year, month, day).date()

                raise ValueError(f"지원하지 않는 날짜 형식: {date_str}")

            try:
                # DB 연결 확인 및 재연결
                connection.ensure_connection()

                trip = TripPlan.objects.get(trip_idx=trip_id)

                # 날짜 파싱 (년도가 없으면 2025 자동 적용)
                start = parse_flexible_date(start_date)
                end = parse_flexible_date(end_date)

                if start >= end:
                    return "❌ 시작일은 종료일보다 빨라야 합니다."

                # 새로운 일수 계산
                new_total_days = (end - start).days + 1

                # 기존 Day들 가져오기
                existing_days = TripDay.objects.filter(trip_idx=trip_id).order_by('day_no')
                existing_day_count = existing_days.count()

                # 여행 날짜 업데이트
                trip.start_date = start
                trip.end_date = end
                trip.save()

                # 일수가 줄어든 경우: 초과된 Day들과 그에 속한 Item들 삭제
                if new_total_days < existing_day_count:
                    # 예: 1박2일(2일) -> 당일치기(1일)이면 Day 2를 삭제
                    days_to_delete = TripDay.objects.filter(
                        trip_idx=trip_id,
                        day_no__gt=new_total_days
                    )
                    deleted_count = days_to_delete.count()

                    # TripItem은 CASCADE로 자동 삭제됨
                    days_to_delete.delete()
                    logger.info(f"🗑️ Deleted {deleted_count} days (Day {new_total_days + 1} ~ Day {existing_day_count})")

                # Day 업데이트 또는 생성
                current_date = start
                day_no = 1
                updated_days = []
                created_days = []

                while current_date <= end:
                    # 기존 Day가 있으면 날짜만 업데이트 (일정 데이터 유지)
                    existing_day = TripDay.objects.filter(trip_idx=trip_id, day_no=day_no).first()

                    if existing_day:
                        # 기존 Day의 날짜만 업데이트
                        existing_day.date = current_date
                        existing_day.save()
                        updated_days.append(f"Day {day_no} ({current_date})")
                        logger.info(f"📝 Updated Day {day_no} date to {current_date}")
                    else:
                        # 새로운 Day 생성
                        TripDay.objects.create(
                            trip_idx=trip,
                            day_no=day_no,
                            date=current_date
                        )
                        created_days.append(f"Day {day_no} ({current_date})")
                        logger.info(f"➕ Created new Day {day_no} ({current_date})")

                    current_date += timedelta(days=1)
                    day_no += 1

                logger.info(f"📅 Updated trip dates: {start} ~ {end} ({new_total_days}일)")

                # 결과 메시지 구성
                result_message = f"✅ 여행 날짜를 {start}부터 {end}까지로 변경했습니다!\n총 {new_total_days}일 일정입니다.\n"

                if updated_days:
                    result_message += f"\n📝 날짜가 업데이트된 일정:\n" + "\n".join(updated_days)

                if created_days:
                    result_message += f"\n\n➕ 새로 생성된 일정:\n" + "\n".join(created_days)

                if new_total_days < existing_day_count:
                    deleted_day_range = f"Day {new_total_days + 1}" if deleted_count == 1 else f"Day {new_total_days + 1} ~ Day {existing_day_count}"
                    result_message += f"\n\n🗑️ 삭제된 일정: {deleted_day_range} (일수 감소로 인해 삭제됨)"

                return result_message

            except TripPlan.DoesNotExist:
                return "❌ 여행을 찾을 수 없습니다."
            except ValueError as e:
                return f"❌ 날짜 형식이 잘못되었습니다: {str(e)}\n지원 형식: YYYY-MM-DD, MM-DD, M월 D일 (년도 생략시 2025년 적용)"
            except Exception as e:
                logger.error(f"❌ update_trip_dates error: {e}")
                return f"❌ 날짜 변경 실패: {str(e)}"

        @tool
        def move_schedule(day_no: int, place_name: str, new_day_no: int, new_time: str = None) -> str:
            """일정을 다른 날짜로 이동합니다.

            Args:
                day_no: 현재 일차 번호
                place_name: 이동할 장소명
                new_day_no: 이동할 목적지 일차 번호
                new_time: 새로운 시간 (선택, HH:MM 형식)

            Returns:
                이동 결과 메시지
            """
            from apps.plans.models import TripDay, TripItem

            try:
                # 기존 Day와 Item 찾기
                old_day = TripDay.objects.get(trip_idx=trip_id, day_no=day_no)
                item = TripItem.objects.filter(day_idx=old_day.day_idx, title__icontains=place_name).first()

                if not item:
                    return f"⚠️ Day {day_no}에서 '{place_name}'을(를) 찾을 수 없습니다"

                # 새로운 Day 찾기
                new_day = TripDay.objects.get(trip_idx=trip_id, day_no=new_day_no)

                # 아이템 이동
                item.day_idx = new_day
                if new_time:
                    item.start_time = new_time

                # 새로운 Day의 마지막 order 찾기
                last_item = TripItem.objects.filter(day_idx=new_day.day_idx).order_by('-order_in_day').first()
                item.order_in_day = (last_item.order_in_day + 1) if last_item else 1

                item.save()

                logger.info(f"🔄 Moved '{place_name}' from Day {day_no} to Day {new_day_no}")
                time_info = f" (시간: {new_time})" if new_time else ""
                return f"✅ '{place_name}'을(를) Day {day_no}에서 Day {new_day_no}로 이동했습니다{time_info}"

            except TripDay.DoesNotExist:
                return f"❌ Day {day_no} 또는 Day {new_day_no}을(를) 찾을 수 없습니다"
            except Exception as e:
                logger.error(f"❌ move_schedule error: {e}")
                return f"❌ 이동 실패: {str(e)}"

        @tool
        def reorder_schedule(day_no: int, place_name: str, new_order: int) -> str:
            """특정 일차 내에서 일정의 순서를 변경합니다.

            Args:
                day_no: 일차 번호
                place_name: 순서를 바꿀 장소명
                new_order: 새로운 순서 (1부터 시작)

            Returns:
                순서 변경 결과 메시지
            """
            from apps.plans.models import TripDay, TripItem

            try:
                day = TripDay.objects.get(trip_idx=trip_id, day_no=day_no)
                item = TripItem.objects.filter(day_idx=day.day_idx, title__icontains=place_name).first()

                if not item:
                    return f"⚠️ Day {day_no}에서 '{place_name}'을(를) 찾을 수 없습니다"

                old_order = item.order_in_day
                item.order_in_day = new_order
                item.save()

                logger.info(f"🔢 Reordered '{place_name}' from {old_order} to {new_order}")
                return f"✅ Day {day_no}의 '{place_name}' 순서를 {new_order}번째로 변경했습니다"

            except TripDay.DoesNotExist:
                return f"❌ Day {day_no}을(를) 찾을 수 없습니다"
            except Exception as e:
                logger.error(f"❌ reorder_schedule error: {e}")
                return f"❌ 순서 변경 실패: {str(e)}"

        @tool
        def delete_all_schedules(day_no: int = None) -> str:
            """특정 일차 또는 전체 일정을 삭제합니다.

            Args:
                day_no: 삭제할 일차 번호 (없으면 전체 삭제)

            Returns:
                삭제 결과 메시지
            """
            from apps.plans.models import TripDay, TripItem

            try:
                if day_no:
                    # 특정 일차만 삭제
                    day = TripDay.objects.get(trip_idx=trip_id, day_no=day_no)
                    count = TripItem.objects.filter(day_idx=day.day_idx).count()
                    TripItem.objects.filter(day_idx=day.day_idx).delete()
                    logger.info(f"🗑️ Deleted all schedules in Day {day_no} ({count} items)")
                    return f"✅ Day {day_no}의 모든 일정({count}개)을 삭제했습니다"
                else:
                    # 전체 일정 삭제
                    days = TripDay.objects.filter(trip_idx=trip_id)
                    total_count = 0
                    for day in days:
                        count = TripItem.objects.filter(day_idx=day.day_idx).count()
                        TripItem.objects.filter(day_idx=day.day_idx).delete()
                        total_count += count
                    logger.info(f"🗑️ Deleted all schedules ({total_count} items)")
                    return f"✅ 전체 일정({total_count}개)을 삭제했습니다"

            except TripDay.DoesNotExist:
                return f"❌ Day {day_no}을(를) 찾을 수 없습니다"
            except Exception as e:
                logger.error(f"❌ delete_all_schedules error: {e}")
                return f"❌ 삭제 실패: {str(e)}"

        @tool
        def get_place_details(place_name: str) -> str:
            """특정 장소의 상세 정보를 가져옵니다.

            Args:
                place_name: 조회할 장소명

            Returns:
                장소 상세 정보 (JSON 형식) - 평점, 리뷰 수, 영업시간, 웹사이트 등
            """
            from apps.places.models import Place
            from django.db.models import Q

            try:
                # DB에서 장소 검색
                place = Place.objects.filter(
                    Q(name__icontains=place_name) | Q(ko_name__icontains=place_name)
                ).first()

                if place:
                    details = {
                        "name": place.ko_name or place.name,
                        "english_name": place.name if place.ko_name else None,
                        "address": place.address,
                        "phone": place.phone_number,
                        "website": place.website,
                        "category": place.types,
                        "rating": float(place.rating) if place.rating else None,
                        "reviews_count": place.user_ratings_total,
                        "latitude": float(place.latitude) if place.latitude else None,
                        "longitude": float(place.longitude) if place.longitude else None,
                        "price_level": place.price_level,
                    }

                    logger.info(f"📍 Found details for '{place_name}'")
                    return json.dumps(details, ensure_ascii=False, indent=2)

                return f"'{place_name}'의 상세 정보를 찾을 수 없습니다. search_place로 먼저 검색해보세요."

            except Exception as e:
                logger.error(f"❌ get_place_details error: {e}")
                return f"조회 실패: {str(e)}"

        @tool
        def search_nearby(latitude: float, longitude: float, radius_km: float = 5.0, place_type: str = None) -> str:
            """특정 위치 주변의 장소를 검색합니다.

            Args:
                latitude: 위도
                longitude: 경도
                radius_km: 검색 반경 (km, 기본값: 5km)
                place_type: 장소 유형 필터 (선택, 예: '식당', '카페', '관광지')

            Returns:
                주변 장소 목록 (JSON 형식)
            """
            from apps.places.models import Place

            try:
                # Simple bounding box search
                lat_delta = radius_km / 111.0
                lng_delta = radius_km / 88.0

                query = Place.objects.filter(
                    latitude__gte=latitude - lat_delta,
                    latitude__lte=latitude + lat_delta,
                    longitude__gte=longitude - lng_delta,
                    longitude__lte=longitude + lng_delta
                )

                if place_type:
                    query = query.filter(types__icontains=place_type)

                places = query.order_by('-rating', '-user_ratings_total')[:10]

                results = []
                for place in places:
                    results.append({
                        "name": place.ko_name or place.name,
                        "address": place.address,
                        "category": place.types,
                        "rating": float(place.rating) if place.rating else None,
                        "reviews": place.user_ratings_total,
                        "latitude": float(place.latitude) if place.latitude else None,
                        "longitude": float(place.longitude) if place.longitude else None,
                    })

                if results:
                    logger.info(f"🗺️ Found {len(results)} places near ({latitude}, {longitude})")
                    return json.dumps(results, ensure_ascii=False, indent=2)

                return f"반경 {radius_km}km 내에 장소를 찾을 수 없습니다."

            except Exception as e:
                logger.error(f"❌ search_nearby error: {e}")
                return f"주변 검색 실패: {str(e)}"

        @tool
        def recommend_places(region: str = None, min_rating: float = 4.0, category: str = None, limit: int = 10) -> str:
            """인기 장소를 추천합니다.

            Args:
                region: 지역 필터 (선택, 예: '서울', '제주')
                min_rating: 최소 평점 (기본값: 4.0)
                category: 카테고리 필터 (선택, 예: '관광지', '맛집')
                limit: 결과 개수 (기본값: 10)

            Returns:
                추천 장소 목록 (JSON 형식)
            """
            from apps.places.models import Place
            from django.db.models import Q

            try:
                query = Place.objects.filter(
                    rating__gte=min_rating,
                    user_ratings_total__gte=50  # 리뷰 최소 50개
                )

                if region:
                    query = query.filter(
                        Q(region1_idx__city_name__icontains=region) |
                        Q(address__icontains=region)
                    )

                if category:
                    query = query.filter(types__icontains=category)

                places = query.order_by('-user_ratings_total', '-rating')[:limit]

                results = []
                for place in places:
                    results.append({
                        "name": place.ko_name or place.name,
                        "address": place.address,
                        "category": place.types,
                        "rating": float(place.rating) if place.rating else None,
                        "reviews": place.user_ratings_total,
                        "phone": place.phone,
                        "website": place.website_uri,
                    })

                if results:
                    logger.info(f"⭐ Recommended {len(results)} places")
                    return json.dumps(results, ensure_ascii=False, indent=2)

                return "추천할 장소를 찾을 수 없습니다. 필터 조건을 완화해보세요."

            except Exception as e:
                logger.error(f"❌ recommend_places error: {e}")
                return f"추천 실패: {str(e)}"

        @tool
        def search_and_show_on_map(keyword: str, region: str = None) -> str:
            """UI의 카카오맵에서 장소를 검색합니다. 사용자가 지도에서 확인하고 싶어할 때 사용하세요.

            Args:
                keyword: 검색할 장소명
                region: 지역 필터 (선택)

            Returns:
                검색 명령 전송 결과
            """
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync

            try:
                # WebSocket을 통해 프론트엔드에 지도 검색 명령 전송
                channel_layer = get_channel_layer()
                room_group_name = f'trip_chat_{self.room_id}'

                async_to_sync(channel_layer.group_send)(
                    room_group_name,
                    {
                        'type': 'map_search',
                        'keyword': keyword,
                        'region': region,
                        'message': f"'{keyword}' 검색 중..."
                    }
                )

                logger.info(f"🗺️ Sent map search command: {keyword}")
                return f"✅ 지도에서 '{keyword}'을(를) 검색했습니다. 오른쪽 지도를 확인해주세요!"

            except Exception as e:
                logger.error(f"❌ search_and_show_on_map error: {e}")
                return f"❌ 지도 검색 실패: {str(e)}"

        return [
            get_planner_info,
            add_place_to_day,
            search_place,
            get_place_details,
            search_nearby,
            recommend_places,
            search_and_show_on_map,
            delete_schedule,
            update_schedule,
            update_trip_info,
            update_trip_dates,
            move_schedule,
            reorder_schedule,
            delete_all_schedules,
        ]

    def run(self, user_message: str) -> str:
        """사용자 메시지 처리"""
        try:
            logger.info(f"🗣️ User message: {user_message}")

            # Agent executor는 'input' 키만 받습니다
            # trip_id와 room_id는 이미 프롬프트에 포함되어 있음
            response = self.agent_executor.invoke({
                "input": user_message,
            })

            result = response["output"]
            logger.info(f"🤖 Agent response: {result[:100]}...")
            return result

        except Exception as e:
            logger.error(f"❌ Agent error: {e}", exc_info=True)
            return f"죄송합니다. 오류가 발생했습니다: {str(e)}"


# Agent 인스턴스 관리 (방별로 하나씩 - 싱글톤)
_agents = {}

def get_agent(room_id: int, trip_id: int) -> TravelPlannerAgent:
    """방별 Agent 인스턴스 가져오기 (싱글톤 패턴)"""
    key = f"{room_id}_{trip_id}"
    if key not in _agents:
        logger.info(f"🆕 Creating new agent for room={room_id}, trip={trip_id}")
        _agents[key] = TravelPlannerAgent(room_id, trip_id)
    return _agents[key]


def clear_agent(room_id: int, trip_id: int):
    """Agent 인스턴스 제거 (메모리 정리)"""
    key = f"{room_id}_{trip_id}"
    if key in _agents:
        logger.info(f"🧹 Clearing agent for room={room_id}, trip={trip_id}")
        del _agents[key]
