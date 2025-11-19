# STT Model Setup Guide

이 디렉토리에 자체 학습한 STT (Speech-to-Text) 모델을 배치하세요.

## 필요한 파일

```
models/stt/
├── model.safetensors      # 모델 가중치 (필수)
├── config.json            # 모델 설정 (필수)
├── tokenizer_config.json  # 토크나이저 설정
├── special_tokens_map.json
├── vocab.json
└── README.md             # 이 파일
```

## 모델 배치 방법

### 1. HuggingFace 모델인 경우:

```bash
# 모델을 저장한 디렉토리에서
cp model.safetensors config.json tokenizer*.json vocab.json ./models/stt/
```

### 2. 직접 학습한 모델인 경우:

```python
from transformers import AutoModelForSpeechSeq2Seq

# 모델 저장
model.save_pretrained("./models/stt", safe_serialization=True)
```

## 지원하는 모델 타입

- **Whisper** (openai/whisper-*, distil-whisper/*)
- **Wav2Vec2** (facebook/wav2vec2-*)
- **HuBERT** (facebook/hubert-*)
- 기타 HuggingFace Transformers 호환 STT 모델

## 권장 모델

### 한국어 특화:
- `openai/whisper-large-v3` (정확도 높음, 큼)
- `openai/whisper-medium` (균형)
- `openai/whisper-small` (빠름)
- `distil-whisper/distil-large-v3` (빠르고 정확)

### 다국어 지원:
- Whisper 시리즈 모두 한국어 포함 96개 언어 지원

## 환경 설정

`.env` 파일에 모델 경로 지정:

```bash
STT_MODEL_PATH=./models/stt/model.safetensors
```

## 테스트

모델 배치 후 테스트:

```bash
# 백엔드 재시작
docker-compose restart backend

# STT Health Check
curl -X GET http://localhost:8000/api/chat/stt/health/ \
  -H "Authorization: Bearer YOUR_TOKEN"

# 응답 예시:
{
  "status": "ready",
  "device": "cuda",  # 또는 "cpu"
  "model_path": "./models/stt/model.safetensors",
  "success": true
}
```

## 사용 예시

### API로 음성 인식:

```bash
curl -X POST http://localhost:8000/api/chat/stt/transcribe/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "audio=@recording.wav"

# 응답:
{
  "text": "인식된 텍스트입니다",
  "success": true
}
```

### 프론트엔드에서 사용:

채팅 위젯에서 마이크 버튼 클릭 → 자동으로 STT API 호출

## 성능 최적화

### GPU 사용:
- CUDA 사용 가능 시 자동으로 GPU 사용
- `device: "cuda"` 확인

### CPU 사용 시:
- 모델 크기 줄이기 (whisper-small, distil-whisper)
- `torch_dtype=torch.float32` 사용

### 메모리 절약:
- `low_cpu_mem_usage=True` 활성화됨
- 모델을 fp16으로 로드 (GPU 사용 시)

## 트러블슈팅

### 모델을 찾을 수 없음:
```
FileNotFoundError: [Errno 2] No such file or directory: './models/stt/config.json'
```

→ `config.json`, `model.safetensors` 파일이 모두 있는지 확인

### CUDA out of memory:
```
RuntimeError: CUDA out of memory
```

→ 더 작은 모델 사용 (whisper-small) 또는 CPU 모드로 전환

### 음성인식 실패:
- 오디오 형식 확인 (WAV, MP3, OGG, WEBM 지원)
- 샘플링 레이트 확인 (16kHz 권장)
- 파일 크기 확인 (10MB 제한)

## 참고 자료

- [HuggingFace Transformers](https://huggingface.co/docs/transformers)
- [Whisper Model Card](https://huggingface.co/openai/whisper-large-v3)
- [STT API 문서](../../apps/chat/views_stt.py)
