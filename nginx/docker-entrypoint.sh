#!/bin/sh

# ========================================
# Nginx Entrypoint Script
# ========================================
# 환경변수를 nginx.conf에 적용

set -e

# 기본값 설정 (로컬 개발환경용)
export BACKEND_HOST=${BACKEND_HOST:-backend}
export WEBSOCKET_HOST=${WEBSOCKET_HOST:-websocket}
export FRONTEND_HOST=${FRONTEND_HOST:-frontend}

echo "========================================="
echo "Nginx Configuration"
echo "========================================="
echo "BACKEND_HOST: $BACKEND_HOST"
echo "WEBSOCKET_HOST: $WEBSOCKET_HOST"
echo "FRONTEND_HOST: $FRONTEND_HOST"
echo "========================================="

# 템플릿에서 환경변수 치환하여 실제 설정 파일 생성
envsubst '${BACKEND_HOST} ${WEBSOCKET_HOST} ${FRONTEND_HOST}' \
    < /etc/nginx/nginx.conf.template \
    > /etc/nginx/nginx.conf

echo "✅ Nginx configuration generated successfully"
echo ""

# 설정 파일 검증
nginx -t

# CMD 실행
exec "$@"
