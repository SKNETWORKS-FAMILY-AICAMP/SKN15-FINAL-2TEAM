"""
STT (Speech-to-Text) API Views
음성 → 텍스트 변환 REST API
"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.core.files.uploadedfile import InMemoryUploadedFile
import logging
import tempfile
import os

from .stt import get_stt

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def transcribe_audio(request):
    """
    음성 파일을 텍스트로 변환하는 API

    Request:
        - audio: 오디오 파일 (multipart/form-data)
          - 지원 포맷: WAV, MP3, OGG, WEBM
          - 권장: 16kHz, mono

    Response:
        {
            "text": "인식된 텍스트",
            "success": true
        }
    """
    try:
        # 오디오 파일 확인
        if 'audio' not in request.FILES:
            return Response({
                'error': '오디오 파일이 필요합니다.',
                'success': False
            }, status=status.HTTP_400_BAD_REQUEST)

        audio_file: InMemoryUploadedFile = request.FILES['audio']

        logger.info(f"🎤 Received audio file: {audio_file.name} ({audio_file.size} bytes)")

        # 파일 크기 제한 (10MB)
        max_size = 10 * 1024 * 1024  # 10MB
        if audio_file.size > max_size:
            return Response({
                'error': f'파일 크기가 너무 큽니다. 최대 {max_size // (1024*1024)}MB까지 가능합니다.',
                'success': False
            }, status=status.HTTP_400_BAD_REQUEST)

        # 임시 파일로 저장 (모델이 파일 경로를 요구하는 경우)
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(audio_file.name)[1]) as temp_file:
            # 파일 내용 쓰기
            for chunk in audio_file.chunks():
                temp_file.write(chunk)

            temp_file_path = temp_file.name

        try:
            # STT 모델로 변환
            stt = get_stt()
            transcription = stt.transcribe_file(temp_file_path)

            logger.info(f"✅ Transcription successful: {transcription}")

            return Response({
                'text': transcription,
                'success': True
            }, status=status.HTTP_200_OK)

        finally:
            # 임시 파일 삭제
            try:
                os.unlink(temp_file_path)
            except Exception as e:
                logger.warning(f"Failed to delete temp file: {e}")

    except Exception as e:
        logger.error(f"❌ Transcription error: {e}", exc_info=True)
        return Response({
            'error': f'음성인식 중 오류가 발생했습니다: {str(e)}',
            'success': False
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def stt_health(request):
    """
    STT 모델 상태 확인

    Response:
        {
            "status": "ready" | "not_loaded",
            "device": "cuda" | "cpu",
            "model_path": "...",
            "success": true
        }
    """
    try:
        stt = get_stt()

        return Response({
            'status': 'ready',
            'device': stt.device,
            'model_path': str(stt.model_path),
            'success': True
        }, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"❌ STT health check failed: {e}")
        return Response({
            'status': 'not_loaded',
            'error': str(e),
            'success': False
        }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
