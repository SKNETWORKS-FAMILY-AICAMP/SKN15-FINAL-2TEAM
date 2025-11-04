from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta
from dotenv import load_dotenv
import os, sys

# .env 로드
load_dotenv()

# scripts 폴더를 경로에 추가
sys.path.append('/opt/airflow/scripts')
import exchange_rates as exchange_script

default_args = {
    "owner": "airflow",
    "depends_on_past": False,
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
}

def run_exchange():
    exchange_script.main()

with DAG(
    dag_id="d_exchange_rates",
    default_args=default_args,
    description="Fetch exchange rates and save to DB",
    schedule_interval="*/2 * * * *",   # 매 2분마다
    start_date=datetime(2025, 10, 1),
    catchup=False,
    tags=["exchange"],
) as dag:

    task_exchange = PythonOperator(
        task_id="exchange_task",
        python_callable=run_exchange,
    )
