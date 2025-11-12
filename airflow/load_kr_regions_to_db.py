"""
all_regions.json 데이터를 Django 데이터베이스에 로드하는 스크립트
"""
import json
import sys
import os
import django

# Django 설정
sys.path.append('/home/pjw/workspace/SKN15-FINAL-2TEAM/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.common.models import Country, Province, City, District


def load_regions_from_json(json_file='regions_hierarchy.json'):
    """
    regions_hierarchy.json 파일을 읽어서 데이터베이스에 저장

    Args:
        json_file: JSON 파일 경로 (계층 구조 JSON)
    """

    print("=" * 80)
    print("🗂️ 한국 지역 데이터 DB 로드")
    print("=" * 80)

    # 0. 한국 Country 가져오기
    try:
        korea = Country.objects.get(iso2='KR')
        print(f"✅ 국가: {korea.country_name} (KR)")
    except Country.DoesNotExist:
        print("❌ 한국 Country 데이터가 없습니다. 먼저 Country 테이블에 한국을 추가하세요.")
        return

    # 1. JSON 파일 로드
    print(f"\n📂 파일 로드: {json_file}")
    with open(json_file, 'r', encoding='utf-8') as f:
        hierarchy = json.load(f)
    print(f"✅ {len(hierarchy)}개 시/도 데이터 로드 완료")

    # 통계
    stats = {
        'provinces': 0,
        'cities': 0,
        'districts': 0,
        'province_updated': 0,
        'city_updated': 0,
        'district_updated': 0
    }

    # 2. 계층 구조로 저장
    print("\n" + "=" * 80)
    print("💾 데이터베이스 저장 시작")
    print("=" * 80)

    for sido_data in hierarchy:
        print(f"\n[{stats['provinces'] + 1}/{len(hierarchy)}] 🏙️ {sido_data['name']}")

        # 2-1. 시/도 저장
        province, created = Province.objects.update_or_create(
            country=korea,
            code=sido_data['code'],
            defaults={
                'name': sido_data.get('name', ''),
                'short_name': sido_data.get('shortName', ''),
                'name_en': sido_data.get('nameEn', ''),
                'short_name_en': sido_data.get('shortNameEn', ''),
                'grid_x': int(sido_data['x']) if sido_data.get('x') else None,
                'grid_y': int(sido_data['y']) if sido_data.get('y') else None,
                'latitude': float(sido_data['lat']) if sido_data.get('lat') else None,
                'longitude': float(sido_data['lon']) if sido_data.get('lon') else None,
                'level': int(sido_data.get('level', 1)),
            }
        )

        if created:
            stats['provinces'] += 1
            print(f"  ✅ 시/도 생성")
        else:
            stats['province_updated'] += 1
            print(f"  🔄 시/도 업데이트")

        # 2-2. 시/군/구 저장
        cities_data = sido_data.get('cities', [])
        print(f"  📍 {len(cities_data)}개 시/군/구 처리 중...")

        for city_data in cities_data:
            city, created = City.objects.update_or_create(
                province=province,
                code=city_data['code'],
                defaults={
                    'name': city_data.get('name', ''),
                    'short_name': city_data.get('shortName', ''),
                    'name_en': city_data.get('nameEn', ''),
                    'short_name_en': city_data.get('shortNameEn', ''),
                    'grid_x': int(city_data['x']) if city_data.get('x') else None,
                    'grid_y': int(city_data['y']) if city_data.get('y') else None,
                    'latitude': float(city_data['lat']) if city_data.get('lat') else None,
                    'longitude': float(city_data['lon']) if city_data.get('lon') else None,
                    'level': int(city_data.get('level', 2)),
                }
            )

            if created:
                stats['cities'] += 1
            else:
                stats['city_updated'] += 1

            # 2-3. 읍/면/동 저장
            districts_data = city_data.get('districts', [])

            for district_data in districts_data:
                district, created = District.objects.update_or_create(
                    city=city,
                    code=district_data['code'],
                    defaults={
                        'name': district_data.get('name', ''),
                        'short_name': district_data.get('shortName', ''),
                        'name_en': district_data.get('nameEn', ''),
                        'short_name_en': district_data.get('shortNameEn', ''),
                        'grid_x': int(district_data['x']) if district_data.get('x') else None,
                        'grid_y': int(district_data['y']) if district_data.get('y') else None,
                        'latitude': float(district_data['lat']) if district_data.get('lat') else None,
                        'longitude': float(district_data['lon']) if district_data.get('lon') else None,
                        'level': int(district_data.get('level', 3)),
                    }
                )

                if created:
                    stats['districts'] += 1
                else:
                    stats['district_updated'] += 1

        print(f"  ✅ {len(cities_data)}개 시/군/구 완료")

    # 3. 결과 출력
    print("\n" + "=" * 80)
    print("📊 저장 완료!")
    print("=" * 80)
    print(f"\n【 새로 생성 】")
    print(f"  시/도:     {stats['provinces']:4d}개")
    print(f"  시/군/구:  {stats['cities']:4d}개")
    print(f"  읍/면/동:  {stats['districts']:4d}개")

    print(f"\n【 업데이트 】")
    print(f"  시/도:     {stats['province_updated']:4d}개")
    print(f"  시/군/구:  {stats['city_updated']:4d}개")
    print(f"  읍/면/동:  {stats['district_updated']:4d}개")

    print(f"\n【 전체 】")
    total_provinces = Province.objects.filter(country=korea).count()
    total_cities = City.objects.filter(province__country=korea).count()
    total_districts = District.objects.filter(city__province__country=korea).count()
    print(f"  시/도:     {total_provinces:4d}개")
    print(f"  시/군/구:  {total_cities:4d}개")
    print(f"  읍/면/동:  {total_districts:4d}개")
    print("=" * 80)

    # 4. 샘플 데이터 출력
    print("\n📍 샘플 데이터 (서울특별시 강남구):")
    try:
        seoul = Province.objects.get(country=korea, name__contains='서울')
        gangnam = City.objects.filter(province=seoul, name__contains='강남').first()

        if gangnam:
            print(f"\n시/도: {seoul.name} ({seoul.code})")
            print(f"시/군/구: {gangnam.name} ({gangnam.code})")
            print(f"  격자: X={gangnam.grid_x}, Y={gangnam.grid_y}")

            districts = District.objects.filter(city=gangnam)[:3]
            print(f"\n읍/면/동 (처음 3개):")
            for dong in districts:
                print(f"  - {dong.name} ({dong.code}) [격자: X={dong.grid_x}, Y={dong.grid_y}]")
    except Exception as e:
        print(f"샘플 데이터 조회 실패: {e}")

    print("\n" + "=" * 80)
    print("🎉 완료!")
    print("=" * 80)


def main():
    import argparse

    parser = argparse.ArgumentParser(description='한국 지역 데이터 DB 로드')
    parser.add_argument('--file', default='regions_hierarchy.json', help='JSON 파일 경로')
    parser.add_argument('--clear', action='store_true', help='기존 데이터 삭제 후 로드')

    args = parser.parse_args()

    # 기존 데이터 삭제
    if args.clear:
        print("\n⚠️ 기존 한국 데이터 삭제 중...")
        try:
            korea = Country.objects.get(iso2='KR')
            District.objects.filter(city__province__country=korea).delete()
            City.objects.filter(province__country=korea).delete()
            Province.objects.filter(country=korea).delete()
            print("✅ 삭제 완료\n")
        except Country.DoesNotExist:
            print("⚠️ 한국 Country 데이터 없음\n")

    # 데이터 로드
    load_regions_from_json(args.file)


if __name__ == '__main__':
    main()
