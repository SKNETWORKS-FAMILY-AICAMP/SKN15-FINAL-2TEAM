#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import requests
from bs4 import BeautifulSoup
from sqlalchemy import create_engine, text
from urllib.parse import quote_plus
from dotenv import load_dotenv
import os
import logging

# ---------------- 로깅 설정 ----------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

# ---------------- .env 로딩 및 DB 설정 ----------------
load_dotenv()

db_config = {
    "host": os.getenv("DB_HOST"),
    "port": int(os.getenv("DB_PORT")),
    "database": os.getenv("DB_NAME"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD")
}


def get_engine():
    """PostgreSQL 엔진 생성"""
    try:
        password_safe = quote_plus(db_config['password'])
        engine = create_engine(
            f"postgresql+psycopg2://{db_config['user']}:{password_safe}@{db_config['host']}:{db_config['port']}/{db_config['database']}",
            pool_pre_ping=True,
            pool_recycle=3600
        )
        logger.info("✅ DB 연결 성공")
        return engine
    except Exception as e:
        logger.error(f"❌ DB 연결 실패: {e}")
        raise


# ---------------- 여행경보 데이터 수집 ----------------
def fetch_travel_alerts():
    """외교부 0404.go.kr 여행경보 페이지에서 데이터 수집"""
    try:
        BASE = "https://0404.go.kr"
        LIST_URL = BASE + "/ntnSafetyInfo/list"

        resp = requests.get(LIST_URL, timeout=10)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        alerts = []
        for a in soup.select("div.board-country-result > ul > li > a.btn"):
            country_text = a.contents[0].strip()
            spans = a.find_all("span", class_="caution")
            level_str = ", ".join([s.get_text(strip=True) for s in spans]) if spans else "안전(경보없음)"
            detail_url = BASE + a.get("href")

            alerts.append({
                "country": country_text,
                "level": level_str,
                "url": detail_url
            })

        logger.info(f"🌍 여행경보 {len(alerts)}개 수집 완료")
        return alerts
    except Exception as e:
        logger.error(f"❌ 여행경보 수집 실패: {e}")
        return []


# ---------------- DB 저장 (common_country.country_name → country_code 매핑 포함) ----------------
def save_to_db(alerts):
    """common_country.country_name 기준으로 country_code 매핑 후 travel_alerts에 저장 (매핑 실패 시 삽입 안 함)"""
    if not alerts:
        logger.warning("⚠️ 저장할 여행경보 데이터 없음")
        return

    try:
        engine = get_engine()
        inserted = 0
        skipped = 0

        with engine.begin() as conn:
            for alert in alerts:
                # 1️⃣ country_name 기준으로 country_code 매핑 (부분 일치)
                get_code_sql = text("""
                    SELECT country_code FROM common_country
                    WHERE :country LIKE '%' || country_name || '%'
                    LIMIT 1;
                """)
                result = conn.execute(get_code_sql, {"country": alert["country"]}).fetchone()
                country_code_value = result[0] if result else None

                # 2️⃣ 매핑 실패 시 skip (삽입 안 함)
                if not country_code_value:
                    skipped += 1
                    continue

                # 3️⃣ DB insert (중복 방지)
                insert_sql = text("""
                    INSERT INTO travel_alerts (country_code, level, url, created_at)
                    VALUES (:country_code, :level, :url, now())
                    ON CONFLICT (country_code)
                    DO UPDATE SET
                        level = EXCLUDED.level,
                        url = EXCLUDED.url,
                        created_at = now();
                """)

                conn.execute(insert_sql, {
                    "country_code": country_code_value,
                    "level": alert["level"],
                    "url": alert["url"]
                })
                inserted += 1

        logger.info(f"✅ DB 저장 완료 — 삽입 {inserted}건, 매핑 실패 {skipped}건 (DB 미삽입)")

    except Exception as e:
        logger.error(f"❌ DB 저장 실패: {e}")
        raise


# ---------------- main ----------------
def main():
    logger.info("🚨 여행경보 데이터 수집 시작")
    alerts = fetch_travel_alerts()
    save_to_db(alerts)
    logger.info("📦 전체 저장 완료")


# ---------------- 실행 ----------------
if __name__ == "__main__":
    main()
