"""
기상청 API를 이용한 전국 시/도 → 시/군/구 → 읍/면/동 계층 크롤링
"""

import requests
import json
import time
from typing import List, Dict


def load_sido_data(file_path: str = "sido.json") -> List[Dict]:
    """
    시/도 데이터 로드

    Args:
        file_path: sido.json 파일 경로

    Returns:
        list: 시/도 데이터 리스트
    """
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def get_cities(wide_code: str) -> List[Dict]:
    """
    시/군/구 데이터 가져오기

    Args:
        wide_code: 시/도 코드 (예: 5100000000)

    Returns:
        list: 시/군/구 데이터 리스트
    """
    # 코드 형식 변환 (510000000000 → 5100000000)
    if len(wide_code) == 12:
        wide_code = wide_code[:10]

    url = "https://www.weather.go.kr/w/rest/zone/dong.do"
    params = {
        "type": "CITY",
        "wideCode": wide_code,
        "cityCode": "",
        "keyword": "",
        "keywordStart": "",
        "keywordEnd": ""
    }

    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()

        data = response.json()
        return data if isinstance(data, list) else []

    except Exception as e:
        print(f"  ❌ 시/군/구 조회 실패 ({wide_code}): {e}")
        return []


def get_districts(wide_code: str, city_code: str) -> List[Dict]:
    """
    읍/면/동 데이터 가져오기

    Args:
        wide_code: 시/도 코드 (예: 5100000000)
        city_code: 시/군/구 코드 (예: 5115000000)

    Returns:
        list: 읍/면/동 데이터 리스트
    """
    # 코드 형식 변환
    if len(wide_code) == 12:
        wide_code = wide_code[:10]

    url = "https://www.weather.go.kr/w/rest/zone/dong.do"
    params = {
        "type": "DONG",
        "wideCode": wide_code,
        "cityCode": city_code,
        "keyword": "",
        "keywordStart": "",
        "keywordEnd": ""
    }

    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()

        data = response.json()
        return data if isinstance(data, list) else []

    except Exception as e:
        print(f"  ❌ 읍/면/동 조회 실패 ({city_code}): {e}")
        return []


def crawl_all_regions(sido_file: str = "sido.json", delay: float = 0.5) -> Dict:
    """
    전국 모든 지역 데이터 크롤링

    Args:
        sido_file: 시/도 JSON 파일 경로
        delay: API 요청 간격 (초)

    Returns:
        dict: {
            'provinces': [...],  # 시/도
            'cities': [...],     # 시/군/구
            'districts': [...],  # 읍/면/동
            'hierarchy': [...]   # 계층 구조
        }
    """

    print("=" * 80)
    print("🌦️ 기상청 전국 지역 데이터 크롤링")
    print("=" * 80)

    # 1. 시/도 데이터 로드
    print(f"\n📂 시/도 데이터 로드: {sido_file}")
    provinces = load_sido_data(sido_file)
    print(f"✅ {len(provinces)}개 시/도 로드")

    all_cities = []
    all_districts = []
    hierarchy = []

    total_provinces = len(provinces)

    # 2. 각 시/도별로 시/군/구, 읍/면/동 크롤링
    for idx, province in enumerate(provinces, 1):
        province_code = province['code']
        province_name = province['name']

        print(f"\n[{idx}/{total_provinces}] 🏙️ {province_name} ({province_code})")

        # 2-1. 시/군/구 가져오기
        print(f"  🔍 시/군/구 조회 중...")
        cities = get_cities(province_code)

        if not cities:
            print(f"  ⚠️ 시/군/구 없음")
            hierarchy.append({
                **province,
                'cities': []
            })
            time.sleep(delay)
            continue

        print(f"  ✅ {len(cities)}개 시/군/구 발견")

        province_hierarchy = {
            **province,
            'cities': []
        }

        # 2-2. 각 시/군/구의 읍/면/동 가져오기
        for city_idx, city in enumerate(cities, 1):
            city_code = city['code']
            city_name = city['name']

            print(f"    [{city_idx}/{len(cities)}] 📍 {city_name} ({city_code})")

            # 읍/면/동 조회
            print(f"      🔍 읍/면/동 조회 중...")
            districts = get_districts(province_code, city_code)

            if districts:
                print(f"      ✅ {len(districts)}개 읍/면/동")
                all_districts.extend(districts)
            else:
                print(f"      ⚠️ 읍/면/동 없음")

            # 계층 구조에 추가
            city_hierarchy = {
                **city,
                'parent_code': province_code,
                'districts': districts
            }
            province_hierarchy['cities'].append(city_hierarchy)

            # 전체 리스트에 추가
            all_cities.append(city)

            # API 부하 방지
            time.sleep(delay)

        hierarchy.append(province_hierarchy)

        # 시/도 간 대기
        time.sleep(delay)

    # 3. 결과 정리
    result = {
        'provinces': provinces,
        'cities': all_cities,
        'districts': all_districts,
        'hierarchy': hierarchy
    }

    print("\n" + "=" * 80)
    print("📊 크롤링 완료!")
    print("=" * 80)
    print(f"시/도: {len(provinces)}개")
    print(f"시/군/구: {len(all_cities)}개")
    print(f"읍/면/동: {len(all_districts)}개")
    print("=" * 80)

    return result


def save_results(data: Dict, output_file: str = "all_regions.json"):
    """
    크롤링 결과 저장

    Args:
        data: 크롤링 데이터
        output_file: 출력 파일명
    """

    print(f"\n💾 데이터 저장 중: {output_file}")

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"✅ 저장 완료!")

    # 파일 크기 확인
    import os
    file_size = os.path.getsize(output_file)
    print(f"📊 파일 크기: {file_size:,} bytes ({file_size / 1024 / 1024:.2f} MB)")


def save_separate_files(data: Dict, output_dir: str = "weather_regions"):
    """
    데이터를 개별 파일로 저장

    Args:
        data: 크롤링 데이터
        output_dir: 출력 디렉토리
    """

    import os

    os.makedirs(output_dir, exist_ok=True)

    # 1. 평면 구조 저장
    files = {
        'provinces.json': data['provinces'],
        'cities.json': data['cities'],
        'districts.json': data['districts'],
        'hierarchy.json': data['hierarchy']
    }

    for filename, content in files.items():
        filepath = os.path.join(output_dir, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(content, f, ensure_ascii=False, indent=2)
        print(f"💾 {filepath}: {len(content)}개")

    # 2. 요약 정보
    summary = {
        'total_provinces': len(data['provinces']),
        'total_cities': len(data['cities']),
        'total_districts': len(data['districts']),
        'crawled_at': time.strftime('%Y-%m-%d %H:%M:%S'),
        'provinces': [
            {
                'code': p['code'],
                'name': p['name'],
                'cities_count': len([c for c in data['cities'] if c['code'].startswith(p['code'][:2])]),
                'districts_count': len([d for d in data['districts'] if d['code'].startswith(p['code'][:2])])
            }
            for p in data['provinces']
        ]
    }

    summary_file = os.path.join(output_dir, 'summary.json')
    with open(summary_file, 'w', encoding='utf-8') as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print(f"💾 {summary_file}: 요약 정보")


def main():
    """메인 실행 함수"""

    import argparse

    parser = argparse.ArgumentParser(description='기상청 전국 지역 크롤링')
    parser.add_argument('--sido-file', default='sido.json', help='시/도 JSON 파일')
    parser.add_argument('--output', default='all_regions.json', help='통합 출력 파일')
    parser.add_argument('--output-dir', default='weather_regions', help='개별 파일 출력 디렉토리')
    parser.add_argument('--delay', type=float, default=0.5, help='API 요청 간격 (초)')
    parser.add_argument('--test', action='store_true', help='테스트 모드 (첫 2개 시/도만)')

    args = parser.parse_args()

    # 크롤링 실행
    data = crawl_all_regions(args.sido_file, args.delay)

    # 테스트 모드
    if args.test:
        print("\n⚠️ 테스트 모드: 첫 2개 시/도만 저장")
        data['provinces'] = data['provinces'][:2]
        data['hierarchy'] = data['hierarchy'][:2]

    # 결과 저장
    save_results(data, args.output)
    save_separate_files(data, args.output_dir)

    # 샘플 출력
    print("\n" + "=" * 80)
    print("📍 데이터 샘플")
    print("=" * 80)

    if data['provinces']:
        print(f"\n시/도 예시: {data['provinces'][0]['name']}")

    if data['cities']:
        print(f"\n시/군/구 예시:")
        for city in data['cities'][:3]:
            grid = f"격자: X={city.get('x', '?')}, Y={city.get('y', '?')}"
            print(f"  - {city['name']} ({city['code']}) {grid}")

    if data['districts']:
        print(f"\n읍/면/동 예시:")
        for district in data['districts'][:5]:
            grid = f"격자: X={district.get('x', '?')}, Y={district.get('y', '?')}"
            print(f"  - {district['name']} ({district['code']}) {grid}")

    print("\n" + "=" * 80)
    print("🎉 완료!")
    print("=" * 80)
    print(f"통합 파일: {args.output}")
    print(f"개별 파일: {args.output_dir}/")
    print("  - provinces.json   : 시/도 목록")
    print("  - cities.json      : 시/군/구 목록")
    print("  - districts.json   : 읍/면/동 목록")
    print("  - hierarchy.json   : 계층 구조")
    print("  - summary.json     : 요약 정보")
    print("=" * 80)


if __name__ == "__main__":
    main()
