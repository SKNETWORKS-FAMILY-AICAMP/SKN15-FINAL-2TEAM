import { useState, useEffect, useRef, useCallback } from 'react';

interface UseVoiceRecognitionOptions {
  onResult?: (transcript: string) => void;
  onError?: (error: string) => void;
  continuous?: boolean;
  interimResults?: boolean;
  lang?: string;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

// Web Speech API 타입 정의
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export function useVoiceRecognition({
  onResult,
  onError,
  continuous = false,
  interimResults = true,
  lang = 'ko-KR',
}: UseVoiceRecognitionOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // 브라우저 지원 확인
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      setIsSupported(true);
      recognitionRef.current = new SpeechRecognition();

      const recognition = recognitionRef.current;
      recognition.continuous = continuous;
      recognition.interimResults = interimResults;
      recognition.lang = lang;

      // 음성인식 시작
      recognition.onstart = () => {
        console.log('🎤 Voice recognition started');
        setIsListening(true);
      };

      // 음성인식 종료
      recognition.onend = () => {
        console.log('🎤 Voice recognition ended');
        setIsListening(false);
      };

      // 결과 수신
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interim = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcriptPart = result[0].transcript;

          if (result.isFinal) {
            finalTranscript += transcriptPart + ' ';
          } else {
            interim += transcriptPart;
          }
        }

        if (finalTranscript) {
          console.log('🎤 Final transcript:', finalTranscript);
          setTranscript(prev => prev + finalTranscript);
          if (onResult) {
            onResult(finalTranscript.trim());
          }
        }

        if (interim) {
          console.log('🎤 Interim transcript:', interim);
          setInterimTranscript(interim);
        }
      };

      // 에러 처리
      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('🎤 Voice recognition error:', event.error);
        setIsListening(false);

        let errorMessage = '음성인식 오류가 발생했습니다.';
        switch (event.error) {
          case 'no-speech':
            errorMessage = '음성이 감지되지 않았습니다. 다시 시도해주세요.';
            break;
          case 'audio-capture':
            errorMessage = '마이크를 찾을 수 없습니다. 마이크를 연결해주세요.';
            break;
          case 'not-allowed':
            errorMessage = '마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크 권한을 허용해주세요.';
            break;
          case 'network':
            errorMessage = '네트워크 오류가 발생했습니다.';
            break;
        }

        if (onError) {
          onError(errorMessage);
        }
      };
    } else {
      setIsSupported(false);
      console.warn('🎤 Web Speech API is not supported in this browser');
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [continuous, interimResults, lang, onResult, onError]);

  // 녹음 시작
  const startListening = useCallback(() => {
    if (!isSupported) {
      if (onError) {
        onError('이 브라우저는 음성인식을 지원하지 않습니다. Chrome 또는 Edge를 사용해주세요.');
      }
      return;
    }

    if (recognitionRef.current && !isListening) {
      setTranscript('');
      setInterimTranscript('');
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Failed to start recognition:', error);
        // 이미 실행 중인 경우 무시
      }
    }
  }, [isSupported, isListening, onError]);

  // 녹음 중지
  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  // 녹음 취소
  const abortListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      setIsListening(false);
      setTranscript('');
      setInterimTranscript('');
    }
  }, []);

  // 초기화
  const reset = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    abortListening,
    reset,
  };
}
