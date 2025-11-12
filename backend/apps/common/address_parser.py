"""
주소 파싱 유틸리티
한국 주소를 파싱하여 시/도, 시/군/구, 읍/면/동을 추출
"""
import re
from apps.common.models import Province, City, District


def parse_korean_address(address: str):
    """
    한국 주소를 파싱하여 province, city, district 정보를 반환

    Args:
        address: 주소 문자열 (예: "서울 종로구 사직로 161", "서울특별시 종로구 사직동")

    Returns:
        dict: {
            'province': KRProvince instance or None,
            'city': KRCity instance or None,
            'district': KRDistrict instance or None
        }
    """
    if not address:
        return {'province': None, 'city': None, 'district': None}

    # 주소 정규화 (띄어쓰기 통일)
    address = address.strip()

    result = {
        'province': None,
        'city': None,
        'district': None
    }

    try:
        # 1. 시/도 추출
        # 패턴: "서울", "서울특별시", "경기도", "제주특별자치도" 등
        province_patterns = [
            r'(서울특별시|서울)',
            r'(부산광역시|부산)',
            r'(대구광역시|대구)',
            r'(인천광역시|인천)',
            r'(광주광역시|광주)',
            r'(대전광역시|대전)',
            r'(울산광역시|울산)',
            r'(세종특별자치시|세종)',
            r'(경기도|경기)',
            r'(강원특별자치도|강원도|강원)',
            r'(충청북도|충북)',
            r'(충청남도|충남)',
            r'(전북특별자치도|전라북도|전북)',
            r'(전라남도|전남)',
            r'(경상북도|경북)',
            r'(경상남도|경남)',
            r'(제주특별자치도|제주도|제주)',
        ]

        province_name = None
        for pattern in province_patterns:
            match = re.search(pattern, address)
            if match:
                province_name = match.group(1)
                break

        if province_name:
            # DB에서 시/도 찾기 (여러 가능성 시도)
            province = None
            search_names = [province_name]

            # "서울" → "서울특별시" 변환
            if province_name == "서울":
                search_names.append("서울특별시")
            elif province_name == "경기":
                search_names.append("경기도")
            elif province_name == "제주":
                search_names.extend(["제주도", "제주특별자치도"])

            for name in search_names:
                province = Province.objects.filter(name__icontains=name).first()
                if province:
                    result['province'] = province
                    break

        # 2. 시/군/구 추출
        # 패턴: "종로구", "성북구", "강남구", "수원시", "용인시 수지구" 등
        city_pattern = r'([가-힣]+(?:시|군|구))'
        city_matches = re.findall(city_pattern, address)

        if city_matches and result['province']:
            # 첫 번째 매치를 시/군/구로 사용
            city_name = city_matches[0]

            # DB에서 시/군/구 찾기
            city = City.objects.filter(
                province=result['province'],
                name__icontains=city_name
            ).first()

            if city:
                result['city'] = city

        # 3. 읍/면/동 추출
        # 패턴: "사직동", "신당동", "역삼동", "삼성1동" 등
        district_pattern = r'([가-힣]+[0-9]*(?:읍|면|동))'
        district_matches = re.findall(district_pattern, address)

        if district_matches and result['city']:
            # 첫 번째 매치를 읍/면/동으로 사용
            district_name = district_matches[0]

            # DB에서 읍/면/동 찾기
            district = District.objects.filter(
                city=result['city'],
                name__icontains=district_name
            ).first()

            if district:
                result['district'] = district

        # 읍/면/동이 없으면 첫 번째 읍/면/동 사용 (fallback)
        if not result['district'] and result['city']:
            first_district = District.objects.filter(city=result['city']).order_by('district_idx').first()
            if first_district:
                result['district'] = first_district
                print(f"⚠️ 읍/면/동을 찾을 수 없어 첫 번째 읍/면/동 사용: {first_district.name}")

    except Exception as e:
        print(f"❌ Address parsing error: {e}")

    return result


def get_location_for_weather(address: str):
    """
    주소에서 날씨 조회에 사용할 지역 정보를 반환

    Args:
        address: 주소 문자열

    Returns:
        dict: {
            'province_idx': int or None,
            'city_idx': int or None,
            'district_idx': int or None,
        }
    """
    parsed = parse_korean_address(address)

    return {
        'province_idx': parsed['province'].province_idx if parsed['province'] else None,
        'city_idx': parsed['city'].city_idx if parsed['city'] else None,
        'district_idx': parsed['district'].district_idx if parsed['district'] else None,
    }
