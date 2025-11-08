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

        # LLM 초기화 (환경변수에서 모델과 temperature 설정)
        self.llm = ChatOpenAI(
            model=getattr(settings, 'CHAT_AGENT_MODEL', 'gpt-4-turbo-preview'),
            temperature=float(getattr(settings, 'CHAT_AGENT_TEMPERATURE', 0.7)),
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
        """Agent 시스템 프롬프트 (별도 파일에서 로드)"""
        from .prompts import get_system_prompt

        # 프롬프트를 별도 파일에서 가져오기 (버전 관리 용이)
        system_message = get_system_prompt(
            trip_id=self.trip_id,
            room_id=self.room_id
        )

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
            """특정 일차에 장소를 추가합니다. (자동 검증 포함)

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
            from apps.plans.models import TripDay, TripItem
            from apps.places.models import Place
            from django.db.models import Q
            import requests
            from django.conf import settings

            try:
                day = TripDay.objects.get(trip_idx=trip_id, day_no=day_no)

                # 🆕 1. 장소 검증 및 검색 (자동으로 DB + Kakao 검색)
                verified_place = None
                verified_name = place_name
                place_info = {}

                # 1-1. 내부 DB에서 먼저 검색
                try:
                    db_place = Place.objects.filter(
                        Q(name__icontains=place_name) | Q(ko_name__icontains=place_name)
                    ).first()

                    if db_place:
                        verified_place = db_place
                        verified_name = db_place.ko_name or db_place.name
                        place_info = {
                            'address': db_place.address,
                            'latitude': float(db_place.latitude) if db_place.latitude else None,
                            'longitude': float(db_place.longitude) if db_place.longitude else None,
                            'rating': float(db_place.rating) if db_place.rating else None,
                            'reviews': db_place.user_ratings_total,
                            'phone': db_place.phone if hasattr(db_place, 'phone') else None,
                        }
                        logger.info(f"✅ Found place in DB: {verified_name} (ID: {db_place.place_idx})")
                except Exception as db_error:
                    logger.warning(f"⚠️ DB search failed: {db_error}")

                # 1-2. DB에 없으면 카카오맵에서 검색
                if not verified_place:
                    try:
                        url = "https://dapi.kakao.com/v2/local/search/keyword.json"
                        headers = {"Authorization": f"KakaoAK {settings.KAKAO_REST_API_KEY}"}
                        params = {"query": place_name, "size": 1}

                        response = requests.get(url, headers=headers, params=params, timeout=5)
                        data = response.json()

                        if data.get('documents'):
                            place_data = data['documents'][0]
                            verified_name = place_data['place_name']
                            place_info = {
                                'address': place_data.get('road_address_name') or place_data.get('address_name'),
                                'latitude': float(place_data.get('y', 0)) if place_data.get('y') else None,
                                'longitude': float(place_data.get('x', 0)) if place_data.get('x') else None,
                                'category': place_data.get('category_name', ''),
                                'phone': place_data.get('phone', ''),
                            }
                            logger.info(f"✅ Found place in Kakao: {verified_name}")
                        else:
                            logger.warning(f"⚠️ '{place_name}' not found in Kakao - using as-is")
                    except Exception as kakao_error:
                        logger.warning(f"⚠️ Kakao search failed: {kakao_error}")

                # 🆕 2. 마지막 order 찾기
                last_item = TripItem.objects.filter(day_idx=day.day_idx).order_by('-order_in_day').first()
                order = (last_item.order_in_day + 1) if last_item else 1

                # 🆕 3. TripItem 생성 (place_idx 연결 시도)
                item_type = 'place' if verified_place else 'custom'

                # notes에 장소 정보 추가 (기존 notes와 병합)
                enhanced_notes = notes
                if place_info.get('address'):
                    enhanced_notes = f"{notes}\n📍 {place_info['address']}" if notes else f"📍 {place_info['address']}"
                if place_info.get('rating'):
                    enhanced_notes += f"\n⭐ {place_info['rating']}"
                    if place_info.get('reviews'):
                        enhanced_notes += f" ({place_info['reviews']:,}개 리뷰)"

                TripItem.objects.create(
                    day_idx=day,
                    item_type=item_type,
                    place_idx=verified_place,  # ← FK 연결 (DB에서 찾은 경우)
                    title=verified_name,        # ← 검증된 이름
                    start_time=time,
                    notes=enhanced_notes.strip(),
                    order_in_day=order,
                    lock_flag=False
                )

                # 🆕 4. 상세 정보 포함한 응답 생성
                response_msg = f"✅ Day {day_no}에 '{verified_name}'을(를) 추가했습니다 (시간: {time})"

                if place_info.get('address'):
                    response_msg += f"\n📍 주소: {place_info['address']}"
                if place_info.get('latitude') and place_info.get('longitude'):
                    response_msg += f"\n🗺️ 좌표: ({place_info['latitude']:.6f}, {place_info['longitude']:.6f})"
                if place_info.get('rating'):
                    response_msg += f"\n⭐ 평점: {place_info['rating']}"
                    if place_info.get('reviews'):
                        response_msg += f" ({place_info['reviews']:,}개 리뷰)"
                if verified_place:
                    response_msg += f"\n🔗 DB 연결됨 (place_idx: {verified_place.place_idx})"
                else:
                    response_msg += "\n💡 Tip: 더 정확한 정보를 위해 search_place를 먼저 사용해보세요!"

                logger.info(f"✅ Added place: {verified_name} (place_idx: {verified_place.place_idx if verified_place else 'NULL'}, order: {order})")
                return response_msg

            except TripDay.DoesNotExist:
                return f"❌ Day {day_no}을(를) 찾을 수 없습니다. 먼저 여행 날짜를 설정해주세요."
            except Exception as e:
                logger.error(f"❌ add_place_to_day error: {e}", exc_info=True)
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

            ⚠️ 주의: 이 도구는 지도에만 표시합니다. 일정에 추가하려면 search_on_map_and_add를 사용하세요!

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

        @tool
        def search_on_map_and_add(day_no: int, place_name: str, time: str = "09:00", notes: str = "") -> str:
            """🆕 지도에서 장소를 검색하고 일정에 자동으로 추가합니다. (통합 도구)

            사용자가 "Day 1에 경복궁 추가해줘" 같은 요청을 하면 이 도구를 사용하세요!
            1. 지도에서 장소 검색 (UI에 표시)
            2. 검색된 정확한 정보로 일정에 추가
            3. 사용자에게 결과 알림

            Args:
                day_no: 추가할 일차 (1, 2, 3...)
                place_name: 검색할 장소명 (예: "경복궁", "남산타워")
                time: 방문 시간 (HH:MM 형식, 예: 09:00, 14:30)
                notes: 추가 메모

            Returns:
                지도 검색 + 일정 추가 결과
            """
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync
            from apps.plans.models import TripDay, TripItem
            from apps.places.models import Place
            from django.db.models import Q
            import requests
            from django.conf import settings

            try:
                # 🗺️ Step 1: 지도에 검색 표시 (UI)
                channel_layer = get_channel_layer()
                room_group_name = f'trip_chat_{self.room_id}'

                async_to_sync(channel_layer.group_send)(
                    room_group_name,
                    {
                        'type': 'map_search',
                        'keyword': place_name,
                        'region': None,
                        'message': f"'{place_name}' 검색 중..."
                    }
                )
                logger.info(f"🗺️ Map search sent: {place_name}")

                # 🔍 Step 2: 장소 검증 및 검색 (DB + Kakao)
                verified_place = None
                verified_name = place_name
                place_info = {}

                # 2-1. 내부 DB 검색
                try:
                    db_place = Place.objects.filter(
                        Q(name__icontains=place_name) | Q(ko_name__icontains=place_name)
                    ).first()

                    if db_place:
                        verified_place = db_place
                        verified_name = db_place.ko_name or db_place.name
                        place_info = {
                            'address': db_place.address,
                            'latitude': float(db_place.latitude) if db_place.latitude else None,
                            'longitude': float(db_place.longitude) if db_place.longitude else None,
                            'rating': float(db_place.rating) if db_place.rating else None,
                            'reviews': db_place.user_ratings_total,
                            'phone': db_place.phone if hasattr(db_place, 'phone') else None,
                        }
                        logger.info(f"✅ Found in DB: {verified_name} (ID: {db_place.place_idx})")
                except Exception as db_error:
                    logger.warning(f"⚠️ DB search failed: {db_error}")

                # 2-2. Kakao 검색 (DB에 없으면)
                if not verified_place:
                    try:
                        url = "https://dapi.kakao.com/v2/local/search/keyword.json"
                        headers = {"Authorization": f"KakaoAK {settings.KAKAO_REST_API_KEY}"}
                        params = {"query": place_name, "size": 1}

                        response = requests.get(url, headers=headers, params=params, timeout=5)
                        data = response.json()

                        if data.get('documents'):
                            place_data = data['documents'][0]
                            verified_name = place_data['place_name']
                            place_info = {
                                'address': place_data.get('road_address_name') or place_data.get('address_name'),
                                'latitude': float(place_data.get('y', 0)) if place_data.get('y') else None,
                                'longitude': float(place_data.get('x', 0)) if place_data.get('x') else None,
                                'category': place_data.get('category_name', ''),
                                'phone': place_data.get('phone', ''),
                            }
                            logger.info(f"✅ Found in Kakao: {verified_name}")
                        else:
                            logger.warning(f"⚠️ '{place_name}' not found - using as-is")
                    except Exception as kakao_error:
                        logger.warning(f"⚠️ Kakao search failed: {kakao_error}")

                # ➕ Step 3: 일정에 추가
                day = TripDay.objects.get(trip_idx=trip_id, day_no=day_no)

                # 마지막 order 찾기
                last_item = TripItem.objects.filter(day_idx=day.day_idx).order_by('-order_in_day').first()
                order = (last_item.order_in_day + 1) if last_item else 1

                # TripItem 생성
                item_type = 'place' if verified_place else 'custom'

                # notes에 장소 정보 추가
                enhanced_notes = notes
                if place_info.get('address'):
                    enhanced_notes = f"{notes}\n📍 {place_info['address']}" if notes else f"📍 {place_info['address']}"
                if place_info.get('rating'):
                    enhanced_notes += f"\n⭐ {place_info['rating']}"
                    if place_info.get('reviews'):
                        enhanced_notes += f" ({place_info['reviews']:,}개 리뷰)"

                TripItem.objects.create(
                    day_idx=day,
                    item_type=item_type,
                    place_idx=verified_place,
                    title=verified_name,
                    start_time=time,
                    notes=enhanced_notes.strip(),
                    order_in_day=order,
                    lock_flag=False
                )

                # 📢 Step 4: 결과 메시지 생성
                response_msg = f"✅ Day {day_no}에 '{verified_name}'을(를) 추가했습니다! (시간: {time})\n"
                response_msg += f"🗺️ 지도에서 위치를 확인할 수 있습니다.\n"

                if place_info.get('address'):
                    response_msg += f"📍 주소: {place_info['address']}\n"
                if place_info.get('latitude') and place_info.get('longitude'):
                    response_msg += f"🗺️ 좌표: ({place_info['latitude']:.6f}, {place_info['longitude']:.6f})\n"
                if place_info.get('rating'):
                    response_msg += f"⭐ 평점: {place_info['rating']}"
                    if place_info.get('reviews'):
                        response_msg += f" ({place_info['reviews']:,}개 리뷰)\n"
                if verified_place:
                    response_msg += f"🔗 DB 연결됨 (place_idx: {verified_place.place_idx})"

                logger.info(f"✅ Map search + add complete: {verified_name} to Day {day_no}")
                return response_msg.strip()

            except TripDay.DoesNotExist:
                return f"❌ Day {day_no}을(를) 찾을 수 없습니다. 먼저 여행 날짜를 설정해주세요."
            except Exception as e:
                logger.error(f"❌ search_on_map_and_add error: {e}", exc_info=True)
                return f"❌ 추가 실패: {str(e)}"

        @tool
        def recommend_similar_trips(query: str, limit: int = 5) -> str:
            """실제 여행 블로그/영상 데이터를 기반으로 비슷한 여행 경로를 추천합니다. (RAG)

            사용자가 "여행지 추천해줘", "어디갈지 추천", "유명한 코스 알려줘" 같은 요청을 할 때 사용하세요.
            이 도구는 실제 여행자들의 경로 데이터를 검색하여 구체적인 일정과 코스를 제안합니다.

            Args:
                query: 검색 쿼리 (예: "서울 3박4일 여행", "제주도 가족 여행", "맛집 투어")
                limit: 추천할 여행 경로 개수 (기본값: 5)

            Returns:
                추천 여행 경로 목록 (제목, URL, 일정, 유사도 포함)
            """
            from apps.ai.rag import get_rag
            from apps.plans.models import TripPlan

            try:
                # 현재 여행 정보 가져오기
                trip = TripPlan.objects.get(trip_idx=trip_id)

                rag = get_rag()

                # 현재 여행의 국가/지역 정보를 활용하여 검색
                results = rag.search_similar_trips(
                    query=query,
                    country_code=trip.country_idx if trip.country_idx else None,
                    region1_idx=trip.region1_idx if trip.region1_idx else None,
                    limit=limit
                )

                if not results:
                    return "😅 죄송합니다. 관련된 여행 경로를 찾지 못했습니다. 다른 키워드로 다시 검색해보세요."

                # 결과를 읽기 쉬운 형식으로 포맷팅
                response_lines = [f"🎯 '{query}' 검색 결과 ({len(results)}개의 추천 여행):"]
                response_lines.append("")

                for idx, result in enumerate(results, 1):
                    similarity_percent = int(result['similarity_score'] * 100)
                    response_lines.append(f"{idx}. **{result['title']}** (유사도: {similarity_percent}%)")

                    if result['channel']:
                        response_lines.append(f"   📺 채널: {result['channel']}")

                    location_parts = []
                    if result['country']:
                        location_parts.append(result['country'])
                    if result['city']:
                        location_parts.append(result['city'])
                    if location_parts:
                        response_lines.append(f"   📍 위치: {' - '.join(location_parts)}")

                    if result['views']:
                        response_lines.append(f"   👀 조회수: {result['views']:,}회")

                    if result['description']:
                        desc = result['description'][:100]
                        if len(result['description']) > 100:
                            desc += "..."
                        response_lines.append(f"   📝 {desc}")

                    # 일정 정보 (있으면)
                    if result['schedules']:
                        schedule_summary = []
                        for day_idx, day_schedule in enumerate(result['schedules'][:3], 1):  # 처음 3일만
                            if isinstance(day_schedule, list) and day_schedule:
                                places = " → ".join(day_schedule[:3])
                                if len(day_schedule) > 3:
                                    places += f" 외 {len(day_schedule) - 3}곳"
                                schedule_summary.append(f"Day{day_idx}: {places}")
                        if schedule_summary:
                            response_lines.append(f"   🗓️ {', '.join(schedule_summary)}")

                    if result['url']:
                        response_lines.append(f"   🔗 [영상 보기]({result['url']})")

                    response_lines.append("")  # 빈 줄

                response_lines.append("💡 이 여행 경로들을 참고하여 일정을 구성하시겠어요? 원하시는 장소를 말씀해주시면 일정에 추가해드리겠습니다!")

                logger.info(f"✨ RAG recommended {len(results)} trips for query: '{query}'")
                return "\n".join(response_lines)

            except TripPlan.DoesNotExist:
                return "❌ 여행 정보를 찾을 수 없습니다."
            except Exception as e:
                logger.error(f"❌ recommend_similar_trips error: {e}", exc_info=True)
                return f"❌ 추천 실패: {str(e)}"

        return [
            get_planner_info,
            search_on_map_and_add,     # 🆕 맵 검색 + 추가 통합 도구! (우선순위 높음)
            add_place_to_day,
            search_place,
            get_place_details,
            search_nearby,
            recommend_places,
            recommend_similar_trips,  # 🆕 RAG 도구 추가!
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
        from apps.chat.models import ChatRequest
        from apps.plans.models import TripPlan
        import time

        start_time = time.time()
        tools_used = []
        success = True
        error_msg = None
        result = ""
        request_type = None

        try:
            logger.info(f"🗣️ User message: {user_message}")

            # Agent executor는 'input' 키만 받습니다
            # trip_id와 room_id는 이미 프롬프트에 포함되어 있음
            response = self.agent_executor.invoke({
                "input": user_message,
            })

            result = response["output"]

            # Extract tools used from intermediate_steps
            if "intermediate_steps" in response:
                tools_used = [step[0].tool for step in response["intermediate_steps"]]

                # Infer request type from first tool used
                if tools_used:
                    first_tool = tools_used[0]
                    if "add_place" in first_tool or "delete_schedule" in first_tool or "update_schedule" in first_tool:
                        request_type = "schedule_edit"
                    elif "search" in first_tool:
                        request_type = "search"
                    elif "recommend" in first_tool:
                        request_type = "recommend"
                    elif "get_planner_info" in first_tool:
                        request_type = "info"
                    else:
                        request_type = "general"

            logger.info(f"🤖 Agent response: {result[:100]}...")
            logger.info(f"🔧 Tools used: {tools_used}")

        except Exception as e:
            logger.error(f"❌ Agent error: {e}", exc_info=True)
            result = f"죄송합니다. 오류가 발생했습니다: {str(e)}"
            success = False
            error_msg = str(e)

        finally:
            # Log request to database
            execution_time = int((time.time() - start_time) * 1000)

            try:
                trip = TripPlan.objects.get(trip_idx=self.trip_id)
                ChatRequest.objects.create(
                    room_idx_id=self.room_id,
                    user_idx=None,  # Will be set by consumer if available
                    trip_idx=trip,
                    user_message=user_message,
                    agent_response=result,
                    tools_used=tools_used if tools_used else None,
                    execution_time_ms=execution_time,
                    request_type=request_type,
                    success=success,
                    error_message=error_msg
                )
                logger.info(f"💾 Request logged - execution: {execution_time}ms, tools: {len(tools_used)}")
            except Exception as log_error:
                logger.error(f"Failed to log request: {log_error}")

        return result


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
