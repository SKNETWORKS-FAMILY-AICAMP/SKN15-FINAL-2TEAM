from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta
from dotenv import load_dotenv
from pendulum import timezone
import os, sys

# ---------------- 환경설정 ----------------
load_dotenv()
sys.path.append('/opt/airflow/scripts')
import travel_alerts as alert_script

# ---------------- 타임존 설정 ----------------
KST = timezone("Asia/Seoul")

# ---------------- 기본 설정 ----------------
default_args = {
    "owner": "airflow",
    "depends_on_past": False,
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
}

# ---------------- 실행 함수 ----------------
def run_alert():
    alert_script.main()

# ---------------- DAG 정의 ----------------
with DAG(
    dag_id="d_travel_alerts",
    default_args=default_args,
    description="Fetch travel alerts and save to DB",
    schedule_interval="0 21 * * *",  # UTC 21시 → KST 오전 6시
    start_date=datetime(2025, 10, 1, tzinfo=KST),
    catchup=False,
    tags=["alert"],
) as dag:

    task_alert = PythonOperator(
        task_id="alert_task",
        python_callable=run_alert,
    )
