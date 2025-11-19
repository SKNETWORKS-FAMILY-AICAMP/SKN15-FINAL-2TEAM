# 📍 TRIPLAN 발표용 여행지 데이터 삽입 가이드

## 📋 개요

AWS 데이터베이스에 발표 시연용 여행지 정보를 삽입하는 SQL 스크립트입니다.

### 포함된 데이터

| 국가 | 도시 | 여행지 수 | 주요 명소 |
|------|------|-----------|----------|
| 🇯🇵 일본 | 도쿄 | 5개 | 도쿄 스카이트리, 센소지, 메이지 신궁, 시부야, 츠키지 시장 |
| 🇫🇷 프랑스 | 파리 | 5개 | 에펠탑, 루브르 박물관, 개선문, 노트르담, 몽마르뜨 |
| 🇰🇷 한국 | 서울 | 5개 | 경복궁, N서울타워, 명동, 북촌 한옥마을, 광화문 광장 |
| 🇺🇸 미국 | 뉴욕 | 5개 | 자유의 여신상, 타임스퀘어, 센트럴 파크, 브루클린 브릿지, 엠파이어 스테이트 빌딩 |

**총 20개 인기 여행지**

---

## 🚀 실행 방법

### 1️⃣ AWS RDS 접속

```bash
# 방법 1: psql 직접 접속
psql -h [AWS_RDS_ENDPOINT] -U [USERNAME] -d [DATABASE_NAME]

# 예시
psql -h triplan-db.abc123.ap-northeast-2.rds.amazonaws.com -U triplan_admin -d triplan_db
```

```bash
# 방법 2: Docker 컨테이너에서 접속
docker exec -it triplan-backend bash
psql -h [AWS_RDS_ENDPOINT] -U [USERNAME] -d [DATABASE_NAME]
```

---

### 2️⃣ SQL 파일 실행

#### **방법 A: psql 내부에서 실행**

```sql
-- psql에 접속한 상태에서
\i /home/playdata/SKN15-FINAL-2TEAM/insert_demo_places.sql
```

#### **방법 B: 로컬에서 직접 실행**

```bash
psql -h [AWS_RDS_ENDPOINT] -U [USERNAME] -d [DATABASE_NAME] -f insert_demo_places.sql
```

#### **방법 C: Docker 컨테이너를 통해 실행**

```bash
docker exec -i triplan-backend psql -h [AWS_RDS_ENDPOINT] -U [USERNAME] -d [DATABASE_NAME] < insert_demo_places.sql
```

---

### 3️⃣ 실행 결과 확인

SQL 실행 후 자동으로 다음 결과가 출력됩니다:

```
총 삽입 결과:
 total_places | countries | cities
--------------+-----------+--------
           20 |         4 |      4

국가별 통계:
 country_name | iso2 | place_count
--------------+------+-------------
 일본         | JP   |           5
 프랑스       | FR   |           5
 대한민국     | KR   |           5
 미국         | US   |           5

최근 삽입된 여행지:
 place_idx | ko_name | name | country_name | rating | user_ratings_total
-----------+---------+------+--------------+--------+-------------------
 ...
```

---

## 🔍 데이터 검증

### 삽입된 데이터 확인

```sql
-- 전체 여행지 수
SELECT COUNT(*) FROM place_places;

-- 국가별 여행지 수
SELECT
    c.country_name,
    COUNT(p.place_idx) as place_count
FROM place_places p
JOIN common_country c ON p.country_idx = c.country_idx
GROUP BY c.country_name;

-- 도쿄 여행지 목록
SELECT
    ko_name,
    name,
    rating,
    user_ratings_total
FROM place_places p
JOIN common_region1 r ON p.region1_idx = r.region1_idx
WHERE r.city_name LIKE '%도쿄%' OR r.city_name LIKE '%Tokyo%'
ORDER BY rating DESC;

-- 평점 높은 순 상위 10개
SELECT
    ko_name,
    name,
    rating,
    user_ratings_total
FROM place_places
WHERE rating IS NOT NULL
ORDER BY rating DESC, user_ratings_total DESC
LIMIT 10;
```

---

## ⚠️ 주의사항

### 1. **사전 조건 확인**

이 SQL이 정상 작동하려면 다음 테이블에 데이터가 있어야 합니다:

```sql
-- 필수 테이블 데이터 확인
SELECT COUNT(*) FROM common_country WHERE iso2 IN ('JP', 'FR', 'KR', 'US');
-- 결과: 4 (4개국 모두 있어야 함)

SELECT COUNT(*) FROM common_region1;
-- 결과: 1개 이상 (도쿄, 파리, 서울, 뉴욕 등)
```

만약 `common_country`나 `common_region1` 테이블이 비어있다면 먼저 해당 데이터를 삽입해야 합니다.

---

### 2. **중복 실행 시**

```sql
-- place_id가 unique이므로 중복 실행하면 오류 발생
ERROR:  duplicate key value violates unique constraint "place_places_place_id_key"
```

**해결 방법:**

```sql
-- 기존 테스트 데이터 삭제 후 재실행
DELETE FROM place_places
WHERE place_id IN (
    'ChIJ51cu8IcbXWARiRtXIothAS4',
    'ChIJ8T1GpMGOGGARDYGSgpooDWw',
    -- ... 기타 place_id
);
```

또는 SQL 파일에 `ON CONFLICT` 절 추가:

```sql
INSERT INTO place_places (...)
VALUES (...)
ON CONFLICT (place_id) DO NOTHING;
```

---

## 🧪 API로 데이터 확인

### Django API 테스트

```bash
# 1. 토큰 발급
TOKEN=$(curl -s -X POST http://localhost:8000/api/accounts/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test1234"}' \
  | jq -r '.access')

# 2. 여행지 목록 조회
curl -X GET "http://localhost:8000/api/places/places/?limit=10" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.'

# 3. 특정 국가 여행지 조회
curl -X GET "http://localhost:8000/api/places/places/?country=JP&limit=10" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.'
```

---

## 📊 발표 시연 시나리오

### 1. **챗봇에서 여행지 추천 요청**

```
사용자: "도쿄에서 가볼만한 곳 추천해줘"

챗봇 응답:
1. 도쿨 스카이트리 (★4.5) - 125,430개 리뷰
2. 센소지 (★4.6) - 98,234개 리뷰
3. 메이지 신궁 (★4.5) - 87,543개 리뷰
...
```

### 2. **플래너에 여행지 추가**

```javascript
// 챗봇 추천 → 플래너 추가 버튼 클릭
POST /api/plans/items/
{
  "day_idx": 1,
  "place_idx": 1,  // 도쿄 스카이트리
  "sequence": 1
}
```

### 3. **실시간 협업**

```
사용자 A가 "센소지" 추가
  ↓ (WebSocket 브로드캐스트)
사용자 B, C의 화면에 즉시 반영!
```

---

## 🔧 트러블슈팅

### 문제 1: `common_country` 테이블에 국가 데이터 없음

```sql
-- 국가 데이터 수동 삽입
INSERT INTO common_country (country_code, iso2, country_name, name_local)
VALUES
(392, 'JP', '일본', '日本'),
(250, 'FR', '프랑스', 'France'),
(410, 'KR', '대한민국', '대한민국'),
(840, 'US', '미국', 'United States');
```

### 문제 2: `common_region1` 테이블에 도시 데이터 없음

```sql
-- 도시 데이터 수동 삽입
INSERT INTO common_region1 (country_code, city_code, city_name)
VALUES
((SELECT country_idx FROM common_country WHERE iso2='JP'), 13, '도쿄'),
((SELECT country_idx FROM common_country WHERE iso2='FR'), 11, '파리'),
((SELECT country_idx FROM common_country WHERE iso2='KR'), 11, '서울'),
((SELECT country_idx FROM common_country WHERE iso2='US'), 36, '뉴욕');
```

### 문제 3: 권한 오류

```
ERROR: permission denied for table place_places
```

**해결:**

```sql
-- 권한 부여 (PostgreSQL 관리자 계정으로)
GRANT ALL PRIVILEGES ON TABLE place_places TO triplan_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO triplan_admin;
```

---

## 📝 추가 데이터 삽입

더 많은 여행지를 추가하고 싶다면:

```sql
-- 예시: 오사카 도톤보리 추가
INSERT INTO place_places (
    place_id, name, ko_name, country_idx, region1_idx,
    types, address, latitude, longitude,
    rating, user_ratings_total,
    created_at, updated_at
) VALUES (
    'ChIJ...',
    'Dotonbori',
    '도톤보리',
    (SELECT country_idx FROM common_country WHERE iso2 = 'JP'),
    (SELECT region1_idx FROM common_region1 WHERE city_name LIKE '%오사카%'),
    'tourist_attraction',
    '大阪府大阪市中央区道頓堀',
    34.6686885,
    135.5004324,
    4.3,
    45678,
    NOW(),
    NOW()
);
```

---

## ✅ 체크리스트

발표 전 확인 사항:

- [ ] AWS RDS 접속 가능
- [ ] `common_country` 테이블에 4개국 데이터 존재
- [ ] `common_region1` 테이블에 도시 데이터 존재
- [ ] SQL 파일 실행 성공
- [ ] 20개 여행지 모두 삽입 확인
- [ ] API로 데이터 조회 테스트 완료
- [ ] 챗봇에서 여행지 검색 테스트 완료

---

## 📞 문의

문제 발생 시:
1. 먼저 위 "트러블슈팅" 섹션 확인
2. SQL 에러 메시지 복사
3. 테이블 스키마 확인: `\d place_places`

**Good Luck with your presentation! 🚀**
