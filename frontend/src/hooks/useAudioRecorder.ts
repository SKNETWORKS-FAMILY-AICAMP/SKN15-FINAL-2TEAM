import { useState, useRef, useCallback } from 'react';

interface UseAudioRecorderOptions {
  onRecordingComplete?: (audioBlob: Blob) => void;
  onError?: (error: string) => void;
}

export function useAudioRecorder({
  onRecordingComplete,
  onError,
}: UseAudioRecorderOptions = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isSupported, setIsSupported] = useState(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 녹음 시작
  const startRecording = useCallback(async () => {
    try {
      // 브라우저 지원 확인
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setIsSupported(false);
        if (onError) {
          onError('이 브라우저는 오디오 녹음을 지원하지 않습니다.');
        }
        return;
      }

      // 마이크 권한 요청
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1, // mono
          sampleRate: 16000, // 16kHz (STT 모델에 적합)
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      streamRef.current = stream;

      // MediaRecorder 생성
      const mimeType = getSupportedMimeType();
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // 데이터 수집
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // 녹음 종료 시 처리
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        console.log('🎤 Recording complete:', audioBlob.size, 'bytes');

        if (onRecordingComplete) {
          onRecordingComplete(audioBlob);
        }

        // 스트림 정리
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };

      // 녹음 시작
      mediaRecorder.start(100); // 100ms마다 데이터 수집
      setIsRecording(true);
      setRecordingTime(0);

      // 타이머 시작
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      console.log('🎤 Recording started');

    } catch (error: any) {
      console.error('Failed to start recording:', error);
      setIsRecording(false);

      let errorMessage = '녹음을 시작할 수 없습니다.';
      if (error.name === 'NotAllowedError') {
        errorMessage = '마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크 권한을 허용해주세요.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = '마이크를 찾을 수 없습니다. 마이크를 연결해주세요.';
      }

      if (onError) {
        onError(errorMessage);
      }
    }
  }, [onRecordingComplete, onError]);

  // 녹음 중지
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      // 타이머 정리
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      console.log('🎤 Recording stopped');
    }
  }, [isRecording]);

  // 녹음 취소
  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      // 스트림 정리
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      mediaRecorderRef.current.stop();
      setIsRecording(false);
      audioChunksRef.current = [];

      // 타이머 정리
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      console.log('🎤 Recording cancelled');
    }
  }, [isRecording]);

  return {
    isSupported,
    isRecording,
    recordingTime,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}

// 브라우저가 지원하는 MIME 타입 찾기
function getSupportedMimeType(): string {
  const types = [
    'audio/webm',
    'audio/webm;codecs=opus',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      console.log('📝 Using MIME type:', type);
      return type;
    }
  }

  console.warn('⚠️ No supported MIME type found, using default');
  return 'audio/webm'; // 기본값
}
