# 🎤 음성 인식(STT) 시스템 아키텍처

## 📋 전체 아키텍처 개요

```
[사용자] → [브라우저] → [프론트엔드] → [백엔드 API] → [Whisper AI 모델] → [한국어 텍스트]
```

---

## 🔄 전체 작동 흐름 (단계별)

### 1단계: 사용자가 마이크 버튼 클릭 🖱️

**위치**: `frontend/src/components/planner/UnifiedChatWidget.tsx`

사용자가 채팅창에서 마이크 버튼(🎤)을 클릭하면:

```typescript
// useVoiceRecognitionLocal 훅 사용
const { isListening, startListening, stopListening, transcript } =
  useVoiceRecognitionLocal({
    onResult: (text) => {
      setInputValue(text); // 인식된 텍스트를 입력창에 자동 입력
    }
  });
```

---

### 2단계: 브라우저가 마이크 권한 요청 🎙️

**위치**: `frontend/src/hooks/useAudioRecorder.ts:34-42`

```typescript
// 마이크 권한 요청
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    channelCount: 1,      // 모노 (스테레오 아님)
    sampleRate: 16000,    // 16kHz (Whisper 모델 최적 주파수)
    echoCancellation: true,     // 에코 제거
    noiseSuppression: true,     // 노이즈 제거
    autoGainControl: true,      // 자동 볼륨 조절
  }
});
```

**이 설정이 중요한 이유:**
- **16kHz 샘플레이트**: Whisper 모델은 16kHz 오디오에 최적화됨
- **모노 채널**: 음성 인식에는 스테레오가 필요 없음 (파일 크기 절약)
- **노이즈 제거**: 배경 소음을 줄여서 인식률 향상

---

### 3단계: MediaRecorder로 음성 녹음 🔴

**위치**: `frontend/src/hooks/useAudioRecorder.ts:48-79`

```typescript
// MediaRecorder 생성 (브라우저 내장 API)
const mediaRecorder = new MediaRecorder(stream, {
  mimeType: 'audio/webm'  // WebM 형식 (Opus 코덱)
});

// 100ms마다 오디오 데이터 수집
mediaRecorder.start(100);

// 데이터 청크 수집
mediaRecorder.ondataavailable = (event) => {
  audioChunksRef.current.push(event.data);
};
```

**실시간 타이머 표시:**
```typescript
// 1초마다 녹음 시간 업데이트
timerRef.current = setInterval(() => {
  setRecordingTime(prev => prev + 1); // 0초 → 1초 → 2초...
}, 1000);
```

화면에 "🎤 녹음 중... 3초" 같은 UI가 표시됩니다.

---

### 4단계: 사용자가 녹음 중지 ⏹️

사용자가 다시 마이크 버튼을 누르면:

```typescript
// 녹음 중지
mediaRecorder.stop();

// onstop 이벤트가 자동 발생
mediaRecorder.onstop = () => {
  // 모든 청크를 하나의 Blob으로 합침
  const audioBlob = new Blob(audioChunksRef.current, {
    type: 'audio/webm'
  });

  // 콜백 실행 → STT API 전송
  onRecordingComplete(audioBlob);
};
```

**Blob이란?**
- Binary Large Object (바이너리 데이터 덩어리)
- 녹음된 오디오 파일 자체 (메모리에만 존재)

---

### 5단계: FormData로 오디오 파일 전송 준비 📦

**위치**: `frontend/src/hooks/useVoiceRecognitionLocal.ts:43-59`

```typescript
const formData = new FormData();
formData.append('audio', audioBlob, 'recording.webm');

// STT API로 전송
const response = await fetch(`${apiUrl}/api/chat/stt/transcribe/`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,  // JWT 토큰
  },
  body: formData,  // multipart/form-data
});
```

**왜 FormData를 사용하나?**
- 파일 업로드는 `multipart/form-data` 형식이 필요
- JSON으로는 바이너리 데이터를 보낼 수 없음

---

### 6단계: Django 백엔드가 요청 받음 🐍

**위치**: `backend/apps/chat/views_stt.py:22-43`

```python
@api_view(['POST'])
@permission_classes([IsAuthenticated])  # JWT 토큰 검증
def transcribe_audio(request):
    # 1. 파일 확인
    if 'audio' not in request.FILES:
        return Response({'error': '오디오 파일이 필요합니다.'})

    audio_file = request.FILES['audio']

    # 2. 파일 크기 제한 (10MB)
    if audio_file.size > 10 * 1024 * 1024:
        return Response({'error': '파일이 너무 큽니다.'})
```

---

### 7단계: 임시 파일로 저장 💾

**위치**: `backend/apps/chat/views_stt.py:57-63`

```python
# 임시 파일 생성 (Whisper 모델이 파일 경로를 요구함)
with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as temp_file:
    # 업로드된 파일을 임시 위치에 저장
    for chunk in audio_file.chunks():
        temp_file.write(chunk)

    temp_file_path = temp_file.name  # /tmp/tmpXXXXXX.webm
```

**왜 임시 파일이 필요한가?**
- Whisper pipeline은 파일 경로(str)를 입력으로 받음
- 메모리의 바이트 데이터를 직접 처리할 수 없음
- ffmpeg가 파일을 읽어야 함

---

### 8단계: Whisper AI 모델 로드 🤖

**위치**: `backend/apps/chat/stt.py:39-91`

#### 8-1. 싱글톤 패턴으로 모델 재사용

```python
# 최초 1회만 모델 로드 (메모리 절약)
_stt_instance = None

def get_stt():
    global _stt_instance
    if _stt_instance is None:
        _stt_instance = LocalSTT()  # 모델 로드 (10초 소요)
    return _stt_instance  # 이후에는 즉시 반환
```

#### 8-2. 모델 구성 요소 로드

```python
# 1️⃣ Processor (Tokenizer) - HuggingFace에서 다운로드
self.processor = AutoProcessor.from_pretrained(
    "openai/whisper-small",
    language="Korean",  # 한국어 설정
    task="transcribe"
)

# 2️⃣ Model (가중치) - 로컬 파인튜닝 모델 사용
self.model = AutoModelForSpeechSeq2Seq.from_pretrained(
    "./models/stt/",  # model.safetensors
    use_safetensors=True
)
```

**왜 Processor는 HuggingFace, Model은 로컬?**
- **Processor**: 토크나이저는 파인튜닝해도 안 바뀜 (기본 어휘 사전 사용)
- **Model**: 가중치만 바뀜 (한국어 음성 인식 능력 향상)

#### 8-3. Pipeline 생성 (한국어 강제)

```python
self.pipe = pipeline(
    "automatic-speech-recognition",
    model=self.model,
    tokenizer=self.processor.tokenizer,
    feature_extractor=self.processor.feature_extractor,
    device="cpu",  # GPU 없으면 CPU
    generate_kwargs={
        "language": "korean",  # ⭐ 한국어 강제!
        "task": "transcribe"   # 번역 아닌 전사
    }
)
```

**⚠️ 중요: `language="korean"` 설정**
- 이게 없으면 영어로 인식됨!
- Whisper는 다국어 모델이라 언어 명시 필요

---

### 9단계: ffmpeg로 오디오 전처리 🎵

**위치**: Pipeline 내부 (자동 실행)

```bash
# Pipeline이 내부적으로 실행하는 ffmpeg 명령어
ffmpeg -i /tmp/tmpXXXXXX.webm -ar 16000 -ac 1 -f wav -
```

**ffmpeg가 하는 일:**
1. WebM 파일을 WAV로 변환
2. 샘플레이트를 16kHz로 변환
3. 스테레오를 모노로 변환
4. Whisper가 처리할 수 있는 형태로 변환

**왜 ffmpeg가 필수인가?**
- Whisper는 WAV 형식의 16kHz 모노 오디오가 필요
- 브라우저는 WebM으로 녹음함 → 변환 필수

---

### 10단계: Whisper 모델이 음성 인식 🧠

**위치**: `backend/apps/chat/stt.py:121-138`

```python
# Pipeline 실행 (자동으로 전처리 + 모델 추론)
result = self.pipe(audio_file_path)

# 결과 예시:
# {
#   "text": "안녕하세요 오늘 날씨가 좋네요"
# }

transcription = result["text"].strip()
```

**내부 동작 순서:**
1. **ffmpeg**: WebM → WAV (16kHz mono)
2. **Feature Extractor**: 오디오 → Mel Spectrogram (주파수 그래프)
3. **Encoder**: Spectrogram → 음성 특징 벡터
4. **Decoder**: 특징 벡터 → 한국어 텍스트
5. **Tokenizer**: 토큰 → 문자열

---

### 11단계: JSON 응답 반환 📤

**위치**: `backend/apps/chat/views_stt.py:72-75`

```python
return Response({
    'text': "안녕하세요 오늘 날씨가 좋네요",
    'success': True
}, status=200)
```

---

### 12단계: 프론트엔드가 결과 처리 ✅

**위치**: `frontend/src/hooks/useVoiceRecognitionLocal.ts:65-73`

```typescript
const data = await response.json();

if (data.success && data.text) {
  console.log('✅ Transcription:', data.text);
  setTranscript(data.text);

  // 콜백 실행
  if (onResult) {
    onResult(data.text); // 채팅 입력창에 텍스트 입력
  }
}
```

---

### 13단계: 채팅 입력창에 자동 입력 💬

**위치**: `UnifiedChatWidget.tsx`

```typescript
const { transcript } = useVoiceRecognitionLocal({
  onResult: (text) => {
    setInputValue(text); // "안녕하세요 오늘 날씨가 좋네요"
  }
});
```

사용자가 Enter 키를 누르면 채팅 메시지로 전송됩니다!

---

## 🎯 핵심 기술 요약

| 단계 | 기술 | 역할 |
|------|------|------|
| 1 | **MediaRecorder API** | 브라우저에서 마이크 녹음 |
| 2 | **Blob** | 녹음된 오디오를 메모리에 저장 |
| 3 | **FormData** | 오디오 파일을 HTTP로 전송 |
| 4 | **Django REST Framework** | 파일 업로드 처리 |
| 5 | **tempfile** | 임시 파일 생성 |
| 6 | **ffmpeg** | WebM → WAV 변환 (16kHz mono) |
| 7 | **Whisper Small** | AI 음성 인식 (파인튜닝됨) |
| 8 | **HuggingFace Transformers** | 모델 로드 및 추론 |
| 9 | **Pipeline** | 전체 STT 과정 자동화 |

---

## 🔍 주요 파일 역할

### 프론트엔드

1. **`frontend/src/hooks/useAudioRecorder.ts`** (175줄)
   - MediaRecorder API로 마이크 녹음
   - 브라우저 호환성 확인
   - 권한 요청 처리
   - 실시간 타이머 표시

2. **`frontend/src/hooks/useVoiceRecognitionLocal.ts`** (129줄)
   - 녹음된 오디오를 STT API로 전송
   - JWT 토큰 인증
   - 결과 콜백 처리

3. **`frontend/src/components/planner/UnifiedChatWidget.tsx`**
   - 마이크 버튼 UI
   - 인식된 텍스트를 입력창에 표시
   - 채팅 메시지 전송

### 백엔드

1. **`backend/apps/chat/views_stt.py`** (123줄)
   - `/api/chat/stt/transcribe/` 엔드포인트 (POST)
   - `/api/chat/stt/health/` 엔드포인트 (GET)
   - 파일 업로드 처리 (multipart/form-data)
   - 임시 파일 관리 (자동 삭제)
   - 파일 크기 제한 (10MB)

2. **`backend/apps/chat/stt.py`** (166줄)
   - Whisper 모델 로드 (싱글톤 패턴)
   - Pipeline 생성 (한국어 강제)
   - 오디오 → 텍스트 변환
   - 파인튜닝된 모델 가중치 사용

3. **`backend/apps/chat/urls.py`**
   ```python
   path('stt/transcribe/', transcribe_audio, name='stt-transcribe'),
   path('stt/health/', stt_health, name='stt-health'),
   ```

4. **`backend/Dockerfile`**
   ```dockerfile
   RUN apt-get install -y ffmpeg  # 필수!
   ```

---

## ⚙️ 설정 파일 요약

### 프론트엔드 오디오 설정
```typescript
{
  channelCount: 1,           // 모노
  sampleRate: 16000,         // 16kHz
  echoCancellation: true,    // 에코 제거
  noiseSuppression: true,    // 노이즈 제거
  autoGainControl: true      // 자동 볼륨
}
```

### 백엔드 Whisper 설정
```python
{
  "language": "korean",      # ⭐ 한국어 강제
  "task": "transcribe",      # 번역 아님
  "max_new_tokens": 128,     # 최대 토큰 수
  "chunk_length_s": 30,      # 30초 단위 처리
  "batch_size": 16           # 배치 크기
}
```

---

## 🐛 문제 해결 히스토리

| 문제 | 원인 | 해결 |
|------|------|------|
| ❌ 404 에러 | URL 라우팅 누락 | `urls.py`에 STT 경로 추가 |
| ❌ 500 - accelerate 없음 | 패키지 누락 | `requirements.txt`에 accelerate 추가 |
| ❌ 500 - 토크나이저 없음 | 로컬 파일에 토크나이저 없음 | HuggingFace에서 processor 다운로드 |
| ❌ 500 - ffmpeg 없음 | Dockerfile에 ffmpeg 없음 | `apt-get install ffmpeg` 추가 |
| ❌ **영어로 인식됨** | Pipeline에 언어 미지정 | `generate_kwargs`에 `language="korean"` 추가 |

---

## 💡 성능 최적화 포인트

1. **싱글톤 패턴**: 모델을 1번만 로드 (최초 10초, 이후 0초)
2. **16kHz 녹음**: Whisper 최적 주파수 (재샘플링 불필요)
3. **모노 채널**: 파일 크기 50% 감소
4. **임시 파일 자동 삭제**: 메모리 누수 방지
5. **청크 단위 처리**: 30초 단위로 나눠서 처리 (긴 음성도 처리 가능)

---

## 📊 데이터 흐름 다이어그램

```
[사용자 음성]
    ↓
[MediaRecorder] → Blob (audio/webm)
    ↓
[FormData] → HTTP POST
    ↓
[Django View] → 임시 파일 저장
    ↓
[Whisper Pipeline]
    ↓
    ├─ [ffmpeg] → WAV 변환 (16kHz mono)
    ├─ [Feature Extractor] → Mel Spectrogram
    ├─ [Encoder] → 음성 특징 벡터
    ├─ [Decoder] → 한국어 토큰
    └─ [Tokenizer] → 텍스트
    ↓
[JSON Response] → {"text": "...", "success": true}
    ↓
[React State] → setInputValue(text)
    ↓
[채팅 입력창]
```

---

## 🔒 보안 고려사항

1. **JWT 인증**: 모든 STT API 요청에 Bearer 토큰 필요
2. **파일 크기 제한**: 10MB 이상 업로드 차단
3. **임시 파일 자동 삭제**: 처리 후 즉시 삭제로 개인정보 보호
4. **마이크 권한**: 브라우저에서 사용자 동의 필수

---

## 🚀 사용 방법

### API 테스트

```bash
# 1. 로그인해서 토큰 받기
curl -X POST http://localhost:8000/api/accounts/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test1234"}'

# 2. Health Check
curl -X GET http://localhost:8000/api/chat/stt/health/ \
  -H "Authorization: Bearer <access_token>"

# 응답:
# {
#   "status": "ready",
#   "device": "cpu",
#   "model_path": "models/stt/model.safetensors",
#   "success": true
# }

# 3. 음성 인식
curl -X POST http://localhost:8000/api/chat/stt/transcribe/ \
  -H "Authorization: Bearer <access_token>" \
  -F "audio=@recording.webm"

# 응답:
# {
#   "text": "안녕하세요 오늘 날씨가 좋네요",
#   "success": true
# }
```

---

## 📦 필요한 패키지

### 프론트엔드
- React 18.2.0
- TypeScript 5.3.3
- Next.js 14.1.0

### 백엔드
- Django 4.2+
- djangorestframework
- PyTorch 2.1.2
- transformers (HuggingFace)
- accelerate 0.25.0
- safetensors 0.4.1
- ffmpeg (시스템 패키지)

---

## 🎓 학습 리소스

1. **MediaRecorder API**: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
2. **Whisper Model**: https://github.com/openai/whisper
3. **HuggingFace Transformers**: https://huggingface.co/docs/transformers
4. **ffmpeg**: https://ffmpeg.org/documentation.html

---

## 📝 TODO

- [ ] GPU 지원 추가 (CUDA)
- [ ] 실시간 스트리밍 STT (WebSocket)
- [ ] 긴 음성 파일 분할 처리
- [ ] 화자 분리 (Diarization)
- [ ] 감정 분석 추가

---

**작성일**: 2025-11-05
**버전**: 1.0.0
**작성자**: Claude Code
