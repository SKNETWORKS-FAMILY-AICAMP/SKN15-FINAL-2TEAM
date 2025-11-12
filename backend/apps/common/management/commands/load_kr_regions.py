"""
전국 시/도/구/군/읍/면/동 데이터를 로드하는 Django management command
"""
import json
import os
from django.core.management.base import BaseCommand
from apps.common.models import Country, Province, City, District


class Command(BaseCommand):
    help = '전국 시/도/구/군/읍/면/동 데이터 로드'

    def add_arguments(self, parser):
        parser.add_argument(
            '--file',
            type=str,
            default='regions_hierarchy.json',
            help='JSON 파일 경로'
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='기존 데이터 삭제 후 로드'
        )

    def handle(self, *args, **options):
        json_file = options['file']

        self.stdout.write("=" * 80)
        self.stdout.write(self.style.SUCCESS("🗂️ 한국 지역 데이터 DB 로드"))
        self.stdout.write("=" * 80)

        # 0. 한국 Country 가져오기
        try:
            korea = Country.objects.get(iso2='KR')
            self.stdout.write(self.style.SUCCESS(f"✅ 국가: {korea.country_name} (KR)"))
        except Country.DoesNotExist:
            self.stdout.write(self.style.ERROR("❌ 한국 Country 데이터가 없습니다."))
            return

        # 기존 데이터 삭제
        if options['clear']:
            self.stdout.write("\n⚠️ 기존 한국 데이터 삭제 중...")
            District.objects.filter(city__province__country=korea).delete()
            City.objects.filter(province__country=korea).delete()
            Province.objects.filter(country=korea).delete()
            self.stdout.write(self.style.SUCCESS("✅ 삭제 완료\n"))

        # 1. JSON 파일 로드
        self.stdout.write(f"\n📂 파일 로드: {json_file}")

        if not os.path.exists(json_file):
            self.stdout.write(self.style.ERROR(f"❌ 파일이 없습니다: {json_file}"))
            return

        with open(json_file, 'r', encoding='utf-8') as f:
            hierarchy = json.load(f)
        self.stdout.write(self.style.SUCCESS(f"✅ {len(hierarchy)}개 시/도 데이터 로드 완료"))

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
        self.stdout.write("\n" + "=" * 80)
        self.stdout.write(self.style.SUCCESS("💾 데이터베이스 저장 시작"))
        self.stdout.write("=" * 80)

        for sido_data in hierarchy:
            self.stdout.write(f"\n[{stats['provinces'] + 1}/{len(hierarchy)}] 🏙️ {sido_data['name']}")

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
                self.stdout.write("  ✅ 시/도 생성")
            else:
                stats['province_updated'] += 1
                self.stdout.write("  🔄 시/도 업데이트")

            # 2-2. 시/군/구 저장
            cities_data = sido_data.get('cities', [])
            self.stdout.write(f"  📍 {len(cities_data)}개 시/군/구 처리 중...")

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

            self.stdout.write(self.style.SUCCESS(f"  ✅ {len(cities_data)}개 시/군/구 완료"))

        # 3. 결과 출력
        self.stdout.write("\n" + "=" * 80)
        self.stdout.write(self.style.SUCCESS("📊 저장 완료!"))
        self.stdout.write("=" * 80)
        self.stdout.write(f"\n【 새로 생성 】")
        self.stdout.write(f"  시/도:     {stats['provinces']:4d}개")
        self.stdout.write(f"  시/군/구:  {stats['cities']:4d}개")
        self.stdout.write(f"  읍/면/동:  {stats['districts']:4d}개")

        self.stdout.write(f"\n【 업데이트 】")
        self.stdout.write(f"  시/도:     {stats['province_updated']:4d}개")
        self.stdout.write(f"  시/군/구:  {stats['city_updated']:4d}개")
        self.stdout.write(f"  읍/면/동:  {stats['district_updated']:4d}개")

        self.stdout.write(f"\n【 전체 】")
        total_provinces = Province.objects.filter(country=korea).count()
        total_cities = City.objects.filter(province__country=korea).count()
        total_districts = District.objects.filter(city__province__country=korea).count()
        self.stdout.write(f"  시/도:     {total_provinces:4d}개")
        self.stdout.write(f"  시/군/구:  {total_cities:4d}개")
        self.stdout.write(f"  읍/면/동:  {total_districts:4d}개")
        self.stdout.write("=" * 80)

        self.stdout.write("\n" + self.style.SUCCESS("🎉 완료!"))
