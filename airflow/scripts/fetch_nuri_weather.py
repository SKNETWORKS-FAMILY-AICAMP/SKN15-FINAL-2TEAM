#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import requests
from bs4 import BeautifulSoup as BS
import time
from sqlalchemy import create_engine, text
from urllib.parse import quote_plus
from tqdm import tqdm
from dotenv import load_dotenv
import os
import logging
import re
from datetime import datetime

# ---------------- logging 설정 ----------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

# ---------------- .env 환경 변수 로드 ----------------
load_dotenv()

# ---------------- DB 설정 ----------------
db_config = {
    "host": os.getenv("DB_HOST"),
    "port": int(os.getenv("DB_PORT")),
    "database": os.getenv("DB_NAME"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD")
}

password_safe = quote_plus(db_config['password'])
engine = create_engine(
    f"postgresql+psycopg2://{db_config['user']}:{password_safe}@{db_config['host']}:{db_config['port']}/{db_config['database']}",
    pool_pre_ping=True,
    pool_recycle=3600
)

# ---------------- 공통 헤더 ----------------
COMMON_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control": "max-age=0",
    "Connection": "keep-alive",
    "Host": "www.weather.go.kr",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
}

# ---------------- 유틸 함수 ----------------
def clean_temp(value):
    """'15℃' 같은 문자열에서 숫자만 추출해 float로 변환"""
    if not value:
        return None
    match = re.search(r"[-+]?\d*\.?\d+", value)
    return float(match.group()) if match else None


def safe_request(url, retries=2, delay=2, headers=None):
    """요청 실패 시 자동 재시도"""
    for i in range(retries):
        try:
            r = requests.get(url, timeout=8, headers=headers)
            r.raise_for_status()
            return r
        except requests.exceptions.RequestException as e:
            logger.warning(f"⚠️ 요청 실패 {i+1}/{retries}: {url} ({e})")
            time.sleep(delay)
    return None


# ---------------- 대륙 코드 수집 ----------------
def get_continents():
    url = "https://www.weather.go.kr/w/theme/world-weather.do?continentCode=C04&countryCode=165&cityCode=1983"
    r = safe_request(url, headers=COMMON_HEADERS)
    if not r:
        return []
    bs = BS(r.text, "html.parser")
    return [o.get("value") for o in bs.find("select", id="select-area").find_all("option") if o.get("value")]


# ---------------- 국가 코드 수집 ----------------
def get_countries(continent_codes):
    world_country_data = {}
    for continent_code in tqdm(continent_codes, desc="대륙별 국가 수집"):
        url = f"https://www.weather.go.kr/w/theme/world-weather.do?continentCode={continent_code}"
        r = safe_request(url, headers=COMMON_HEADERS)
        if not r:
            continue
        bs = BS(r.text, "html.parser")
        country_codes = [
            (o.get("value"), o.text.strip())
            for o in bs.find("select", id="select-country").find_all("option")
            if o.get("value")
        ]
        world_country_data[continent_code] = country_codes
        time.sleep(0.3)
    return world_country_data


# ---------------- 도시 코드 수집 ----------------
def get_cities(world_country_data):
    world_city_data = {}
    for continent_code, country_list in tqdm(world_country_data.items(), desc="대륙별 도시 수집"):
        world_city_data[continent_code] = {}
        for country_code, country_name in country_list:
            url = f"https://www.weather.go.kr/w/theme/world-weather.do?continentCode={continent_code}&countryCode={country_code}"
            r = safe_request(url, headers=COMMON_HEADERS)
            if not r:
                continue
            bs = BS(r.text, "html.parser")
            select_city = bs.find("select", id="select-city")
            city_codes = []
            if select_city:
                city_codes = [
                    (o.get("value"), o.text.strip())
                    for o in select_city.find_all("option")
                    if o.get("value")
                ]
            world_city_data[continent_code][(country_code, country_name)] = city_codes
            time.sleep(0.3)
    return world_city_data


# ---------------- 날씨 테이블 파싱 ----------------
def get_weather(city_url):
    """기상청 세계날씨 테이블 파싱 (img 무시, span 기반)"""
    r = safe_request(city_url, headers=COMMON_HEADERS)
    if not r:
        logger.warning(f"⚠️ 요청 실패, 건너뜀: {city_url}")
        return []

    soup = BS(r.text, "html.parser")
    table = soup.find("table", class_="table-col")
    if not table:
        return []

    weather_data = []
    for row in table.select("tbody tr"):
        cols = row.find_all("td")
        if len(cols) < 3:
            continue

        # 날짜
        date_text = cols[0].get_text(strip=True)
        try:
            forecast_date = datetime.strptime(f"{datetime.now().year}-{date_text}", "%Y-%m-%d").date()
        except ValueError:
            forecast_date = None

        # 날씨
        weather_td = cols[1]
        weather_text = None
        if weather_td:
            span = weather_td.find("span")
            if span and span.text.strip():
                weather_text = span.text.strip()

        # 온도
        temp_td = cols[2]
        spans = temp_td.find_all("span")
        temp_min = clean_temp(spans[0].text if len(spans) > 0 else None)
        temp_max = clean_temp(spans[1].text if len(spans) > 1 else None)

        weather_data.append({
            "forecast_date": forecast_date,
            "weather": weather_text or "정보없음",
            "temp_min_c": temp_min,
            "temp_max_c": temp_max
        })

    return fill_missing_temps(weather_data)


# ---------------- 단순 온도 보정 함수 ----------------
def fill_missing_temps(weather):
    """min/max 중 하나라도 있으면 서로 복사, 둘 다 없으면 0으로"""
    for w in weather:
        min_v = w.get("temp_min_c")
        max_v = w.get("temp_max_c")

        if min_v is None and max_v is None:
            w["temp_min_c"] = 0.0
            w["temp_max_c"] = 0.0
        elif min_v is None and max_v is not None:
            w["temp_min_c"] = max_v
        elif max_v is None and min_v is not None:
            w["temp_max_c"] = min_v
        # 둘 다 있으면 그대로 유지
    return weather


# ---------------- 모든 날씨 수집 ----------------
def collect_all_weather(flattened_city_data):
    all_weather_data = {}
    for continent_code, countries in tqdm(flattened_city_data.items(), desc="날씨 수집 진행"):
        all_weather_data[continent_code] = {}
        for country_code, city_list in countries.items():
            all_weather_data[continent_code][country_code] = {}
            for city_code, city_name in city_list:
                city_url = (
                    f"https://www.weather.go.kr/w/theme/world-weather.do?"
                    f"continentCode={continent_code}&countryCode={country_code}&cityCode={city_code}"
                )
                weather = get_weather(city_url)
                all_weather_data[continent_code][country_code][city_code] = weather
                time.sleep(0.3)
    return all_weather_data



# ---------------- DB 저장 ----------------
def save_to_db(all_weather_data, world_city_data):
    with engine.begin() as conn:
        for continent_code, countries in tqdm(world_city_data.items(), desc="DB 저장 진행"):
            for (country_code, country_name), city_list in countries.items():
                # 국가 코드 조회
                get_country_sql = text("""
                    SELECT country_code FROM common_country
                    WHERE country_name = :country
                    LIMIT 1;
                """)
                result = conn.execute(get_country_sql, {"country": country_name}).fetchone()
                fk_country_code = result[0] if result else None

                for city_code, city_name in city_list:
                    get_city_sql = text("""
                        SELECT city_code FROM common_region1
                        WHERE city_name = :city_name
                        AND country_code = :country_code
                        LIMIT 1;
                    """)
                    city_result = conn.execute(get_city_sql, {
                        "city_name": city_name,
                        "country_code": fk_country_code
                    }).fetchone()
                    fk_city_code = city_result[0] if city_result else None

                    weather_list = all_weather_data.get(continent_code, {}).get(country_code, {}).get(city_code, [])
                    if not weather_list:
                        continue

                    # ✅ fill_missing_temps 1차 적용
                    weather_list = fill_missing_temps(weather_list)

                    for w in weather_list:
                        # ✅ 2차 방어: None 값을 강제로 보정
                        tmin = w.get("temp_min_c")
                        tmax = w.get("temp_max_c")

                        if tmin is None and tmax is None:
                            tmin = tmax = 0.0
                        elif tmin is None:
                            tmin = tmax
                        elif tmax is None:
                            tmax = tmin

                        insert_sql = text("""
                            INSERT INTO weather_daily (
                                country_code, city_code, forecast_date, weather,
                                temp_min_c, temp_max_c, created_at
                            ) VALUES (
                                :country_code, :city_code, :forecast_date, :weather,
                                :temp_min_c, :temp_max_c, now()
                            )
                            ON CONFLICT (city_code, forecast_date)
                            DO UPDATE SET
                                weather = EXCLUDED.weather,
                                temp_min_c = EXCLUDED.temp_min_c,
                                temp_max_c = EXCLUDED.temp_max_c,
                                created_at = now();
                        """)
                        conn.execute(insert_sql, {
                            "country_code": fk_country_code,
                            "city_code": fk_city_code,
                            "forecast_date": w.get("forecast_date"),
                            "weather": w.get("weather"),
                            "temp_min_c": tmin,
                            "temp_max_c": tmax
                        })




# ---------------- main ----------------
def main():
    logger.info("🌍 세계 일일 날씨 수집 시작")

    continents = get_continents()
    logger.info(f"✅ 대륙 코드 수집 완료: {len(continents)}개")

    continent_to_countries = get_countries(continents)
    logger.info("✅ 국가 코드 수집 완료")

    world_city_data = get_cities(continent_to_countries)
    logger.info("✅ 도시 코드 수집 완료")

    flattened_city_data = {
        continent_code: {
            country_code: city_list
            for (country_code, _), city_list in countries.items()
        }
        for continent_code, countries in world_city_data.items()
    }

    logger.info("🌦️ 날씨 데이터 수집 시작")
    all_weather_data = collect_all_weather(flattened_city_data)

    logger.info("💾 DB 저장 시작")
    save_to_db(all_weather_data, world_city_data)
    logger.info("🎉 weather_daily 업데이트 완료!")


if __name__ == "__main__":
    main()
