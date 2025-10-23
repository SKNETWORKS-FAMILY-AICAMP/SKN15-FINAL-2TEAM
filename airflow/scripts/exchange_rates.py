#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import requests
from bs4 import BeautifulSoup
from datetime import datetime
from sqlalchemy import create_engine, text
from urllib.parse import quote_plus
import logging
import os
import re
from dotenv import load_dotenv

# ---------------- 로깅 설정 ----------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# ---------------- .env 로드 및 DB 설정 ----------------
load_dotenv()

db_config = {
    "host": os.getenv("DB_HOST"),
    "port": int(os.getenv("DB_PORT")),
    "database": os.getenv("DB_NAME"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
}

password_safe = quote_plus(db_config["password"])
engine = create_engine(
    f"postgresql+psycopg2://{db_config['user']}:{password_safe}@{db_config['host']}:{db_config['port']}/{db_config['database']}",
    pool_pre_ping=True,
    pool_recycle=3600,
)

# ---------------- 1단위 환산 필요한 통화 ----------------
UNIT_CORRECT_CURRENCIES = ["VND", "IDR", "JPY"]

# ---------------- 수동 country_code 매핑 ----------------
COUNTRY_CODE_MAP = {
    "TWD": 9999,
    "EUR": 59,
    "VND": 170,
    "TZS": 153,
    "ZAR": 143,
    "AUD": 7,
    "TRY": 159,
    "CZK": 39,
    "AED": 163,
    "BND": 22,
    "RUB": 129,
}


def parse_number(text):
    """문자열에서 숫자만 추출 후 float 변환"""
    num_match = re.search(r"[\d,.]+", text)
    return float(num_match.group(0).replace(",", "")) if num_match else None


# ---------------- 환율 크롤링 ----------------
def crawl_all_rates():
    url = "https://finance.naver.com/marketindex/exchangeList.nhn"
    try:
        res = requests.get(url, timeout=10)
        res.raise_for_status()
    except Exception as e:
        logger.error(f"크롤링 실패: {e}")
        return []

    soup = BeautifulSoup(res.text, "html.parser")
    rates = []
    rows = soup.select("table.tbl_exchange tbody tr")

    for row in rows:
        tds = row.find_all("td")
        if len(tds) < 4:
            continue

        currency_raw = tds[0].get_text(" ", strip=True)

        # 통화 코드 추출 (예: USD, JPY 등)
        currency_code_match = re.search(r"[A-Z]{2,3}", currency_raw)
        currency_code = currency_code_match.group(0) if currency_code_match else ""

        # 국가명 추출
        country = currency_raw.split(currency_code)[0].strip()

        # 현찰 사/팔 값
        cash_buy = parse_number(tds[2].get_text(strip=True))
        cash_sell = parse_number(tds[3].get_text(strip=True))

        # 1단위 환산
        if currency_code in UNIT_CORRECT_CURRENCIES:
            if cash_buy is not None:
                cash_buy /= 100
            if cash_sell is not None:
                cash_sell /= 100

        rate_data = {
            "timestamp": datetime.now(),
            "country": country,
            "currency_code": currency_code,
            "bank": "네이버 종합",
            "buy": cash_buy,
            "sell": cash_sell,
        }

        rates.append(rate_data)

    logger.info(f"{len(rates)}개 통화 크롤링 성공")
    return rates


# ---------------- 전처리 로직 ----------------
def preprocess_rates(rates):
    """buy/sell None → 0, 매핑 기반 country_code 보정"""
    processed = []
    for rate in rates:
        code = rate["currency_code"]

        # buy / sell 값이 None이면 0으로
        rate["buy"] = float(rate["buy"]) if rate["buy"] is not None else 0.0
        rate["sell"] = float(rate["sell"]) if rate["sell"] is not None else 0.0

        # country_code 수동 매핑
        # DB에서 매칭 안 되는 경우에만 이 매핑을 적용
        if code in COUNTRY_CODE_MAP:
            rate["country_code_manual"] = COUNTRY_CODE_MAP[code]
        else:
            rate["country_code_manual"] = None

        processed.append(rate)

    return processed


# ---------------- DB 저장 ----------------
def save_to_db(rates):
    """common_country.country_name 기준 매핑 + 수동 매핑 병행"""
    if not rates:
        logger.warning("⚠️ 저장할 환율 데이터가 없습니다.")
        return

    try:
        with engine.begin() as conn:
            for rate in rates:
                # 국가 이름으로 country_code 조회
                get_code_sql = text("""
                    SELECT country_code FROM common_country
                    WHERE country_name = :country
                    LIMIT 1;
                """)
                result = conn.execute(get_code_sql, {"country": rate["country"]}).fetchone()
                country_code_db = result[0] if result else None

                # DB에 없으면 수동 매핑 사용
                country_code = country_code_db or rate["country_code_manual"]

                # DB 저장 (UPSERT)
                upsert_sql = text("""
                    INSERT INTO exchange_rates (
                        timestamp, country_code, currency_code, bank, buy, sell, created_at
                    )
                    VALUES (
                        :timestamp, :country_code, :currency_code, :bank, :buy, :sell, now()
                    )
                    ON CONFLICT (currency_code, bank)
                    DO UPDATE SET
                        timestamp = EXCLUDED.timestamp,
                        country_code = EXCLUDED.country_code,
                        buy = EXCLUDED.buy,
                        sell = EXCLUDED.sell,
                        created_at = now();
                """)

                conn.execute(upsert_sql, {
                    "timestamp": rate["timestamp"],
                    "country_code": country_code,
                    "currency_code": rate["currency_code"],
                    "bank": rate["bank"],
                    "buy": rate["buy"],
                    "sell": rate["sell"],
                })

        logger.info("✅ DB 저장 완료")

    except Exception as e:
        logger.error(f"❌ DB 저장 실패: {e}")
        raise


# ---------------- main ----------------
def main():
    logger.info("💱 환율 크롤링 시작")
    rates = crawl_all_rates()
    cleaned_rates = preprocess_rates(rates) # 전처리
    save_to_db(cleaned_rates)
    logger.info("📦 작업 완료")


if __name__ == "__main__":
    main()
