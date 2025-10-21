import React from 'react';
import { Box, Typography } from '@mui/material';
import UnifiedChatWidget from '../src/components/planner/UnifiedChatWidget';
import { useAuth } from '../src/hooks/useAuth';

export default function TestChat() {
  const { user, isAuthenticated } = useAuth();

  // Get tripId from URL
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const tripId = params ? parseInt(params.get('tripId') || '0') : 0;

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" gutterBottom>채팅 위젯 테스트 페이지</Typography>

      <Box sx={{ mb: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
        <Typography><strong>인증 상태:</strong> {isAuthenticated ? '✅ 로그인됨' : '❌ 로그인 필요'}</Typography>
        <Typography><strong>사용자:</strong> {user?.email || '없음'}</Typography>
        <Typography><strong>Trip ID:</strong> {tripId || '없음'}</Typography>
      </Box>

      <Typography variant="body1" sx={{ mb: 2 }}>
        채팅 위젯이 우측 하단에 표시되어야 합니다.
      </Typography>

      {isAuthenticated ? (
        <UnifiedChatWidget tripId={tripId} tripTitle="테스트 여행" />
      ) : (
        <Typography color="error">
          로그인이 필요합니다. <a href="/login">로그인하기</a>
        </Typography>
      )}
    </Box>
  );
}
