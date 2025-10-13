.PHONY: help up down build logs shell migrate test clean

# 기본 타겟
.DEFAULT_GOAL := help

# 도움말
help:
	@echo "Triplan - Available Commands"
	@echo "===================================="
	@echo "make up          - 모든 서비스 시작"
	@echo "make down        - 모든 서비스 중지"
	@echo "make build       - 모든 이미지 빌드"
	@echo "make logs        - 전체 로그 확인"
	@echo "make ps          - 실행 중인 컨테이너 확인"
	@echo "make shell-be    - Backend 쉘 접속"
	@echo "make shell-fe    - Frontend 쉘 접속"
	@echo "make migrate     - Django 마이그레이션"
	@echo "make superuser   - Django 슈퍼유저 생성"
	@echo "make test-be     - Backend 테스트"
	@echo "make test-fe     - Frontend 테스트"
	@echo "make clean       - 컨테이너 및 볼륨 삭제"
	@echo "make restart-be  - Backend 재시작"
	@echo "make restart-fe  - Frontend 재시작"

# 서비스 관리
up:
	docker-compose up -d

down:
	docker-compose down

build:
	docker-compose build

rebuild:
	docker-compose up -d --build

ps:
	docker-compose ps

logs:
	docker-compose logs -f --tail=100

logs-be:
	docker-compose logs -f --tail=100 backend

logs-fe:
	docker-compose logs -f --tail=100 frontend

# 개발 환경
dev:
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

dev-build:
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# Shell 접속
shell-be:
	docker-compose exec backend python manage.py shell

shell-fe:
	docker-compose exec frontend sh

shell-db:
	docker-compose exec postgres psql -U postgres -d triplan

shell-redis:
	docker-compose exec redis redis-cli

# Backend 관리
migrate:
	docker-compose exec backend python manage.py migrate

makemigrations:
	docker-compose exec backend python manage.py makemigrations

superuser:
	docker-compose exec backend python manage.py createsuperuser

collectstatic:
	docker-compose exec backend python manage.py collectstatic --noinput

# 테스트
test-be:
	docker-compose exec backend pytest

test-fe:
	docker-compose exec frontend npm test

test-all: test-be test-fe

# 서비스 재시작
restart-be:
	docker-compose restart backend

restart-fe:
	docker-compose restart frontend

restart-airflow:
	docker-compose restart airflow-scheduler airflow-webserver

# 클린업
clean:
	docker-compose down -v
	rm -rf data/postgres/*
	rm -rf data/redis/*

clean-all: clean
	docker system prune -af

# 데이터베이스 백업
backup-db:
	docker-compose exec postgres pg_dump -U postgres triplan > backup_$(shell date +%Y%m%d_%H%M%S).sql

# 데이터베이스 복원
restore-db:
	@echo "Usage: make restore-db FILE=backup_file.sql"
	docker-compose exec -T postgres psql -U postgres triplan < $(FILE)

# Airflow 초기화
init-airflow:
	docker-compose exec airflow-webserver airflow db init
	docker-compose exec airflow-webserver airflow users create \
		--username admin \
		--password admin \
		--firstname Admin \
		--lastname User \
		--role Admin \
		--email admin@example.com

# 전체 설정
init: build up migrate init-airflow superuser
	@echo "✅ Triplan 초기 설정 완료!"
	@echo "Frontend: http://localhost:3000"
	@echo "Backend: http://localhost:8000"
	@echo "Airflow: http://localhost:8080"
