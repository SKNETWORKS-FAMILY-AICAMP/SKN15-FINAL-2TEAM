"""
환율 정보 수집 DAG
주요 통화의 환율 정보를 수집하여 PostgreSQL에 저장
"""

from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.providers.postgres.hooks.postgres import PostgresHook
import requests
from bs4 import BeautifulSoup


default_args = {
    'owner': 'airflow',
    'depends_on_past': False,
    'start_date': datetime(2024, 1, 1),
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 3,
    'retry_delay': timedelta(minutes=5),
}


def collect_exchange_rates(**context):
    """
    네이버 종합 환율에서 환율 정보 크롤링
    """
    currencies = ['USD', 'JPY', 'EUR', 'CNY', 'GBP', 'THB', 'VND']
    exchange_data = []

    try:
        # 예시: 네이버 환율 페이지 (실제 구현시 API 또는 적절한 크롤링 로직 사용)
        # url = "https://finance.naver.com/marketindex/"
        # response = requests.get(url)
        # soup = BeautifulSoup(response.content, 'html.parser')

        # 예시 데이터 (실제로는 크롤링 또는 API에서 가져옴)
        for currency in currencies:
            data = {
                'currency_code': currency,
                'base_currency': 'KRW',
                'rate': 1000.0,  # 실제 환율
                'collected_at': datetime.now(),
            }
            exchange_data.append(data)
            print(f"Collected exchange rate for {currency}")

    except Exception as e:
        print(f"Error collecting exchange rates: {str(e)}")
        raise

    context['task_instance'].xcom_push(key='exchange_data', value=exchange_data)
    return len(exchange_data)


def save_to_database(**context):
    """
    수집한 환율 데이터를 PostgreSQL에 저장
    """
    exchange_data = context['task_instance'].xcom_pull(
        task_ids='collect_exchange_rates',
        key='exchange_data'
    )

    if not exchange_data:
        print("No exchange rate data to save")
        return

    pg_hook = PostgresHook(postgres_conn_id='travel_planner_db')
    conn = pg_hook.get_conn()
    cursor = conn.cursor()

    try:
        for data in exchange_data:
            cursor.execute("""
                INSERT INTO exchange_rates (currency_code, base_currency, rate, collected_at)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (currency_code, base_currency, collected_at)
                DO UPDATE SET rate = EXCLUDED.rate
            """, (
                data['currency_code'],
                data['base_currency'],
                data['rate'],
                data['collected_at']
            ))

        conn.commit()
        print(f"Saved {len(exchange_data)} exchange rate records to database")
    except Exception as e:
        conn.rollback()
        print(f"Error saving to database: {str(e)}")
        raise
    finally:
        cursor.close()
        conn.close()


dag = DAG(
    'exchange_rate_collector',
    default_args=default_args,
    description='Collect exchange rates for major currencies',
    schedule_interval='0 9 * * *',  # 매일 오전 9시 실행
    catchup=False,
    tags=['data-collection', 'exchange-rate'],
)

collect_rates = PythonOperator(
    task_id='collect_exchange_rates',
    python_callable=collect_exchange_rates,
    dag=dag,
)

save_to_db = PythonOperator(
    task_id='save_to_database',
    python_callable=save_to_database,
    dag=dag,
)

collect_rates >> save_to_db
