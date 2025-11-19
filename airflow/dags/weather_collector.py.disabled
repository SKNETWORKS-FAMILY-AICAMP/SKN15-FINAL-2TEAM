"""
날씨 정보 수집 DAG
주기적으로 세계 주요 도시의 날씨 정보를 수집하여 PostgreSQL에 저장
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


def collect_weather_data(**context):
    """
    세계 기상 정보를 크롤링하여 수집
    """
    # 예시: worldweather.wmo.int에서 데이터 수집
    cities = ['Seoul', 'Tokyo', 'Paris', 'New York', 'London']
    weather_data = []

    for city in cities:
        try:
            # 실제 구현시 적절한 API 또는 크롤링 로직 사용
            # 예시 데이터
            data = {
                'city': city,
                'temperature': 20,  # 실제로는 크롤링 또는 API에서 가져옴
                'condition': 'Sunny',
                'humidity': 60,
                'collected_at': datetime.now(),
            }
            weather_data.append(data)
            print(f"Collected weather data for {city}")
        except Exception as e:
            print(f"Error collecting data for {city}: {str(e)}")

    # XCom에 데이터 저장
    context['task_instance'].xcom_push(key='weather_data', value=weather_data)
    return len(weather_data)


def save_to_database(**context):
    """
    수집한 날씨 데이터를 PostgreSQL에 저장
    """
    # XCom에서 데이터 가져오기
    weather_data = context['task_instance'].xcom_pull(
        task_ids='collect_weather',
        key='weather_data'
    )

    if not weather_data:
        print("No weather data to save")
        return

    # PostgreSQL 연결
    pg_hook = PostgresHook(postgres_conn_id='travel_planner_db')
    conn = pg_hook.get_conn()
    cursor = conn.cursor()

    # 데이터 저장 (실제 테이블 스키마에 맞게 수정 필요)
    try:
        for data in weather_data:
            cursor.execute("""
                INSERT INTO weather_info (city, temperature, condition, humidity, collected_at)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (city, collected_at)
                DO UPDATE SET
                    temperature = EXCLUDED.temperature,
                    condition = EXCLUDED.condition,
                    humidity = EXCLUDED.humidity
            """, (
                data['city'],
                data['temperature'],
                data['condition'],
                data['humidity'],
                data['collected_at']
            ))

        conn.commit()
        print(f"Saved {len(weather_data)} weather records to database")
    except Exception as e:
        conn.rollback()
        print(f"Error saving to database: {str(e)}")
        raise
    finally:
        cursor.close()
        conn.close()


# DAG 정의
dag = DAG(
    'weather_collector',
    default_args=default_args,
    description='Collect weather information for major cities',
    schedule_interval='0 */6 * * *',  # 6시간마다 실행
    catchup=False,
    tags=['data-collection', 'weather'],
)

# Task 정의
collect_weather = PythonOperator(
    task_id='collect_weather',
    python_callable=collect_weather_data,
    dag=dag,
)

save_to_db = PythonOperator(
    task_id='save_to_database',
    python_callable=save_to_database,
    dag=dag,
)

# Task 의존성 설정
collect_weather >> save_to_db
