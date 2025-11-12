"""
YouTube 여행 일정 크롤러 V2
자막 + 영상 설명을 모두 활용하여 정확한 일정 파싱

사용법:
    python youtube_crawler_v2.py --test     # 테스트 (5개만)
    python youtube_crawler_v2.py --dry-run  # 실제 저장 안함
    python youtube_crawler_v2.py            # 전체 실행
"""

import os
import sys
import re
import json
import logging
import argparse
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import django

# Django 설정
# Docker 또는 로컬 환경 자동 감지
if os.path.exists('/app'):
    sys.path.insert(0, '/app')
else:
    # 로컬 환경
    backend_path = os.path.join(os.path.dirname(__file__), '../backend')
    sys.path.insert(0, backend_path)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import transaction
from apps.accounts.models import User
from apps.plans.models import TripPlan, TripDay, TripItem
from apps.common.models import Province, City, District

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def read_youtube_urls(data_file='data.txt'):
    """data.txt에서 YouTube URL 목록 읽기"""
    if not os.path.exists(data_file):
        raise FileNotFoundError(f"{data_file} 파일이 없습니다")

    urls_data = []
    with open(data_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('-') or line.startswith('#'):
                continue

            # (위치) URL 형식 파싱
            match = re.match(r'\((.+?)\)\s*(.*?)\s*(https?://[^\s]+)', line)
            if match:
                location = match.group(1)
                note = match.group(2).strip()
                url = match.group(3)

                # 캡션 여부 체크
                has_caption = '캡션' in note or '자막' in note

                urls_data.append({
                    'location': location,
                    'url': url,
                    'has_caption': has_caption,
                    'note': note
                })

    logger.info(f"📋 총 {len(urls_data)}개의 YouTube URL 발견")
    return urls_data


def extract_video_info(url: str, video_id: str) -> Dict[str, Any]:
    """
    YouTube 영상의 제목, 설명, 자막을 모두 추출
    """
    try:
        import yt_dlp
        from youtube_transcript_api import YouTubeTranscriptApi
        from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound
    except ImportError as e:
        logger.error(f"필수 패키지 미설치: {e}")
        return None

    result = {
        'video_id': video_id,
        'url': url,
        'title': None,
        'description': None,
        'transcript': None
    }

    # 1. yt-dlp로 제목과 설명 추출
    try:
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': True,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            result['title'] = info.get('title', '')
            result['description'] = info.get('description', '')

        logger.info(f"  ✅ 제목: {result['title'][:50]}...")
        logger.info(f"  ✅ 설명: {len(result['description'])} 글자")
    except Exception as e:
        logger.warning(f"  ⚠️ 영상 정보 추출 실패: {e}")

    # 2. 자막 추출
    try:
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)

        transcript = None
        try:
            # 한국어 자막 우선
            transcript = transcript_list.find_transcript(['ko'])
        except:
            try:
                # 자동 생성 자막
                transcript = transcript_list.find_generated_transcript(['ko'])
            except:
                pass

        if transcript:
            transcript_data = transcript.fetch()
            full_text = ' '.join([entry['text'] for entry in transcript_data])
            result['transcript'] = full_text
            logger.info(f"  ✅ 자막: {len(full_text)} 글자")
        else:
            logger.warning(f"  ⚠️ 한국어 자막 없음")

    except (TranscriptsDisabled, NoTranscriptFound):
        logger.warning(f"  ⚠️ 자막 사용 불가")
    except Exception as e:
        logger.warning(f"  ⚠️ 자막 추출 실패: {e}")

    return result


def parse_with_openai(video_info: Dict[str, Any], location: str) -> Optional[Dict]:
    """
    OpenAI로 영상 정보를 파싱하여 DB 스키마에 맞는 형태로 변환
    """
    try:
        from openai import OpenAI
    except ImportError:
        logger.error("openai 패키지가 설치되지 않았습니다")
        return None

    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        logger.error("OPENAI_API_KEY 환경 변수가 설정되지 않았습니다")
        return None

    client = OpenAI(api_key=api_key)

    # 입력 텍스트 구성 (자막 + 설명)
    input_text = f"""
=== 영상 제목 ===
{video_info.get('title', '')}

=== 영상 설명 ===
{video_info.get('description', '')}

=== 자막 ===
{video_info.get('transcript', '')}
""".strip()

    # OpenAI 프롬프트
    system_prompt = """당신은 여행 일정을 분석하는 전문가입니다.
YouTube 여행 영상의 제목, 설명, 자막을 보고 day-by-day 일정을 추출하세요.

반드시 다음 JSON 형식으로 응답하세요:
{
  "title": "여행 제목 (예: 제주도 2박 3일)",
  "location": "주요 여행지 (예: 제주)",
  "duration_days": 일수 (숫자),
  "start_date": "YYYY-MM-DD 또는 null (정확한 날짜 있을 때만)",
  "days": [
    {
      "day_number": 1,
      "date": "YYYY-MM-DD 또는 null",
      "activities": [
        {
          "start_time": "HH:MM 또는 null (24시간 형식)",
          "end_time": "HH:MM 또는 null",
          "title": "장소명 또는 활동명",
          "item_type": "place|meal|activity|transfer|rest",
          "notes": "추가 설명",
          "estimated_cost": 숫자 또는 null
        }
      ]
    }
  ]
}

item_type 분류 기준:
- place: 관광지, 명소, 카페, 숙소 등
- meal: 식사, 음식점
- activity: 체험, 액티비티
- transfer: 이동, 교통
- rest: 휴식, 자유시간

중요: 반드시 유효한 JSON만 반환하고, 추가 설명은 넣지 마세요."""

    user_prompt = f"""위치: {location}

{input_text}

위 정보에서 day-by-day 여행 일정을 추출해주세요."""

    try:
        logger.info(f"  🤖 OpenAI 파싱 중... (입력: {len(input_text)} 글자)")

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.3,
            max_tokens=2000
        )

        result_text = response.choices[0].message.content.strip()

        # JSON 추출 (```json ... ``` 제거)
        if '```json' in result_text:
            result_text = result_text.split('```json')[1].split('```')[0].strip()
        elif '```' in result_text:
            result_text = result_text.split('```')[1].split('```')[0].strip()

        parsed_data = json.loads(result_text)

        logger.info(f"  ✅ 파싱 완료: {parsed_data.get('title')} ({parsed_data.get('duration_days')}일)")
        return parsed_data

    except json.JSONDecodeError as e:
        logger.error(f"  ❌ JSON 파싱 실패: {e}")
        logger.error(f"  응답: {result_text[:200]}...")
        return None
    except Exception as e:
        logger.error(f"  ❌ OpenAI API 오류: {e}")
        return None


def match_location(location_name: str) -> Dict[str, Optional[int]]:
    """
    위치 이름으로 DB에서 province/city/district 매칭
    """
    result = {
        'province_idx': None,
        'city_idx': None,
        'district_idx': None
    }

    try:
        # Province 매칭
        province = Province.objects.filter(province_name__icontains=location_name).first()
        if province:
            result['province_idx'] = province.province_idx
            logger.info(f"    📍 Province 매칭: {province.province_name}")
            return result

        # City 매칭
        city = City.objects.filter(city_name__icontains=location_name).first()
        if city:
            result['city_idx'] = city.city_idx
            result['province_idx'] = city.province_idx.province_idx if city.province_idx else None
            logger.info(f"    📍 City 매칭: {city.city_name}")
            return result

        # District 매칭
        district = District.objects.filter(district_name__icontains=location_name).first()
        if district:
            result['district_idx'] = district.district_idx
            result['city_idx'] = district.city_idx.city_idx if district.city_idx else None
            if district.city_idx and district.city_idx.province_idx:
                result['province_idx'] = district.city_idx.province_idx.province_idx
            logger.info(f"    📍 District 매칭: {district.district_name}")
            return result

        logger.warning(f"    ⚠️ 위치 매칭 실패: {location_name}")

    except Exception as e:
        logger.error(f"    ❌ 위치 매칭 오류: {e}")

    return result


def save_to_database(parsed_data: Dict, location_match: Dict, owner_user_idx: int, dry_run: bool = False):
    """
    파싱된 데이터를 DB에 저장
    """
    if dry_run:
        logger.info(f"  🔍 [DRY RUN] DB 저장 시뮬레이션")
        logger.info(f"     - Title: {parsed_data.get('title')}")
        logger.info(f"     - Days: {len(parsed_data.get('days', []))}")
        logger.info(f"     - Items: {sum(len(day.get('activities', [])) for day in parsed_data.get('days', []))}")
        return None

    try:
        with transaction.atomic():
            # 1. TripPlan 생성
            start_date = parsed_data.get('start_date')
            if not start_date:
                # 날짜가 없으면 오늘부터 시작
                start_date = datetime.now().date()
            else:
                start_date = datetime.strptime(start_date, '%Y-%m-%d').date()

            duration = parsed_data.get('duration_days', 1)
            end_date = start_date + timedelta(days=duration - 1)

            trip_plan = TripPlan.objects.create(
                owner_user_idx_id=owner_user_idx,
                title=parsed_data.get('title', '제목 없음'),
                province_idx_id=location_match.get('province_idx'),
                city_idx_id=location_match.get('city_idx'),
                district_idx_id=location_match.get('district_idx'),
                start_date=start_date,
                end_date=end_date,
                status='draft'
            )

            logger.info(f"  ✅ TripPlan 생성: {trip_plan.trip_idx}")

            # 2. TripDay 및 TripItem 생성
            for day_data in parsed_data.get('days', []):
                day_number = day_data.get('day_number', 1)
                day_date = day_data.get('date')

                if not day_date:
                    # 날짜가 없으면 시작일 기준으로 계산
                    day_date = start_date + timedelta(days=day_number - 1)
                else:
                    day_date = datetime.strptime(day_date, '%Y-%m-%d').date()

                trip_day = TripDay.objects.create(
                    trip_idx=trip_plan,
                    day_no=day_number,
                    date=day_date
                )

                # TripItem 생성
                for order, activity in enumerate(day_data.get('activities', []), 1):
                    # 시간 파싱
                    start_time = activity.get('start_time')
                    end_time = activity.get('end_time')

                    if start_time and ':' in start_time:
                        try:
                            start_time = datetime.strptime(start_time, '%H:%M').time()
                        except:
                            start_time = None
                    else:
                        start_time = None

                    if end_time and ':' in end_time:
                        try:
                            end_time = datetime.strptime(end_time, '%H:%M').time()
                        except:
                            end_time = None
                    else:
                        end_time = None

                    # item_type 검증
                    item_type = activity.get('item_type', 'custom')
                    valid_types = ['place', 'meal', 'activity', 'transfer', 'rest', 'custom']
                    if item_type not in valid_types:
                        item_type = 'custom'

                    TripItem.objects.create(
                        day_idx=trip_day,
                        item_type=item_type,
                        title=activity.get('title', '제목 없음'),
                        start_time=start_time,
                        end_time=end_time,
                        estimated_cost=activity.get('estimated_cost'),
                        notes=activity.get('notes', ''),
                        order_in_day=order
                    )

                logger.info(f"    ✅ Day {day_number}: {len(day_data.get('activities', []))}개 항목")

            logger.info(f"  🎉 DB 저장 완료: trip_idx={trip_plan.trip_idx}")
            return trip_plan.trip_idx

    except Exception as e:
        logger.error(f"  ❌ DB 저장 실패: {e}")
        import traceback
        traceback.print_exc()
        return None


def main():
    parser = argparse.ArgumentParser(description='YouTube 여행 일정 크롤러 V2')
    parser.add_argument('--test', action='store_true', help='테스트 모드 (5개만 처리)')
    parser.add_argument('--dry-run', action='store_true', help='실제 DB 저장 안함')
    parser.add_argument('--skip-openai', action='store_true', help='OpenAI 파싱 스킵')
    parser.add_argument('--user-email', default='admin@test.com', help='Owner 이메일')
    args = parser.parse_args()

    logger.info("=" * 80)
    logger.info("🎬 YouTube 여행 일정 크롤러 V2 시작")
    logger.info("=" * 80)

    # Owner 유저 확인
    try:
        owner = User.objects.get(email=args.user_email)
        logger.info(f"👤 Owner: {owner.email} (user_idx={owner.user_idx})")
    except User.DoesNotExist:
        logger.error(f"❌ 유저를 찾을 수 없습니다: {args.user_email}")
        return

    # Step 1: URL 읽기
    logger.info("\n📋 Step 1: data.txt 읽기")
    urls_data = read_youtube_urls('data.txt')

    if args.test:
        urls_data = urls_data[:5]
        logger.info(f"🧪 테스트 모드: 처음 5개만 처리")

    # Step 2: 각 영상 처리
    logger.info(f"\n🎬 Step 2: YouTube 영상 처리 시작 (총 {len(urls_data)}개)")

    success_count = 0
    fail_count = 0

    for idx, data in enumerate(urls_data, 1):
        url = data['url']
        location = data['location']

        logger.info(f"\n[{idx}/{len(urls_data)}] 🎥 처리 중: {location}")
        logger.info(f"  URL: {url}")

        # 비디오 ID 추출
        video_id = None
        if 'youtu.be/' in url:
            video_id = url.split('youtu.be/')[1].split('?')[0]
        elif 'youtube.com/watch?v=' in url:
            video_id = url.split('v=')[1].split('&')[0]
        elif 'youtube.com/shorts/' in url:
            video_id = url.split('shorts/')[1].split('?')[0]

        if not video_id:
            logger.warning(f"  ⚠️ 비디오 ID 추출 실패")
            fail_count += 1
            continue

        # 영상 정보 추출
        video_info = extract_video_info(url, video_id)
        if not video_info or (not video_info['transcript'] and not video_info['description']):
            logger.warning(f"  ⚠️ 추출할 정보가 없습니다")
            fail_count += 1
            continue

        # OpenAI 파싱
        if args.skip_openai:
            logger.info(f"  ⏭️ OpenAI 파싱 스킵")
            continue

        parsed_data = parse_with_openai(video_info, location)
        if not parsed_data:
            fail_count += 1
            continue

        # 위치 매칭
        location_match = match_location(location)

        # DB 저장
        trip_idx = save_to_database(parsed_data, location_match, owner.user_idx, dry_run=args.dry_run)

        if trip_idx:
            success_count += 1
        else:
            fail_count += 1

    # 결과 요약
    logger.info("\n" + "=" * 80)
    logger.info("📊 처리 완료!")
    logger.info("=" * 80)
    logger.info(f"✅ 성공: {success_count}개")
    logger.info(f"❌ 실패: {fail_count}개")
    logger.info(f"📝 총 처리: {success_count + fail_count}개")
    logger.info("=" * 80)


if __name__ == '__main__':
    main()
