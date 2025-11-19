"""
기상청 일별 예보 크롤링 DAG
매일 증분 수집 모드로 실행하여 새로운 날씨 데이터만 수집
"""
from airflow import DAG
from airflow.operators.bash import BashOperator
from datetime import datetime, timedelta

default_args = {
    "owner": "airflow",
    "depends_on_past": False,
    "retries": 2,
    "retry_delay": timedelta(minutes=10),
    "email_on_failure": False,
    "email_on_retry": False,
}

with DAG(
    dag_id="d_fetch_kma_daily_incremental",
    default_args=default_args,
    description="기상청 일별 예보 증분 수집 (오늘 이후 데이터만)",
    schedule_interval="0 6 * * *",   # 매일 오전 6시 실행
    start_date=datetime(2025, 11, 13),
    catchup=False,
    tags=["weather", "kma", "incremental"],
) as dag:

    # 증분 수집 태스크
    fetch_incremental = BashOperator(
        task_id="fetch_kma_daily_incremental",
        bash_command="""
        cd /opt/airflow/dags/../.. && \
        python manage.py fetch_kma_daily --incremental
        """,
        execution_timeout=timedelta(hours=2),
    )

    fetch_incremental


# 전체 재수집용 별도 DAG (수동 실행용)
with DAG(
    dag_id="d_fetch_kma_daily_full",
    default_args=default_args,
    description="기상청 일별 예보 전체 수집 (초기 또는 재수집용)",
    schedule_interval=None,  # 수동 실행만
    start_date=datetime(2025, 11, 13),
    catchup=False,
    tags=["weather", "kma", "full", "manual"],
) as dag_full:

    # 전체 수집 태스크
    fetch_full = BashOperator(
        task_id="fetch_kma_daily_full",
        bash_command="""
        cd /opt/airflow/dags/../.. && \
        python manage.py fetch_kma_daily --full
        """,
        execution_timeout=timedelta(hours=4),
    )

    fetch_full
