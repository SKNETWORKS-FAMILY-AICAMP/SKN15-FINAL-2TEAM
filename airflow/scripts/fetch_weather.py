#!/usr/bin/env python3
import requests
from tqdm import tqdm
from sqlalchemy import create_engine, text
from urllib.parse import quote_plus
from datetime import datetime
from dotenv import load_dotenv
import os
import logging

# ---------------- logging 설정 ----------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

# ---------------- .env 로드 및 DB 설정 ----------------
load_dotenv()

db_config = {
    "host": os.getenv("DB_HOST"),
    "port": int(os.getenv("DB_PORT")),
    "database": os.getenv("DB_NAME"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD")
}

password_safe = quote_plus(db_config['password'])

try:
    engine = create_engine(
        f"postgresql+psycopg2://{db_config['user']}:{password_safe}@{db_config['host']}:{db_config['port']}/{db_config['database']}",
        pool_pre_ping=True,
        pool_recycle=3600
    )
    logger.info("✅ DB 연결 성공")
except Exception as e:
    logger.error(f"❌ DB 연결 실패: {e}")
    raise

# ---------------- 도시 ID 리스트 수집 ----------------
def city_ids_list():
    try:
        url = "https://worldweather.wmo.int/kr/json/Country_kr.xml"
        r = requests.get(url, timeout=10)
        r.encoding = "utf-8"
        data = r.json()
        city_ids = []
        for country_data in data['member'].values():
            if isinstance(country_data, dict):
                for city in country_data.get("city", []):
                    if "cityId" in city:
                        city_ids.append(city["cityId"])
        return city_ids
    except Exception as e:
        logger.error(f"도시 ID 목록 수집 실패: {e}")
        return []

# ---------------- 도시별 날씨 수집 ----------------
def weather_info(city_id):
    url = f"https://worldweather.wmo.int/kr/json/{city_id}_kr.xml"
    r = requests.get(url, timeout=10)
    r.encoding = "utf-8"
    return r.json()

def all_cities_weather(city_ids):
    all_data = []
    for cid in tqdm(city_ids, desc="도시별 날씨 수집"):
        try:
            all_data.append(weather_info(cid))
        except Exception as e:
            logger.warning(f"도시 {cid} 날씨 수집 실패: {e}")
    return all_data

# ---------------- DB 저장 ----------------
def save_to_db(city_data_list):
    def to_float(val):
        try:
            return float(val)
        except (ValueError, TypeError):
            return None

    try:
        with engine.begin() as conn:
            for city in tqdm(city_data_list, desc="DB 저장"):
                try:
                    city_info = city["city"]
                    city_id = city_info["cityId"]
                    city_name = city_info["cityName"]
                    country_name = city_info["member"]["memName"]
                    mem_id = city_info["member"].get("memId")

                    for day in city_info["forecast"]["forecastDay"]:
                        insert_sql = text("""
                            INSERT INTO daily_weather_test (
                                memId, cityId, cityName, countryName,
                                forecastDate, weather, wxdesc,
                                minTemp, maxTemp, minTempF, maxTempF, weatherIcon
                            )
                            VALUES (
                                :memId, :cityId, :cityName, :countryName,
                                :forecastDate, :weather, :wxdesc,
                                :minTemp, :maxTemp, :minTempF, :maxTempF, :weatherIcon
                            )
                            ON CONFLICT (cityId, forecastDate)
                            DO UPDATE SET
                                memId = EXCLUDED.memId,
                                cityName = EXCLUDED.cityName,
                                countryName = EXCLUDED.countryName,
                                weather = EXCLUDED.weather,
                                wxdesc = EXCLUDED.wxdesc,
                                minTemp = EXCLUDED.minTemp,
                                maxTemp = EXCLUDED.maxTemp,
                                minTempF = EXCLUDED.minTempF,
                                maxTempF = EXCLUDED.maxTempF,
                                weatherIcon = EXCLUDED.weatherIcon
                        """)
                        conn.execute(insert_sql, {
                            "memId": mem_id,
                            "cityId": city_id,
                            "cityName": city_name,
                            "countryName": country_name,
                            "forecastDate": day["forecastDate"],
                            "weather": day["weather"],
                            "wxdesc": day.get("wxdesc", ""),
                            "minTemp": to_float(day.get("minTemp")),
                            "maxTemp": to_float(day.get("maxTemp")),
                            "minTempF": to_float(day.get("minTempF")),
                            "maxTempF": to_float(day.get("maxTempF")),
                            "weatherIcon": to_float(day.get("weatherIcon")),
                        })
                except Exception as e:
                    logger.warning(f"DB 저장 중 오류 발생 (cityId={city.get('city', {}).get('cityId')}): {e}")
        logger.info("✅ DB 저장 완료")
    except Exception as e:
        logger.error(f"❌ 전체 DB 저장 실패: {e}")
        raise

# ---------------- 전체 실행 ----------------
def main():
    logger.info("🌍 세계 날씨 데이터 수집 시작")
    city_ids = city_ids_list()
    logger.info(f"📌 수집된 도시 ID 개수: {len(city_ids)}")
    all_data = all_cities_weather(city_ids)
    logger.info("☁️ 도시별 날씨 수집 완료")
    save_to_db(all_data)
    logger.info("📦 날씨 데이터 업데이트 완료")

if __name__ == "__main__":
    main()
