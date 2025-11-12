"""
기상청(KMA) 일별 예보 크롤링 스크립트

URL: https://www.weather.go.kr/w/wnuri-fct2021/main/digital-forecast.do
파라미터: code, lat, lon (District 테이블에서 가져옴)
"""
import requests
from bs4 import BeautifulSoup
from datetime import datetime
import sys
import os
import time

# Django 설정
sys.path.append('/home/pjw/workspace/SKN15-FINAL-2TEAM/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()

from apps.common.models import Country, District
from apps.weather.models import WeatherDaily


class KMADailyScraper:
    """기상청 일별 예보 크롤러"""

    BASE_URL = "https://www.weather.go.kr/w/wnuri-fct2021/main/digital-forecast.do"

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })

    def fetch_weather_html(self, code, lat, lon):
        """
        기상청 날씨 페이지 HTML 가져오기

        Args:
            code: 행정구역 코드 (10자리)
            lat: 위도
            lon: 경도

        Returns:
            HTML content (str) or None
        """
        params = {
            'code': code,
            'lat': lat,
            'lon': lon,
            'unit': 'm/s',
            'hr1': 'N'
        }

        try:
            response = self.session.get(self.BASE_URL, params=params, timeout=30)
            response.raise_for_status()
            return response.text
        except Exception as e:
            print(f"❌ Failed to fetch weather for code {code}: {e}")
            return None

    def parse_daily_forecast(self, html):
        """
        일별 예보 HTML 파싱

        Args:
            html: HTML content

        Returns:
            List of dict containing daily forecast data
        """
        soup = BeautifulSoup(html, 'html.parser')
        daily_forecasts = []

        # 일별 예보 슬라이더 찾기
        daily_slider = soup.find('div', class_='dfs-daily-slider')
        if not daily_slider:
            print("⚠️ Daily forecast slider not found")
            return daily_forecasts

        # 각 일별 슬라이드 파싱
        slides = daily_slider.find_all('div', class_='dfs-daily-slide')

        for slide in slides:
            try:
                # 날짜 추출
                date_str = slide.get('data-date')  # 형식: 2025-11-09
                if not date_str:
                    continue

                forecast_date = datetime.strptime(date_str, '%Y-%m-%d').date()

                # 일별 아이템 찾기
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

                # 종일 날씨 (오전/오후 구분 없는 경우)
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
                    min_span = minmax_elem.find('div').find('span')
                    max_span = minmax_elem.find_all('div')[1].find('span') if len(minmax_elem.find_all('div')) > 1 else None

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
                pop_am_elem = daily_item.find('div', class_='daily-pop-am')
                pop_pm_elem = daily_item.find('div', class_='daily-pop-pm')
                precipitation_am = None
                precipitation_pm = None

                if pop_am_elem:
                    pop_am_span = pop_am_elem.find('span')
                    if pop_am_span:
                        pop_am_str = pop_am_span.get_text(strip=True).replace('%', '').replace('-', '')
                        if pop_am_str.isdigit():
                            precipitation_am = int(pop_am_str)

                if pop_pm_elem:
                    pop_pm_span = pop_pm_elem.find('span')
                    if pop_pm_span:
                        pop_pm_str = pop_pm_span.get_text(strip=True).replace('%', '').replace('-', '')
                        if pop_pm_str.isdigit():
                            precipitation_pm = int(pop_pm_str)

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
                print(f"⚠️ Error parsing slide: {e}")
                continue

        return daily_forecasts

    def save_to_db(self, district, forecasts):
        """
        일별 예보 데이터를 DB에 저장

        Args:
            district: District 객체
            forecasts: List of forecast dicts
        """
        korea = Country.objects.get(iso2='KR')

        for forecast in forecasts:
            try:
                WeatherDaily.objects.update_or_create(
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
            except Exception as e:
                print(f"❌ Failed to save forecast for {forecast['forecast_date']}: {e}")

    def crawl_all_districts(self, limit=None):
        """
        모든 읍/면/동의 날씨 데이터 크롤링

        Args:
            limit: 테스트용 제한 개수 (None이면 전체)
        """
        print("=" * 80)
        print("🌤️  기상청 일별 예보 크롤링 시작")
        print("=" * 80)

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
            print(f"🔍 총 {total_count}개 중 {limit}개만 크롤링 (테스트 모드)")
        else:
            print(f"🔍 총 {total_count}개 읍/면/동 크롤링")

        success_count = 0
        fail_count = 0

        for idx, district in enumerate(districts, 1):
            print(f"\n[{idx}/{len(districts)}] 📍 {district.name} (코드: {district.code})")

            # HTML 가져오기
            html = self.fetch_weather_html(
                code=district.code,
                lat=district.latitude,
                lon=district.longitude
            )

            if not html:
                fail_count += 1
                continue

            # 파싱
            forecasts = self.parse_daily_forecast(html)
            if not forecasts:
                print("  ⚠️ No forecast data parsed")
                fail_count += 1
                continue

            # DB 저장
            self.save_to_db(district, forecasts)
            print(f"  ✅ {len(forecasts)}일치 예보 저장 완료")
            success_count += 1

            # Rate limiting (너무 빠르면 차단될 수 있음)
            time.sleep(0.5)

        print("\n" + "=" * 80)
        print("📊 크롤링 완료!")
        print("=" * 80)
        print(f"✅ 성공: {success_count}개")
        print(f"❌ 실패: {fail_count}개")
        print("=" * 80)


def main():
    import argparse

    parser = argparse.ArgumentParser(description='기상청 일별 예보 크롤링')
    parser.add_argument('--limit', type=int, default=None, help='크롤링할 읍/면/동 개수 제한 (테스트용)')
    parser.add_argument('--test', action='store_true', help='테스트 모드 (10개만 크롤링)')

    args = parser.parse_args()

    scraper = KMADailyScraper()

    if args.test:
        scraper.crawl_all_districts(limit=10)
    else:
        scraper.crawl_all_districts(limit=args.limit)


if __name__ == '__main__':
    main()
