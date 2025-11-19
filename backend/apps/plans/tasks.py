"""
YouTube 크롤러 백그라운드 작업
"""
import os
import re
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


def run_youtube_crawler_task(job_idx: int, file_path: str):
    """
    YouTube 크롤러 실행 (동기 버전)
    Celery 없이 쓰레드로 실행
    """
    from django.utils import timezone
    from .models_youtube import YouTubeCrawlerJob
    from apps.accounts.models import User

    try:
        job = YouTubeCrawlerJob.objects.get(job_idx=job_idx)
        job.status = 'processing'
        job.started_at = timezone.now()
        job.save()

        # URL 읽기
        urls_data = read_youtube_urls(file_path)
        job.total_urls = len(urls_data)
        job.save()

        logger.info(f"[Job #{job_idx}] 총 {len(urls_data)}개 URL 처리 시작")

        # 각 영상 처리
        success_count = 0
        fail_count = 0

        # Owner 유저 (작업 생성자 또는 기본 admin)
        owner = job.created_by if job.created_by else User.objects.filter(
            is_staff=True
        ).first()

        if not owner:
            raise Exception("Owner 유저를 찾을 수 없습니다")

        for idx, data in enumerate(urls_data, 1):
            url = data['url']
            location = data['location']

            logger.info(f"[Job #{job_idx}] [{idx}/{len(urls_data)}] 처리 중: {location}")

            try:
                # 비디오 ID 추출
                video_id = extract_video_id(url)
                if not video_id:
                    logger.warning(f"비디오 ID 추출 실패: {url}")
                    fail_count += 1
                    continue

                # 영상 정보 추출
                video_info = extract_video_info(url, video_id)
                if not video_info or (not video_info.get('transcript') and not video_info.get('description')):
                    logger.warning(f"추출할 정보 없음: {url}")
                    fail_count += 1
                    continue

                # OpenAI 파싱
                parsed_data = parse_with_openai(video_info, location)
                if not parsed_data:
                    fail_count += 1
                    continue

                # 위치 매칭
                location_match = match_location(location)

                # RAG 데이터 저장 (trip_course_embeddings)
                embedding_id = save_to_database(parsed_data, location_match, video_info, url, location)

                if embedding_id:
                    success_count += 1
                    logger.info(f"[Job #{job_idx}] 성공: embedding_id={embedding_id}")
                else:
                    fail_count += 1

            except Exception as e:
                logger.error(f"[Job #{job_idx}] 오류: {e}")
                fail_count += 1

            # 진행 상황 업데이트
            job.processed_count = idx
            job.success_count = success_count
            job.fail_count = fail_count
            job.save()

        # 완료
        job.status = 'completed'
        job.completed_at = timezone.now()
        job.save()

        logger.info(f"[Job #{job_idx}] 완료: 성공 {success_count}, 실패 {fail_count}")

    except Exception as e:
        logger.error(f"[Job #{job_idx}] 치명적 오류: {e}")
        job.status = 'failed'
        job.error_message = str(e)
        job.completed_at = timezone.now()
        job.save()


def read_youtube_urls(file_path: str):
    """
    data.txt에서 YouTube URL 목록 읽기

    형식 (하나의 파일에 하나의 지역):
    지역명

    https://youtube.com/...

    https://youtube.com/...

    https://youtube.com/...
    """
    urls_data = []
    location = None

    with open(file_path, 'r', encoding='utf-8') as f:
        lines = [line.strip() for line in f if line.strip() and not line.strip().startswith('#')]

        if not lines:
            return urls_data

        # 첫 번째 줄이 지역명
        location = lines[0]

        # 나머지 줄에서 YouTube URL 추출
        for line in lines[1:]:
            # YouTube URL인지 확인
            if 'youtube.com' in line or 'youtu.be' in line:
                url_match = re.search(r'(https?://[^\s]+)', line)
                if url_match:
                    url = url_match.group(1)
                    urls_data.append({
                        'location': location,
                        'url': url,
                        'note': ''
                    })

    return urls_data


def extract_video_id(url: str) -> Optional[str]:
    """YouTube URL에서 비디오 ID 추출"""
    if 'youtu.be/' in url:
        return url.split('youtu.be/')[1].split('?')[0]
    elif 'youtube.com/watch?v=' in url:
        return url.split('v=')[1].split('&')[0]
    elif 'youtube.com/shorts/' in url:
        return url.split('shorts/')[1].split('?')[0]
    return None


def extract_video_info(url: str, video_id: str) -> Dict[str, Any]:
    """YouTube 영상 정보 추출"""
    try:
        import yt_dlp
        from youtube_transcript_api import YouTubeTranscriptApi
        from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound
        from datetime import datetime
    except ImportError as e:
        logger.error(f"필수 패키지 미설치: {e}")
        return {}

    result = {
        'video_id': video_id,
        'url': url,
        'title': None,
        'description': None,
        'transcript': None,
        'channel': None,
        'upload_date': None,
        'view_count': None
    }

    # 제목, 설명, 채널, 업로드일, 조회수 추출
    try:
        ydl_opts = {'quiet': True, 'no_warnings': True, 'extract_flat': False}
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            result['title'] = info.get('title', '')
            result['description'] = info.get('description', '')
            result['channel'] = info.get('uploader', '') or info.get('channel', '')
            result['view_count'] = info.get('view_count', 0)

            # upload_date는 'YYYYMMDD' 형식 (예: '20231015')
            upload_date_str = info.get('upload_date', '')
            if upload_date_str and len(upload_date_str) == 8:
                try:
                    upload_date = datetime.strptime(upload_date_str, '%Y%m%d')
                    result['upload_date'] = upload_date
                except:
                    pass
    except Exception as e:
        logger.warning(f"영상 정보 추출 실패: {e}")

    # 자막 추출
    try:
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
        transcript = None
        try:
            transcript = transcript_list.find_transcript(['ko'])
        except:
            try:
                transcript = transcript_list.find_generated_transcript(['ko'])
            except:
                pass

        if transcript:
            transcript_data = transcript.fetch()
            full_text = ' '.join([entry['text'] for entry in transcript_data])
            result['transcript'] = full_text
    except:
        pass

    return result


def parse_with_openai(video_info: Dict[str, Any], location: str) -> Optional[Dict]:
    """OpenAI로 파싱 - 영상 설명에서 여행 경로 추출"""
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

    # 원문 텍스트 (YouTube 설명이 메인, 자막은 보조)
    input_text = f"""
=== 영상 제목 ===
{video_info.get('title', '')}

=== 영상 설명 (메인 데이터) ===
{video_info.get('description', '')}

=== 자막 (참고용) ===
{video_info.get('transcript', '')[:2000] if video_info.get('transcript') else '없음'}
""".strip()

    system_prompt = """당신은 여행 일정을 분석하는 전문가입니다.
YouTube 여행 영상의 제목과 설명(주로 설명)을 보고 방문한 장소와 활동을 순서대로 추출하세요.

반드시 다음 JSON 형식으로 응답하세요:
{
  "title": "여행 제목",
  "location": "주요 여행지",
  "summary": "여행 전체 요약 (2-3문장)",
  "duration_days": 일수 (추정 가능할 때만),
  "places": [
    {
      "order": 1,
      "name": "장소명",
      "type": "place|meal|activity|accommodation|transfer",
      "description": "영상 설명에서 언급된 내용 그대로"
    }
  ]
}

**중요 규칙:**
1. 영상 설명에 명시된 장소만 추출 (추측하지 말 것)
2. 설명에 없는 정보(시간, 비용, 날짜)는 절대 만들지 말 것
3. 장소 설명은 영상 설명의 원문을 최대한 그대로 사용
4. type: place(관광지/명소), meal(식당/카페), activity(체험/액티비티), accommodation(숙소), transfer(이동수단)
5. 반드시 유효한 JSON만 반환"""

    user_prompt = f"위치: {location}\n\n{input_text}\n\n위 정보에서 방문한 장소와 활동을 순서대로 추출해주세요."

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.2,  # 더 낮춰서 hallucination 방지
            max_tokens=2000
        )

        result_text = response.choices[0].message.content.strip()

        # JSON 추출
        if '```json' in result_text:
            result_text = result_text.split('```json')[1].split('```')[0].strip()
        elif '```' in result_text:
            result_text = result_text.split('```')[1].split('```')[0].strip()

        return json.loads(result_text)

    except Exception as e:
        logger.error(f"OpenAI 파싱 오류: {e}")
        return None


def match_location(location_name: str) -> Dict[str, Optional[int]]:
    """위치 매칭"""
    from apps.common.models import Province, City, District

    result = {'province_idx': None, 'city_idx': None, 'district_idx': None}

    try:
        province = Province.objects.filter(province_name__icontains=location_name).first()
        if province:
            result['province_idx'] = province.province_idx
            return result

        city = City.objects.filter(city_name__icontains=location_name).first()
        if city:
            result['city_idx'] = city.city_idx
            result['province_idx'] = city.province_idx.province_idx if city.province_idx else None
            return result

        district = District.objects.filter(district_name__icontains=location_name).first()
        if district:
            result['district_idx'] = district.district_idx
            result['city_idx'] = district.city_idx.city_idx if district.city_idx else None
            if district.city_idx and district.city_idx.province_idx:
                result['province_idx'] = district.city_idx.province_idx.province_idx
            return result

    except Exception as e:
        logger.error(f"위치 매칭 오류: {e}")

    return result


def save_to_database(parsed_data: Dict, location_match: Dict, video_info: Dict, url: str, location_name: str):
    """trip_course_embeddings 테이블에 저장 (RAG용) - 3단계 구조"""
    try:
        from openai import OpenAI
        from apps.ai.models import TripCourseEmbedding

        # OpenAI 클라이언트
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            logger.error("OPENAI_API_KEY 없음")
            return None

        client = OpenAI(api_key=api_key)

        # ========================================
        # 1단계: 원문 (raw_content)
        # ========================================
        raw_content = f"""제목: {video_info.get('title', '')}

설명:
{video_info.get('description', '')}

자막:
{video_info.get('transcript', '')}
""".strip()

        # ========================================
        # 2단계: 파싱된 여행 경로 (parsed_itinerary)
        # ========================================
        # parsed_data가 이미 OpenAI로 파싱된 구조화된 데이터

        # ========================================
        # 3단계: 임베딩 벡터 (content_embedding)
        # ========================================
        # 파싱된 데이터를 텍스트로 변환하여 임베딩
        # 위치는 파일에서 읽은 location_name 사용 (검색 정확도 향상)
        embedding_text_parts = [
            f"제목: {parsed_data.get('title', '')}",
            f"위치: {location_name}",  # 파일에서 읽은 지역명 (예: "곡성")
            f"요약: {parsed_data.get('summary', '')}"
        ]

        # 장소 목록 추가
        for place in parsed_data.get('places', []):
            place_text = f"{place.get('order', 0)}. {place.get('name', '')} ({place.get('type', '')})"
            if place.get('description'):
                place_text += f": {place.get('description')}"
            embedding_text_parts.append(place_text)

        embedding_text = '\n'.join(embedding_text_parts)

        # OpenAI Embedding 생성
        embedding_response = client.embeddings.create(
            model="text-embedding-3-small",
            input=embedding_text
        )
        embedding_vector = embedding_response.data[0].embedding

        # Video ID 추출
        video_id = extract_video_id(url)

        # 업로드 날짜에서 year/month 추출
        upload_date = video_info.get('upload_date')
        upload_year = upload_date.year if upload_date else None
        upload_month = upload_date.month if upload_date else None

        # TripCourseEmbedding 저장 (3개 필드 모두 저장)
        embedding_obj = TripCourseEmbedding.objects.create(
            video_id=video_id,
            title=video_info.get('title', ''),
            channel=video_info.get('channel', ''),
            url=url,
            upload_year=upload_year,
            upload_month=upload_month,
            views_num=video_info.get('view_count', 0),
            raw_content=raw_content,              # 1. 원문
            parsed_itinerary=parsed_data,         # 2. 파싱된 여행 경로
            content_embedding=embedding_vector,   # 3. 임베딩 벡터
            province_idx=location_match.get('province_idx'),
            city_idx=location_match.get('city_idx'),
            district_idx=location_match.get('district_idx')
        )

        logger.info(f"RAG 데이터 저장 완료: {embedding_obj.id} (원문 {len(raw_content)}자, 장소 {len(parsed_data.get('places', []))}개)")
        return embedding_obj.id

    except Exception as e:
        logger.error(f"RAG 저장 실패: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return None
