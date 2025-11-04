import React from 'react';
import dynamic from 'next/dynamic';
import { Box, CircularProgress } from '@mui/material';

// 카카오맵은 클라이언트 사이드에서만 로드
const KakaoMapSearch = dynamic(
  () => import('../src/components/KakaoMapSearch'),
  {
    ssr: false,
    loading: () => (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    ),
  }
);

export default function MapSearchPage() {
  const handlePlaceSelect = (place: any) => {
    console.log('Selected place:', place);
    // 여기서 선택된 장소를 처리 (예: 플래너에 추가)
  };

  return (
    <KakaoMapSearch
      onPlaceSelect={handlePlaceSelect}
      initialCenter={{ lat: 33.450701, lng: 126.570667 }} // 제주
      initialZoom={10}
    />
  );
}
