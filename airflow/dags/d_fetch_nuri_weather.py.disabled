from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta
from dotenv import load_dotenv
from pendulum import timezone
import os, sys

# ---------------- 환경 설정 ----------------
load_dotenv()

sys.path.append('/opt/airflow/scripts')
import fetch_nuri_weather as nuri_script

# ---------------- 타임존 설정 ----------------
KST = timezone("Asia/Seoul")

# ---------------- 기본 인자 설정 ----------------
default_args = {
    "owner": "airflow",
    "depends_on_past": False,
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
}

# ---------------- 실행 함수 ----------------
def run_nuri_weather():
    nuri_script.main()

# ---------------- DAG 정의 ----------------
with DAG(
    dag_id="d_fetch_nuri_weather",
    default_args=default_args,
    description="Fetch Nuri global weather and save to DB",
    schedule_interval="0 2 * * *",   # UTC 02:00 → KST 11:00
    start_date=datetime(2025, 10, 1, tzinfo=KST),
    catchup=False,
    tags=["weather", "nuri"],
) as dag:

    task_nuri_weather = PythonOperator(
        task_id="nuri_weather_task",
        python_callable=run_nuri_weather,
        execution_timeout=timedelta(minutes=60),   # 태스크 최대 60분 허용
        retries=2,
    )
