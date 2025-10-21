import React, { useEffect, useRef, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import configAPI from '@/services/configAPI';

declare global {
  interface Window {
    kakao: any;
  }
}

interface KakaoMapProps {
  width?: string;
  height?: string;
  center?: {
    lat: number;
    lng: number;
  };
  level?: number;
}

const KakaoMap: React.FC<KakaoMapProps> = ({
  width = '100%',
  height = '500px',
  center = { lat: 37.5665, lng: 126.9780 }, // 서울 기본 좌표
  level = 3,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [map, setMap] = useState<any>(null);

  useEffect(() => {
    const initializeMap = async () => {
      try {
        // Get Kakao Map API Key
        const config = await configAPI.getConfig();
        const apiKey = config.kakaoMapApiKey;

        if (!apiKey) {
          setError('카카오 맵 API 키가 설정되지 않았습니다.');
          setLoading(false);
          return;
        }

        // Load Kakao Maps SDK
        if (!window.kakao || !window.kakao.maps) {
          console.log('Loading Kakao Maps SDK with key:', apiKey.substring(0, 10) + '...');
          const script = document.createElement('script');
          script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false`;
          script.async = true;

          script.onload = () => {
            console.log('Kakao Maps SDK script loaded');
            if (window.kakao && window.kakao.maps) {
              window.kakao.maps.load(() => {
                console.log('Kakao Maps ready');
                createMap();
              });
            } else {
              console.error('window.kakao is not available after script load');
              setError('카카오 맵 SDK 초기화 실패. 도메인 설정을 확인해주세요.');
              setLoading(false);
            }
          };

          script.onerror = (e) => {
            console.error('Script load error:', e);
            setError('카카오 맵 SDK를 로드하는 데 실패했습니다. 플랫폼 도메인 설정을 확인해주세요.');
            setLoading(false);
          };

          document.head.appendChild(script);
        } else {
          // SDK already loaded
          createMap();
        }
      } catch (err) {
        console.error('Failed to initialize map:', err);
        setError('지도를 초기화하는 데 실패했습니다.');
        setLoading(false);
      }
    };

    const createMap = () => {
      if (!mapContainer.current) return;

      try {
        const options = {
          center: new window.kakao.maps.LatLng(center.lat, center.lng),
          level: level,
        };

        const kakaoMap = new window.kakao.maps.Map(mapContainer.current, options);
        setMap(kakaoMap);
        setLoading(false);
      } catch (err) {
        console.error('Failed to create map:', err);
        setError('지도를 생성하는 데 실패했습니다.');
        setLoading(false);
      }
    };

    initializeMap();
  }, [center.lat, center.lng, level]);

  if (error) {
    return (
      <Box
        sx={{
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#f5f5f5',
          borderRadius: '8px',
          border: '1px solid #e0e0e0',
        }}
      >
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative', width, height }}>
      {loading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: '#f5f5f5',
            borderRadius: '8px',
            zIndex: 1,
          }}
        >
          <CircularProgress />
        </Box>
      )}
      <div
        ref={mapContainer}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '8px',
          border: '1px solid #e0e0e0',
        }}
      />
    </Box>
  );
};

export default KakaoMap;
