"""
YouTube 여행 영상에서 일정 데이터를 크롤링하는 Airflow DAG

프로세스:
1. data.txt에서 유튜브 URL 읽기
2. 유튜브 자막 추출
3. OpenAI API로 일정 파싱
4. 위치 정보 매칭
5. DB에 일정 저장
"""

from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.utils.dates import days_ago
from datetime import datetime, timedelta
import os
import sys
import re
import json
import logging

# Airflow 프로젝트 루트를 Python path에 추가
sys.path.insert(0, '/opt/airflow')

logger = logging.getLogger(__name__)

# DAG 기본 설정
default_args = {
    'owner': 'airflow',
    'depends_on_past': False,
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
}

dag = DAG(
    'youtube_trip_crawler',
    default_args=default_args,
    description='YouTube 여행 영상에서 일정 추출',
    schedule_interval=None,  # 수동 실행
    start_date=days_ago(1),
    catchup=False,
    tags=['youtube', 'trip', 'crawl'],
)


def read_youtube_urls(**context):
    """data.txt에서 YouTube URL 목록 읽기"""
    data_file = '/opt/airflow/data.txt'

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

    logger.info(f"총 {len(urls_data)}개의 YouTube URL 발견")

    # XCom에 저장
    context['task_instance'].xcom_push(key='urls_data', value=urls_data)
    return len(urls_data)


def extract_youtube_transcript(**context):
    """YouTube 영상에서 자막 추출"""
    from youtube_transcript_api import YouTubeTranscriptApi
    from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound

    urls_data = context['task_instance'].xcom_pull(key='urls_data', task_ids='read_urls')

    # 테스트를 위해 처음 5개만 처리
    test_mode = context['dag_run'].conf.get('test_mode', True)
    if test_mode:
        urls_data = urls_data[:5]
        logger.info("테스트 모드: 처음 5개 영상만 처리")

    transcripts = []

    for idx, data in enumerate(urls_data, 1):
        url = data['url']
        location = data['location']

        # YouTube 비디오 ID 추출
        video_id = None
        if 'youtu.be/' in url:
            video_id = url.split('youtu.be/')[1].split('?')[0]
        elif 'youtube.com/watch?v=' in url:
            video_id = url.split('v=')[1].split('&')[0]
        elif 'youtube.com/shorts/' in url:
            video_id = url.split('shorts/')[1].split('?')[0]

        if not video_id:
            logger.warning(f"[{idx}/{len(urls_data)}] 비디오 ID 추출 실패: {url}")
            continue

        try:
            logger.info(f"[{idx}/{len(urls_data)}] 자막 추출 중: {location} - {video_id}")

            # 한국어 자막 시도
            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)

            transcript = None
            try:
                # 먼저 수동 생성 한국어 자막 시도
                transcript = transcript_list.find_manually_created_transcript(['ko'])
            except:
                # 자동 생성 자막 시도
                try:
                    transcript = transcript_list.find_generated_transcript(['ko'])
                except:
                    logger.warning(f"한국어 자막 없음: {video_id}")
                    continue

            if transcript:
                # 자막 텍스트 가져오기
                transcript_data = transcript.fetch()
                full_text = ' '.join([entry['text'] for entry in transcript_data])

                transcripts.append({
                    'video_id': video_id,
                    'location': location,
                    'url': url,
                    'transcript': full_text,
                    'note': data.get('note', '')
                })

                logger.info(f"✅ 자막 추출 성공: {location} ({len(full_text)} 글자)")

        except TranscriptsDisabled:
            logger.warning(f"자막 비활성화됨: {video_id}")
        except NoTranscriptFound:
            logger.warning(f"자막 없음: {video_id}")
        except Exception as e:
            logger.error(f"자막 추출 실패: {video_id} - {str(e)}")

    logger.info(f"총 {len(transcripts)}개 영상의 자막 추출 완료")

    # XCom에 저장
    context['task_instance'].xcom_push(key='transcripts', value=transcripts)
    return len(transcripts)


def parse_itinerary_with_openai(**context):
    """OpenAI API를 사용하여 자막에서 여행 일정 추출"""
    import openai

    transcripts = context['task_instance'].xcom_pull(key='transcripts', task_ids='extract_transcript')

    # OpenAI API 키 설정
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        raise ValueError("OPENAI_API_KEY 환경 변수가 설정되지 않았습니다")

    openai.api_key = api_key

    parsed_itineraries = []

    for idx, data in enumerate(transcripts, 1):
        location = data['location']
        transcript = data['transcript']

        # 자막이 너무 길면 처음 3000자만 사용
        if len(transcript) > 3000:
            transcript = transcript[:3000] + "..."

        logger.info(f"[{idx}/{len(transcripts)}] 일정 파싱 중: {location}")

        try:
            # OpenAI API 호출
            response = openai.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": """당신은 여행 일정을 분석하는 전문가입니다.
YouTube 여행 영상의 자막을 분석하여 여행 일정을 DAY별로 구조화된 JSON으로 추출하세요.

응답 형식:
{
  "title": "여행 제목",
  "location": "주요 여행지",
  "duration_days": 숫자,
  "days": [
    {
      "day_number": 1,
      "date": "YYYY-MM-DD or null",
      "activities": [
        {
          "time": "HH:MM or 오전/오후",
          "place_name": "장소명",
          "activity_type": "place/meal/activity/transfer",
          "description": "활동 설명",
          "address": "주소 (있으면)"
        }
      ]
    }
  ]
}

주의사항:
- 정확한 날짜를 알 수 없으면 date는 null로 설정
- activity_type은 place(관광지), meal(식사), activity(활동), transfer(이동) 중 하나
- 시간 정보가 없으면 "시간미정"으로 설정
- 일정이 명확하지 않으면 빈 배열 반환"""
                    },
                    {
                        "role": "user",
                        "content": f"다음은 '{location}' 여행 영상의 자막입니다. 여행 일정을 추출해주세요:\n\n{transcript}"
                    }
                ],
                temperature=0.3,
                max_tokens=2000
            )

            # 응답 파싱
            result_text = response.choices[0].message.content.strip()

            # JSON 추출 (```json ... ``` 형식일 수 있음)
            json_match = re.search(r'```json\s*(.*?)\s*```', result_text, re.DOTALL)
            if json_match:
                result_text = json_match.group(1)

            itinerary = json.loads(result_text)

            parsed_itineraries.append({
                'video_id': data['video_id'],
                'url': data['url'],
                'location': location,
                'itinerary': itinerary
            })

            logger.info(f"✅ 일정 파싱 성공: {location} - {itinerary.get('duration_days', 0)}일")

        except json.JSONDecodeError as e:
            logger.error(f"JSON 파싱 실패: {location} - {str(e)}")
            logger.debug(f"응답 내용: {result_text}")
        except Exception as e:
            logger.error(f"OpenAI API 오류: {location} - {str(e)}")

    logger.info(f"총 {len(parsed_itineraries)}개 일정 파싱 완료")

    # XCom에 저장
    context['task_instance'].xcom_push(key='parsed_itineraries', value=parsed_itineraries)
    return len(parsed_itineraries)


def match_locations(**context):
    """파싱된 장소를 DB의 위치 정보와 매칭"""
    import psycopg2
    from psycopg2.extras import RealDictCursor

    parsed_itineraries = context['task_instance'].xcom_pull(key='parsed_itineraries', task_ids='parse_itinerary')

    # DB 연결
    conn = psycopg2.connect(
        host=os.getenv('DB_HOST', 'postgres'),
        port=os.getenv('DB_PORT', '5432'),
        database=os.getenv('DB_NAME', 'triplan'),
        user=os.getenv('DB_USER', 'postgres'),
        password=os.getenv('DB_PASSWORD', 'postgres')
    )

    matched_data = []

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            for data in parsed_itineraries:
                location = data['location']
                itinerary = data['itinerary']

                # 위치 정보 검색 (Province, City, District)
                province_idx = None
                city_idx = None
                district_idx = None

                # 1. Province 검색
                cur.execute("""
                    SELECT province_idx FROM common_provinces
                    WHERE name LIKE %s OR name = %s
                    LIMIT 1
                """, (f'%{location}%', location))

                row = cur.fetchone()
                if row:
                    province_idx = row['province_idx']

                # 2. City 검색
                cur.execute("""
                    SELECT city_idx, province_idx FROM common_cities
                    WHERE name LIKE %s OR name = %s
                    LIMIT 1
                """, (f'%{location}%', location))

                row = cur.fetchone()
                if row:
                    city_idx = row['city_idx']
                    if not province_idx:
                        province_idx = row['province_idx']

                # 3. District 검색
                cur.execute("""
                    SELECT district_idx, city_idx FROM common_districts
                    WHERE name LIKE %s OR name = %s
                    LIMIT 1
                """, (f'%{location}%', location))

                row = cur.fetchone()
                if row:
                    district_idx = row['district_idx']
                    if not city_idx:
                        city_idx = row['city_idx']

                matched_data.append({
                    **data,
                    'province_idx': province_idx,
                    'city_idx': city_idx,
                    'district_idx': district_idx
                })

                logger.info(f"위치 매칭: {location} -> province:{province_idx}, city:{city_idx}, district:{district_idx}")

    finally:
        conn.close()

    logger.info(f"총 {len(matched_data)}개 위치 매칭 완료")

    # XCom에 저장
    context['task_instance'].xcom_push(key='matched_data', value=matched_data)
    return len(matched_data)


def save_to_database(**context):
    """파싱된 일정을 데이터베이스에 저장"""
    import psycopg2
    from psycopg2.extras import execute_values
    from datetime import datetime, timedelta

    matched_data = context['task_instance'].xcom_pull(key='matched_data', task_ids='match_locations')

    # DB 연결
    conn = psycopg2.connect(
        host=os.getenv('DB_HOST', 'postgres'),
        port=os.getenv('DB_PORT', '5432'),
        database=os.getenv('DB_NAME', 'triplan'),
        user=os.getenv('DB_USER', 'postgres'),
        password=os.getenv('DB_PASSWORD', 'postgres')
    )

    saved_count = 0

    try:
        with conn.cursor() as cur:
            # 시스템 사용자 가져오기 (또는 생성)
            cur.execute("""
                SELECT user_idx FROM user_users
                WHERE email = 'system@triplan.com'
                LIMIT 1
            """)

            row = cur.fetchone()
            if row:
                owner_user_idx = row[0]
            else:
                # 시스템 사용자 생성
                cur.execute("""
                    INSERT INTO user_users (email, password_hash, status, created_at)
                    VALUES ('system@triplan.com', '', 'active', NOW())
                    RETURNING user_idx
                """)
                owner_user_idx = cur.fetchone()[0]
                conn.commit()

            for data in matched_data:
                itinerary = data['itinerary']

                # TripPlan 생성
                title = itinerary.get('title', f"{data['location']} 여행")
                duration_days = itinerary.get('duration_days', len(itinerary.get('days', [])))

                # 시작 날짜 (오늘 + 7일)
                start_date = (datetime.now() + timedelta(days=7)).date()
                end_date = start_date + timedelta(days=duration_days - 1)

                cur.execute("""
                    INSERT INTO trip_plans (
                        owner_user_idx, title, country_idx, province_idx, city_idx, district_idx,
                        start_date, end_date, status, created_at, updated_at
                    )
                    VALUES (%s, %s, 1, %s, %s, %s, %s, %s, 'confirmed', NOW(), NOW())
                    RETURNING trip_idx
                """, (
                    owner_user_idx, title,
                    data.get('province_idx'), data.get('city_idx'), data.get('district_idx'),
                    start_date, end_date
                ))

                trip_idx = cur.fetchone()[0]

                # TripDay 및 TripItem 생성
                for day_info in itinerary.get('days', []):
                    day_no = day_info.get('day_number', 1)
                    day_date = start_date + timedelta(days=day_no - 1)

                    cur.execute("""
                        INSERT INTO trip_days (trip_idx, day_no, date)
                        VALUES (%s, %s, %s)
                        RETURNING day_idx
                    """, (trip_idx, day_no, day_date))

                    day_idx = cur.fetchone()[0]

                    # Activities 추가
                    for seq, activity in enumerate(day_info.get('activities', []), 1):
                        place_name = activity.get('place_name', '장소명 없음')
                        description = activity.get('description', '')
                        activity_type = activity.get('activity_type', 'place')

                        # item_type 매핑
                        if activity_type not in ['place', 'meal', 'activity', 'transfer']:
                            activity_type = 'place'

                        cur.execute("""
                            INSERT INTO trip_items (
                                day_idx, item_type, title, notes, sequence_no,
                                created_at, updated_at
                            )
                            VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
                        """, (day_idx, activity_type, place_name, description, seq))

                conn.commit()
                saved_count += 1
                logger.info(f"✅ 저장 완료: {title} (trip_idx: {trip_idx})")

    except Exception as e:
        conn.rollback()
        logger.error(f"DB 저장 실패: {str(e)}")
        raise
    finally:
        conn.close()

    logger.info(f"총 {saved_count}개 일정 DB 저장 완료")
    return saved_count


# Task 정의
read_urls_task = PythonOperator(
    task_id='read_urls',
    python_callable=read_youtube_urls,
    dag=dag,
)

extract_transcript_task = PythonOperator(
    task_id='extract_transcript',
    python_callable=extract_youtube_transcript,
    dag=dag,
)

parse_itinerary_task = PythonOperator(
    task_id='parse_itinerary',
    python_callable=parse_itinerary_with_openai,
    dag=dag,
)

match_locations_task = PythonOperator(
    task_id='match_locations',
    python_callable=match_locations,
    dag=dag,
)

save_to_db_task = PythonOperator(
    task_id='save_to_db',
    python_callable=save_to_database,
    dag=dag,
)

# Task 의존성 설정
read_urls_task >> extract_transcript_task >> parse_itinerary_task >> match_locations_task >> save_to_db_task
