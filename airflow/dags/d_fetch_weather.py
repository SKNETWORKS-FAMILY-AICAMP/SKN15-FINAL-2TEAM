from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta
from dotenv import load_dotenv
import os, sys

load_dotenv()

sys.path.append('/opt/airflow/scripts')
import fetch_weather as weather_script

default_args = {
    "owner": "airflow",
    "depends_on_past": False,
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
}

def run_weather():
    weather_script.main()

with DAG(
    dag_id="d_fetch_weather",
    default_args=default_args,
    description="Fetch KMA weather and save to DB",
    schedule_interval="0 12 * * *",   # 매일 오후 12시
    start_date=datetime(2025, 10, 1),
    catchup=False,
    tags=["weather", "kma"],
) as dag:

    task_weather = PythonOperator(
        task_id="weather_task",
        python_callable=run_weather,
    )
