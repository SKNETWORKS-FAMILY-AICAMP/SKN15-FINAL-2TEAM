"""
기상청 일별 예보 크롤링 Django Management Command
"""
import requests
from bs4 import BeautifulSoup
from datetime import datetime, date
import time
from django.core.management.base import BaseCommand
from apps.common.models import Country, District
from apps.weather.models import WeatherDaily


class Command(BaseCommand):
    help = '기상청 일별 예보 크롤링'

    def add_arguments(self, parser):
        parser.add_argument(
            '--limit',
            type=int,
            default=None,
            help='크롤링할 읍/면/동 개수 제한 (테스트용)'
        )
        parser.add_argument(
            '--test',
            action='store_true',
            help='테스트 모드 (10개만 크롤링)'
        )
        parser.add_argument(
            '--incremental',
            action='store_true',
            help='증분 수집 모드 (오늘 날짜 이후 데이터만 수집)'
        )
        parser.add_argument(
            '--full',
            action='store_true',
            help='전체 재수집 모드 (모든 날씨 데이터 재수집)'
        )

    def handle(self, *args, **options):
        limit = 10 if options['test'] else options['limit']
        incremental = options.get('incremental', False)
        full_mode = options.get('full', False)

        self.stdout.write("=" * 80)
        if incremental:
            self.stdout.write(self.style.SUCCESS("🌤️  기상청 일별 예보 크롤링 시작 (증분 수집 모드)"))
            self.stdout.write(self.style.WARNING("📅 오늘 날짜 이후 데이터만 수집합니다"))
        elif full_mode:
            self.stdout.write(self.style.SUCCESS("🌤️  기상청 일별 예보 크롤링 시작 (전체 재수집 모드)"))
        else:
            self.stdout.write(self.style.SUCCESS("🌤️  기상청 일별 예보 크롤링 시작"))
        self.stdout.write("=" * 80)

        # 한국의 모든 District 가져오기
        districts = District.objects.filter(
            city__province__country__iso2='KR',
            code__isnull=False,
            latitude__isnull=False,
            longitude__isnull=False
        ).select_related('city__province')

        total_count = districts.count()
        if limit:
            districts = districts[:limit]
            self.stdout.write(f"🔍 총 {total_count}개 중 {limit}개만 크롤링 (테스트 모드)")
        else:
            self.stdout.write(f"🔍 총 {total_count}개 읍/면/동 크롤링")

        success_count = 0
        fail_count = 0
        session = requests.Session()
        session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })

        for idx, district in enumerate(districts, 1):
            self.stdout.write(f"\n[{idx}/{len(districts)}] 📍 {district.name} (코드: {district.code})")

            # HTML 가져오기
            html = self.fetch_weather_html(session, district)
            if not html:
                fail_count += 1
                continue

            # 파싱
            forecasts = self.parse_daily_forecast(html)
            if not forecasts:
                self.stdout.write("  ⚠️ No forecast data parsed")
                fail_count += 1
                continue

            # 증분 모드: 오늘 이후 데이터만 필터링
            if incremental:
                today = date.today()
                forecasts = [f for f in forecasts if f['forecast_date'] >= today]
                if not forecasts:
                    self.stdout.write("  ℹ️  오늘 이후 데이터 없음 (스킵)")
                    continue

            # DB 저장
            saved_count = self.save_to_db(district, forecasts)
            self.stdout.write(self.style.SUCCESS(f"  ✅ {saved_count}일치 예보 저장 완료"))
            success_count += 1

            # Rate limiting
            time.sleep(0.5)

        self.stdout.write("\n" + "=" * 80)
        self.stdout.write(self.style.SUCCESS("📊 크롤링 완료!"))
        self.stdout.write("=" * 80)
        self.stdout.write(f"✅ 성공: {success_count}개")
        self.stdout.write(f"❌ 실패: {fail_count}개")
        self.stdout.write("=" * 80)

    def fetch_weather_html(self, session, district):
        """기상청 날씨 페이지 HTML 가져오기"""
        url = "https://www.weather.go.kr/w/wnuri-fct2021/main/digital-forecast.do"
        params = {
            'code': district.code,
            'lat': district.latitude,
            'lon': district.longitude,
            'unit': 'm/s',
            'hr1': 'N'
        }

        try:
            response = session.get(url, params=params, timeout=30)
            response.raise_for_status()
            return response.text
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"  ❌ Failed to fetch: {e}"))
            return None

    def parse_daily_forecast(self, html):
        """일별 예보 HTML 파싱"""
        soup = BeautifulSoup(html, 'html.parser')
        daily_forecasts = []

        daily_slider = soup.find('div', class_='dfs-daily-slider')
        if not daily_slider:
            return daily_forecasts

        slides = daily_slider.find_all('div', class_='dfs-daily-slide')

        for slide in slides:
            try:
                date_str = slide.get('data-date')
                if not date_str:
                    continue

                forecast_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                daily_item = slide.find('div', class_='dfs-daily-item')
                if not daily_item:
                    continue

                # 오전 날씨
                weather_am_elem = daily_item.find('div', class_='daily-weather-am')
                weather_am = None
                if weather_am_elem:
                    weather_icon = weather_am_elem.find('span', class_='wic')
                    if weather_icon:
                        weather_am = weather_icon.get_text(strip=True)

                # 오후 날씨
                weather_pm_elem = daily_item.find('div', class_='daily-weather-pm')
                weather_pm = None
                if weather_pm_elem:
                    weather_icon = weather_pm_elem.find('span', class_='wic')
                    if weather_icon:
                        weather_pm = weather_icon.get_text(strip=True)

                # 종일 날씨
                weather_allday_elem = daily_item.find('div', class_='daily-weather-allday')
                if weather_allday_elem:
                    weather_icon = weather_allday_elem.find('span', class_='wic')
                    if weather_icon:
                        weather_am = weather_pm = weather_icon.get_text(strip=True)

                # 최저/최고 기온
                minmax_elem = daily_item.find('div', class_='daily-minmax')
                temp_min = None
                temp_max = None
                if minmax_elem:
                    divs = minmax_elem.find_all('div')
                    if len(divs) >= 2:
                        min_span = divs[0].find('span')
                        max_span = divs[1].find('span')

                        if min_span:
                            temp_min_str = min_span.get_text(strip=True).replace('℃', '')
                            try:
                                temp_min = float(temp_min_str)
                            except ValueError:
                                pass

                        if max_span:
                            temp_max_str = max_span.get_text(strip=True).replace('℃', '')
                            try:
                                temp_max = float(temp_max_str)
                            except ValueError:
                                pass

                # 강수확률
                precipitation_am = None
                precipitation_pm = None

                pop_am_elem = daily_item.find('div', class_='daily-pop-am')
                if pop_am_elem:
                    pop_span = pop_am_elem.find('span')
                    if pop_span:
                        pop_str = pop_span.get_text(strip=True).replace('%', '').replace('-', '')
                        if pop_str.isdigit():
                            precipitation_am = int(pop_str)

                pop_pm_elem = daily_item.find('div', class_='daily-pop-pm')
                if pop_pm_elem:
                    pop_span = pop_pm_elem.find('span')
                    if pop_span:
                        pop_str = pop_span.get_text(strip=True).replace('%', '').replace('-', '')
                        if pop_str.isdigit():
                            precipitation_pm = int(pop_str)

                # 종일 강수확률
                pop_allday_elem = daily_item.find('div', class_='daily-pop-allday')
                if pop_allday_elem:
                    pop_span = pop_allday_elem.find('span')
                    if pop_span:
                        pop_str = pop_span.get_text(strip=True).replace('%', '').replace('-', '')
                        if pop_str.isdigit():
                            precipitation_am = precipitation_pm = int(pop_str)

                daily_forecasts.append({
                    'forecast_date': forecast_date,
                    'weather_am': weather_am,
                    'weather_pm': weather_pm,
                    'temp_min_c': temp_min,
                    'temp_max_c': temp_max,
                    'precipitation_am': precipitation_am,
                    'precipitation_pm': precipitation_pm,
                })

            except Exception as e:
                continue

        return daily_forecasts

    def save_to_db(self, district, forecasts):
        """일별 예보 데이터를 DB에 저장"""
        korea = Country.objects.get(iso2='KR')
        saved_count = 0

        for forecast in forecasts:
            try:
                obj, created = WeatherDaily.objects.update_or_create(
                    district_idx=district,
                    forecast_date=forecast['forecast_date'],
                    defaults={
                        'country_code': korea,
                        'province_idx': district.city.province if district.city else None,
                        'city_idx': district.city if district.city else None,
                        'weather_am': forecast['weather_am'],
                        'weather_pm': forecast['weather_pm'],
                        'temp_min_c': forecast['temp_min_c'],
                        'temp_max_c': forecast['temp_max_c'],
                        'precipitation_am': forecast['precipitation_am'],
                        'precipitation_pm': forecast['precipitation_pm'],
                    }
                )
                saved_count += 1
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"  ❌ Failed to save: {e}"))

        return saved_count
