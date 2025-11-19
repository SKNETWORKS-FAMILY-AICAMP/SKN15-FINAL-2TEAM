# RAG Auto-Add to Planner Implementation

## 🎯 Overview

사용자가 "여행 일정 추천해줘", "코스 짜줘" 같은 요청을 하면, RAG로 실제 여행 데이터를 검색하고, LLM으로 정제한 후, 플래너에 자동으로 추가하는 통합 기능을 구현했습니다.

**가장 중요한 기능!** 사용자 요청대로 구현 완료.

## 🚀 Workflow

```
사용자 요청
    ↓
1. RAG 검색 (실제 여행 블로그/영상 데이터)
    ↓
2. LLM 정제 (현재 플래너에 맞게 최적화)
    ↓
3. Kakao API 검증 (장소명, 주소 확인)
    ↓
4. 플래너 자동 추가 (중복 확인)
    ↓
5. 사용자에게 결과 알림
```

## 📁 Modified Files

### 1. `/backend/apps/chat/agent.py`

#### Added Tool: `recommend_and_add_to_planner()`

**위치**: Line 1184-1423

**기능**:
- RAG로 유사 여행 검색
- LLM으로 결과 정제 (현재 플래너 일수에 맞게)
- 중복 확인 후 자동 추가
- Kakao API로 장소 검증

**주요 파라미터**:
- `query`: 검색 쿼리 (예: "서울 맛집", "제주도 자연")
- `auto_add`: True이면 자동 추가, False면 추천만
- `top_k`: RAG 검색 결과 수 (기본값: 3)

**핵심 로직**:

```python
# Step 1: 현재 플래너 정보 가져오기
trip = TripPlan.objects.get(trip_idx=trip_id)
days = TripDay.objects.filter(trip_idx=trip_id).order_by('day_no')

# Step 2: RAG 검색
rag = get_rag()
rag_results = rag.search_similar_trips(query=query, limit=top_k)

# Step 3: LLM 정제
refinement_prompt = f"""
현재 플래너: {total_days}일
RAG 결과: {rag_summary}

임무: 위 RAG 결과를 현재 플래너에 맞게 정제하세요.
출력: JSON (day_1: [{place, time, reason}], ...)
"""
refined_plan = json.loads(llm_response.content)

# Step 4: 자동 추가
for day_key, places in refined_plan.items():
    for place_info in places:
        # 중복 확인
        # Kakao API 검증
        # TripItem 생성
```

**반환 예시**:
```
✅ '서울 맛집' 추천 결과를 플래너에 추가했습니다! (총 8개 장소)

**Day 1**: 09:00 경복궁, 12:00 광장시장, 15:00 북촌한옥마을
**Day 2**: 09:00 남산타워, 12:00 명동 칼국수, 15:00 이태원

📊 RAG 검색: 3개 여행 분석
🤖 LLM 정제: 2일 일정에 최적화
💾 자동 추가: 8개 장소 추가 완료
```

### 2. `/backend/apps/chat/prompts/v1.py`

#### Updated System Prompt

**위치**: Line 74-83, 110-119

**변경 내용**:

```python
✨ AI 추천 (RAG - 실제 여행 데이터 기반):
- recommend_and_add_to_planner: 🚀 RAG + LLM + 자동 추가 통합 도구 (최우선 사용!)
  * 사용자가 "여행 일정 추천해줘", "코스 짜줘", "일정 채워줘" 등 요청 시 이 도구를 사용하세요!
  * 자동으로: RAG 검색 → LLM 정제 → 플래너에 자동 추가
  * 실제 여행 데이터를 현재 플래너에 맞게 최적화하여 추가
  * 중복 확인, 시간 배치, 장소 검증까지 자동으로 처리

사용자 요청 처리 가이드:
- "여행 일정 추천해줘", "코스 짜줘", "일정 채워줘", "여행지 추가해줘" 같은 요청:
  1. 먼저 get_planner_info로 현재 여행 정보를 확인
  2. **recommend_and_add_to_planner**를 사용! (RAG → LLM 정제 → 자동 추가)
  3. 이 도구가 모든 것을 자동으로 처리합니다
```

### 3. `/backend/apps/chat/prompts/tool_descriptions.py`

**위치**: Line 84-101

**추가된 설명**:
```python
RECOMMEND_AND_ADD_TO_PLANNER = """🚀 RAG 추천 결과를 플래너에 자동으로 추가합니다. (통합 도구)

⭐⭐⭐ 가장 강력한 도구! 사용자가 "여행 일정 추천해줘", "코스 짜줘", "일정 채워줘" 등 요청 시 사용!

이 도구는 자동으로:
1. RAG로 실제 여행 데이터 검색 (유사한 여행 경로 찾기)
2. LLM으로 결과 정제 및 최적화 (현재 플래너에 맞게 조정)
3. 플래너에 Day별로 장소 자동 추가 (중복 확인)
4. 사용자에게 추가된 일정 안내
"""
```

## 🔍 Key Features

### 1. 중복 확인
```python
existing = TripItem.objects.filter(
    day_idx=day.day_idx,
    title__icontains=place_name
).exists()

if existing:
    logger.info(f"⏭️ Skipping duplicate: {place_name}")
    continue
```

### 2. Kakao API 검증
```python
url = "https://dapi.kakao.com/v2/local/search/keyword.json"
response = requests.get(url, headers=headers, params=params)

if data.get('documents'):
    verified_name = place_data['place_name']
    place_info_kakao = {
        'address': place_data.get('road_address_name'),
        'latitude': float(place_data.get('y')),
        'longitude': float(place_data.get('x')),
    }
```

### 3. LLM 정제 프롬프트
- 현재 플래너 일수에 맞게 장소 배분
- 각 Day당 3-5개 장소
- 시간은 오전 9시부터 2-3시간 간격
- 중복 제거
- JSON 형식 출력

### 4. auto_add 옵션
- `auto_add=True` (기본값): RAG → LLM → 자동 추가
- `auto_add=False`: 추천만 제공 (추가하지 않음)

## 🧪 Testing

### Test Scenario 1: 서울 2박3일 맛집 투어

```
사용자: "서울 맛집으로 일정 채워줘"
    ↓
Agent: recommend_and_add_to_planner(query="서울 맛집", auto_add=True, top_k=3)
    ↓
RAG: 3개의 유사한 서울 맛집 여행 검색
    ↓
LLM: 현재 플래너 (3일)에 맞게 정제
    ↓
결과: Day 1~3에 각 3-5개씩 맛집 자동 추가
```

### Test Scenario 2: 추천만 보기

```
사용자: "제주도 자연 여행 추천만 해줘"
    ↓
Agent: recommend_and_add_to_planner(query="제주도 자연", auto_add=False)
    ↓
결과: 추천 리스트만 제공 (추가하지 않음)
```

## 📊 Dependencies

### External APIs:
- Kakao REST API (장소 검증)
- OpenAI GPT-4 (LLM 정제)

### Database Models:
- `TripPlan`: 여행 정보
- `TripDay`: 일자별 정보
- `TripItem`: 일정 아이템
- `Place`: 장소 마스터

### RAG System:
- `apps.ai.rag.TripRAG.search_similar_trips()`
- Vector similarity search with pgvector

## 🎉 Implementation Status

✅ **Completed**:
- [x] `recommend_and_add_to_planner` 도구 구현
- [x] RAG 검색 통합
- [x] LLM 정제 로직
- [x] Kakao API 검증
- [x] 중복 확인 로직
- [x] 자동 추가 로직
- [x] System prompt 업데이트
- [x] Tool description 추가
- [x] Backend/Websocket 재시작

⏳ **Pending**:
- [ ] 실제 사용자 테스트
- [ ] 프론트엔드 UI 확인
- [ ] 에러 핸들링 강화 (필요 시)

## 💡 Usage Examples

### Agent가 자동으로 선택하는 경우:

| 사용자 요청 | Agent가 사용할 도구 |
|-----------|------------------|
| "여행 일정 추천해줘" | `recommend_and_add_to_planner` |
| "코스 짜줘" | `recommend_and_add_to_planner` |
| "일정 채워줘" | `recommend_and_add_to_planner` |
| "서울 맛집으로 일정 만들어줘" | `recommend_and_add_to_planner(query="서울 맛집")` |
| "추천만 해줘 (추가는 안 함)" | `recommend_and_add_to_planner(auto_add=False)` |
| "여행지 추천" | `recommend_similar_trips` (추가 안 함) |

## 📝 Notes

1. **LLM 정제가 핵심**: RAG 결과를 그대로 추가하지 않고, LLM으로 현재 플래너에 맞게 최적화
2. **중복 확인 필수**: 이미 있는 장소는 자동으로 스킵
3. **Kakao API 검증**: 장소명이 정확한지 확인하고 주소/좌표 자동 추가
4. **유연한 옵션**: `auto_add=False`로 추천만 받을 수도 있음
5. **로깅 강화**: 모든 단계에서 상세 로그 출력

## 🔗 Related Files

- [agent.py](../agent.py) - 메인 Agent 로직
- [v1.py](./v1.py) - System prompt v1
- [tool_descriptions.py](./tool_descriptions.py) - 도구 설명 모음
- [/backend/apps/ai/rag.py](../../ai/rag.py) - RAG 시스템

---

**Implementation Date**: 2025-01-13
**Version**: 1.0
**Status**: ✅ Complete and Ready for Testing
