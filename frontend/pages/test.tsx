import React from 'react';
import { Box, Typography } from '@mui/material';

export default function Test() {
  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4">테스트 페이지</Typography>
      <Typography variant="body1">정상 작동 중입니다.</Typography>
    </Box>
  );
}
