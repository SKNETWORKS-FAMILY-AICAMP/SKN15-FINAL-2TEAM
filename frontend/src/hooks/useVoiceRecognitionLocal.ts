/**
 * Local STT Model을 사용한 음성인식 훅
 * 자체 학습한 model.safetensors를 사용
 */

import { useState, useCallback } from 'react';
import { useAudioRecorder } from './useAudioRecorder';
import { useAuth } from './useAuth';

interface UseVoiceRecognitionLocalOptions {
  onResult?: (transcript: string) => void;
  onError?: (error: string) => void;
}

export function useVoiceRecognitionLocal({
  onResult,
  onError,
}: UseVoiceRecognitionLocalOptions = {}) {
  const { token } = useAuth();
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');

  // 오디오 녹음 훅
  const {
    isSupported: isRecordingSupported,
    isRecording,
    recordingTime,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useAudioRecorder({
    onRecordingComplete: async (audioBlob) => {
      console.log('🎤 Audio recording complete, sending to STT API...');
      await transcribeAudio(audioBlob);
    },
    onError: (error) => {
      console.error('Recording error:', error);
      if (onError) onError(error);
    },
  });

  // 오디오를 STT API로 전송
  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      setIsTranscribing(true);

      // FormData 생성
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      // STT API 호출
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${apiUrl}/api/chat/stt/transcribe/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`STT API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.text) {
        console.log('✅ Transcription:', data.text);
        setTranscript(data.text);

        if (onResult) {
          onResult(data.text);
        }
      } else {
        throw new Error(data.error || 'Transcription failed');
      }

    } catch (error: any) {
      console.error('❌ Transcription error:', error);
      const errorMessage = error.message || '음성인식 중 오류가 발생했습니다.';

      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setIsTranscribing(false);
    }
  };

  // 녹음 시작
  const startListening = useCallback(() => {
    setTranscript('');
    startRecording();
  }, [startRecording]);

  // 녹음 중지 (자동으로 transcribe 실행됨)
  const stopListening = useCallback(() => {
    stopRecording();
  }, [stopRecording]);

  // 녹음 취소
  const abortListening = useCallback(() => {
    cancelRecording();
    setTranscript('');
  }, [cancelRecording]);

  // 초기화
  const reset = useCallback(() => {
    setTranscript('');
  }, []);

  // 녹음 중이거나 변환 중인지
  const isListening = isRecording || isTranscribing;

  return {
    isSupported: isRecordingSupported,
    isListening,
    isRecording,
    isTranscribing,
    transcript,
    interimTranscript: '', // 로컬 STT는 중간 결과 없음
    recordingTime,
    startListening,
    stopListening,
    abortListening,
    reset,
  };
}
