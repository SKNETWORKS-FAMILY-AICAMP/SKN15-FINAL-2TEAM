# 🚀 TRIPLAN 발표용 전체 데이터 삽입 가이드

## 📋 개요

AWS 데이터베이스에 발표 시연용 데이터를 한 번에 삽입하는 가이드입니다.

---

## 📦 포함된 SQL 파일

| 순서 | 파일명 | 내용 | 필수 여부 |
|------|--------|------|-----------|
| 1️⃣ | `insert_base_data.sql` | 국가(17개) & 도시(60+개) | ✅ **필수** |
| 2️⃣ | `insert_categories.sql` | 여행지 카테고리(34개) | ✅ **필수** |
| 3️⃣ | `insert_demo_places.sql` | 인기 여행지(20개) | ✅ **필수** |

---

## 🎯 삽입될 데이터 요약

### 1️⃣ 국가(Country) - 17개국

| 지역 | 국가 |
|------|------|
| 🌏 **아시아** | 일본, 한국, 중국, 대만, 태국, 베트남, 싱가포르 |
| 🌍 **유럽** | 프랑스, 영국, 독일, 이탈리아, 스페인, 스위스 |
| 🌎 **북미** | 미국, 캐나다 |
| 🌏 **오세아니아** | 호주, 뉴질랜드 |

### 2️⃣ 도시(Region1) - 60+개

| 국가 | 주요 도시 |
|------|----------|
| 🇯🇵 일본 | 도쿄, 오사카, 교토, 후쿠오카, 삿포로, 고베, 나고야 (8개) |
| 🇰🇷 한국 | 서울, 부산, 대구, 인천, 광주, 대전, 울산, 경기, 제주 (9개) |
| 🇫🇷 프랑스 | 파리, 마르세유, 리옹, 툴루즈, 니스, 보르도 (7개) |
| 🇺🇸 미국 | 뉴욕, LA, 시카고, 휴스턴, 마이애미, 라스베이거스 (8개) |
| 🇨🇳 중국 | 베이징, 상하이, 광저우, 선전, 충칭, 청두 (6개) |
| 🇹🇭 태국 | 방콕, 푸켓, 치앙마이, 파타야 (4개) |
| 🇬🇧 영국 | 런던, 맨체스터, 버밍엄, 에든버러, 리버풀 (5개) |
| 🇮🇹 이탈리아 | 로마, 밀라노, 베네치아, 피렌체, 나폴리 (5개) |
| 기타 | 스페인(4), 호주(5) 등 |

### 3️⃣ 카테고리 - 34개

| 대분류 (7개) | 하위 분류 |
|--------------|-----------|
| 관광 명소 | 랜드마크, 관심 지점, 역사 유적 |
| 문화 시설 | 박물관, 미술관, 도서관, 극장 |
| 자연 | 공원, 해변, 산, 호수, 정원 |
| 음식 | 레스토랑, 카페, 시장, 바 |
| 쇼핑 | 쇼핑몰, 백화점, 쇼핑 거리 |
| 엔터테인먼트 | 테마파크, 동물원, 수족관, 카지노 |
| 종교 시설 | 사찰, 교회, 신사, 모스크 |

### 4️⃣ 여행지(Places) - 20개

| 도시 | 여행지 (각 5개) |
|------|----------------|
| 🇯🇵 도쿄 | 도쿄 스카이트리, 센소지, 메이지 신궁, 시부야, 츠키지 시장 |
| 🇫🇷 파리 | 에펠탑, 루브르, 개선문, 노트르담, 몽마르뜨 |
| 🇰🇷 서울 | 경복궁, N서울타워, 명동, 북촌 한옥마을, 광화문 광장 |
| 🇺🇸 뉴욕 | 자유의 여신상, 타임스퀘어, 센트럴 파크, 브루클린 브릿지, 엠파이어 스테이트 빌딩 |

---

## 🚀 실행 방법

### ✅ 방법 1: 한 번에 모두 실행 (추천!)

```bash
# AWS RDS 정보 설정
export DB_HOST="your-rds-endpoint.rds.amazonaws.com"
export DB_USER="triplan_admin"
export DB_NAME="triplan_db"
export PGPASSWORD="your_password"

# 모든 SQL 파일 순차 실행
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f insert_base_data.sql && \
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f insert_categories.sql && \
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f insert_demo_places.sql
```

### ✅ 방법 2: 하나씩 실행

```bash
# 1단계: 기본 데이터 (국가 & 도시)
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f insert_base_data.sql

# 2단계: 카테고리
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f insert_categories.sql

# 3단계: 여행지 데이터
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f insert_demo_places.sql
```

### ✅ 방법 3: Docker 컨테이너에서 실행

```bash
# 모든 SQL 파일 순차 실행
docker exec -i triplan-backend psql -h $DB_HOST -U $DB_USER -d $DB_NAME < insert_base_data.sql
docker exec -i triplan-backend psql -h $DB_HOST -U $DB_USER -d $DB_NAME < insert_categories.sql
docker exec -i triplan-backend psql -h $DB_HOST -U $DB_USER -d $DB_NAME < insert_demo_places.sql
```

---

## 📊 실행 결과 확인

### 1️⃣ 기본 데이터 확인 (insert_base_data.sql)

```
✅ 기본 데이터 삽입 완료!
==========================================
📍 국가(Country): 17 개
🏙️  도시(Region1): 60+ 개
==========================================
```

### 2️⃣ 카테고리 확인 (insert_categories.sql)

```
✅ 카테고리 데이터 삽입 완료!
==========================================
📁 전체 카테고리: 34 개
📂 최상위 카테고리: 7 개
📄 하위 카테고리: 27 개
==========================================
```

### 3️⃣ 여행지 확인 (insert_demo_places.sql)

```
 total_places | countries | cities
--------------+-----------+--------
           20 |         4 |      4

 country_name | iso2 | place_count
--------------+------+-------------
 일본         | JP   |           5
 프랑스       | FR   |           5
 대한민국     | KR   |           5
 미국         | US   |           5
```

---

## 🔍 데이터 검증 쿼리

### 전체 데이터 통계

```sql
-- 국가, 도시, 카테고리, 여행지 수 확인
SELECT
    '국가(Country)' as category,
    COUNT(*) as count
FROM common_country

UNION ALL

SELECT
    '도시(Region1)' as category,
    COUNT(*) as count
FROM common_region1

UNION ALL

SELECT
    '카테고리(Category)' as category,
    COUNT(*) as count
FROM common_places_category

UNION ALL

SELECT
    '여행지(Places)' as category,
    COUNT(*) as count
FROM place_places;
```

**예상 결과:**
```
    category          | count
----------------------+-------
 국가(Country)        |    17
 도시(Region1)        |    60+
 카테고리(Category)    |    34
 여행지(Places)       |    20
```

### 국가별 통계

```sql
SELECT
    c.country_name,
    c.iso2,
    COUNT(DISTINCT r.region1_idx) as cities,
    COUNT(p.place_idx) as places
FROM common_country c
LEFT JOIN common_region1 r ON c.country_idx = r.country_code
LEFT JOIN place_places p ON c.country_idx = p.country_idx
GROUP BY c.country_name, c.iso2
ORDER BY places DESC, cities DESC;
```

### 도시별 여행지

```sql
SELECT
    c.country_name,
    r.city_name,
    COUNT(p.place_idx) as place_count,
    ROUND(AVG(p.rating), 2) as avg_rating
FROM common_region1 r
JOIN common_country c ON r.country_code = c.country_idx
LEFT JOIN place_places p ON r.region1_idx = p.region1_idx
GROUP BY c.country_name, r.city_name
HAVING COUNT(p.place_idx) > 0
ORDER BY place_count DESC;
```

---

## 🧪 API 테스트

### Django API로 데이터 조회

```bash
# 1. 토큰 발급
TOKEN=$(curl -s -X POST http://localhost:8000/api/accounts/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test1234"}' \
  | jq -r '.access')

# 2. 전체 여행지 목록
curl -X GET "http://localhost:8000/api/places/places/?limit=20" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# 3. 도쿄 여행지만 조회
curl -X GET "http://localhost:8000/api/places/places/?city=도쿄" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# 4. 평점 높은 순
curl -X GET "http://localhost:8000/api/places/places/?ordering=-rating&limit=10" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# 5. 카테고리별 조회
curl -X GET "http://localhost:8000/api/places/places/?category=museum" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

---

## ⚠️ 주의사항

### 실행 전 체크리스트

- [ ] AWS RDS 접속 정보 확인
- [ ] PostgreSQL 버전 확인 (12 이상 권장)
- [ ] 데이터베이스 접속 권한 확인
- [ ] pgvector 확장 설치 확인 (여행지 추천용)

### 중복 실행 방지

SQL 파일에 `ON CONFLICT` 절이 포함되어 있어 **안전하게 재실행** 가능합니다.

```sql
-- 예시: 중복 시 업데이트
ON CONFLICT (country_code) DO UPDATE SET
    country_name = EXCLUDED.country_name,
    updated_at = NOW();
```

### 데이터 초기화 (필요시)

```sql
-- ⚠️ 주의: 모든 데이터 삭제!
BEGIN;
DELETE FROM place_place_categories;
DELETE FROM place_photos;
DELETE FROM place_places;
DELETE FROM common_places_category;
DELETE FROM common_region2;
DELETE FROM common_region1;
DELETE FROM common_country;
COMMIT;
```

---

## 🎬 발표 시연 시나리오

### 1단계: 로그인 & 여행 생성

```
사용자: 로그인 → 새 여행 생성 (3박 4일 도쿄 여행)
```

### 2단계: 챗봇으로 여행지 추천

```
사용자: "도쿄에서 가볼만한 곳 추천해줘"

챗봇 응답:
✅ 도쿄 스카이트리 (★4.5) - 125,430개 리뷰
✅ 센소지 (★4.6) - 98,234개 리뷰
✅ 메이지 신궁 (★4.5) - 87,543개 리뷰
✅ 시부야 스크램블 교차로 (★4.4)
✅ 츠키지 시장 (★4.3)
```

### 3단계: 플래너에 추가

```
챗봇 추천 → [추가] 버튼 클릭 → 1일차에 자동 추가
```

### 4단계: 실시간 협업 시연

```
사용자 A: 에펠탑 추가
  ↓ (WebSocket 브로드캐스트)
사용자 B, C 화면에 즉시 반영! ⚡
```

---

## 🔧 트러블슈팅

### 문제 1: 외래 키 오류

```
ERROR: insert or update on table violates foreign key constraint
```

**해결:** SQL 파일 실행 순서 확인
1. `insert_base_data.sql` (국가/도시 먼저!)
2. `insert_categories.sql`
3. `insert_demo_places.sql`

### 문제 2: 권한 오류

```
ERROR: permission denied for table
```

**해결:**
```sql
-- 관리자 계정으로 실행
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO triplan_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO triplan_admin;
```

### 문제 3: 연결 타임아웃

```
ERROR: could not connect to server
```

**해결:**
- AWS Security Group에서 포트 5432 열려있는지 확인
- VPC 설정 확인
- RDS 엔드포인트 주소 재확인

---

## 📝 추가 데이터 삽입 예시

### 새로운 국가 추가

```sql
INSERT INTO common_country (country_code, iso2, country_name, name_local)
VALUES (643, 'RU', '러시아', 'Россия');
```

### 새로운 도시 추가

```sql
INSERT INTO common_region1 (country_code, city_code, city_name)
VALUES (
    (SELECT country_idx FROM common_country WHERE iso2 = 'RU'),
    77,
    '모스크바'
);
```

### 새로운 여행지 추가

```sql
INSERT INTO place_places (
    place_id, name, ko_name,
    country_idx, region1_idx,
    latitude, longitude, rating,
    created_at, updated_at
) VALUES (
    'new_place_id_123',
    'Red Square',
    '붉은 광장',
    (SELECT country_idx FROM common_country WHERE iso2 = 'RU'),
    (SELECT region1_idx FROM common_region1 WHERE city_name = '모스크바'),
    55.7539,
    37.6208,
    4.8,
    NOW(),
    NOW()
);
```

---

## ✅ 최종 체크리스트

발표 전 확인:

- [ ] AWS RDS 정상 접속 확인
- [ ] 3개 SQL 파일 모두 성공적으로 실행
- [ ] 총 17개국, 60+개 도시 확인
- [ ] 20개 여행지 모두 삽입 확인
- [ ] API로 데이터 조회 테스트 완료
- [ ] 챗봇에서 여행지 검색 테스트
- [ ] 플래너에 여행지 추가 테스트
- [ ] 실시간 협업 기능 테스트

---

## 🎉 완료!

모든 데이터가 성공적으로 삽입되었다면 발표 준비 완료!

**Good Luck with your presentation! 🚀**

---

## 📞 문의

문제 발생 시:
1. 에러 메시지 복사
2. 실행한 SQL 파일 확인
3. 테이블 스키마 확인: `\d table_name`
4. 로그 확인: `tail -f /var/log/postgresql/postgresql.log`
