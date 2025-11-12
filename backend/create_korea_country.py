#!/usr/bin/env python
"""한국 Country 데이터 생성 스크립트"""

import os
import django

# Django 설정
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.common.models import Country

# 한국 Country 조회 또는 생성
korea, created = Country.objects.get_or_create(
    iso2='KR',
    defaults={
        'country_code': 82,
        'country_name': '대한민국',
        'name_local': 'South Korea'
    }
)

if created:
    print(f'✅ 한국 Country 생성 완료: {korea.country_name} (ISO2: {korea.iso2}, Code: {korea.country_code})')
else:
    print(f'⚠️  한국 Country 이미 존재: {korea.country_name} (ISO2: {korea.iso2}, Code: {korea.country_code})')
