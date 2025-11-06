"""
Local STT (Speech-to-Text) Model Integration
자체 학습한 STT 모델을 사용한 음성인식
"""

import torch
import logging
from pathlib import Path
from typing import Optional
import numpy as np

logger = logging.getLogger(__name__)


class LocalSTT:
    """
    로컬 STT 모델을 사용한 음성 → 텍스트 변환

    model.safetensors 파일을 로드하여 음성인식 수행
    """

    def __init__(self, model_path: str = "./models/stt/model.safetensors"):
        """
        STT 모델 초기화

        Args:
            model_path: model.safetensors 파일 경로
        """
        self.model_path = Path(model_path)
        self.model = None
        self.processor = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"

        logger.info(f"🎤 Initializing Local STT model from {model_path}")
        logger.info(f"🖥️  Using device: {self.device}")

        self._load_model()

    def _load_model(self):
        """모델 로드"""
        try:
            # HuggingFace Transformers 사용 (가장 일반적)
            from transformers import (
                AutoModelForSpeechSeq2Seq,
                AutoProcessor,
                pipeline
            )

            model_dir = self.model_path.parent

            # 파인튜닝된 모델 경로
            logger.info(f"📦 Loading fine-tuned model from {model_dir}")

            # Tokenizer는 base model에서 로드 (파인튜닝 시 변경되지 않음)
            base_model = "openai/whisper-small"
            logger.info(f"📥 Loading processor from {base_model}")
            self.processor = AutoProcessor.from_pretrained(
                base_model,
                language="Korean",
                task="transcribe"
            )

            # 파인튜닝된 모델 가중치 로드
            logger.info(f"📦 Loading fine-tuned weights from {model_dir}")
            self.model = AutoModelForSpeechSeq2Seq.from_pretrained(
                str(model_dir),
                torch_dtype=torch.float16 if self.device == "cuda" else torch.float32,
                low_cpu_mem_usage=True,
                use_safetensors=True
            )

            # 모델을 디바이스로 이동
            self.model.to(self.device)

            # Pipeline 생성 (편리한 사용)
            self.pipe = pipeline(
                "automatic-speech-recognition",
                model=self.model,
                tokenizer=self.processor.tokenizer,
                feature_extractor=self.processor.feature_extractor,
                max_new_tokens=128,
                chunk_length_s=30,
                batch_size=16,
                return_timestamps=False,
                torch_dtype=torch.float16 if self.device == "cuda" else torch.float32,
                device=self.device,
                generate_kwargs={
                    "language": "korean",  # 한국어 강제
                    "task": "transcribe"
                }
            )

            logger.info("✅ STT model loaded successfully")

        except Exception as e:
            logger.error(f"❌ Failed to load STT model: {e}", exc_info=True)
            raise

    def transcribe(self, audio_data: bytes, sample_rate: int = 16000) -> str:
        """
        음성 데이터를 텍스트로 변환

        Args:
            audio_data: 오디오 바이트 데이터 (WAV, MP3 등)
            sample_rate: 샘플링 레이트 (기본 16kHz)

        Returns:
            인식된 텍스트
        """
        try:
            logger.info(f"🎤 Transcribing audio ({len(audio_data)} bytes, {sample_rate}Hz)")

            # Pipeline 사용 (자동으로 전처리 수행)
            result = self.pipe(audio_data)

            transcription = result["text"].strip()

            logger.info(f"✅ Transcription: {transcription}")
            return transcription

        except Exception as e:
            logger.error(f"❌ Transcription failed: {e}", exc_info=True)
            raise

    def transcribe_file(self, audio_file_path: str) -> str:
        """
        오디오 파일을 텍스트로 변환

        Args:
            audio_file_path: 오디오 파일 경로

        Returns:
            인식된 텍스트
        """
        try:
            logger.info(f"🎤 Transcribing file: {audio_file_path}")

            result = self.pipe(audio_file_path)
            transcription = result["text"].strip()

            logger.info(f"✅ Transcription: {transcription}")
            return transcription

        except Exception as e:
            logger.error(f"❌ Transcription failed: {e}", exc_info=True)
            raise


# 싱글톤 인스턴스
_stt_instance: Optional[LocalSTT] = None


def get_stt() -> LocalSTT:
    """
    STT 싱글톤 인스턴스 가져오기

    Returns:
        LocalSTT 인스턴스
    """
    global _stt_instance

    if _stt_instance is None:
        from django.conf import settings

        # 설정에서 모델 경로 가져오기 (없으면 기본값)
        model_path = getattr(settings, 'STT_MODEL_PATH', './models/stt/model.safetensors')
        _stt_instance = LocalSTT(model_path=model_path)

    return _stt_instance
