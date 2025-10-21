import React, { useState } from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Paper,
  Alert,
  CircularProgress,
} from '@mui/material';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import { useAuth } from '../src/hooks/useAuth';
import tripAPI from '../src/services/tripAPI';

export default function JoinPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated) {
      router.push(`/login?redirect=/join&code=${inviteCode}`);
      return;
    }

    if (!inviteCode.trim()) {
      setError('초대 코드를 입력해주세요');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const result = await tripAPI.joinByCode(inviteCode.trim());

      setSuccess(`${result.trip_title}에 참여했습니다! 이동 중...`);

      // Redirect to planner after 1 second using invite_code
      setTimeout(() => {
        router.push(`/planner/${inviteCode.trim().toUpperCase()}`);
      }, 1000);
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          '초대 코드가 유효하지 않습니다. 코드를 확인해주세요.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={10}
          sx={{
            p: 4,
            borderRadius: 3,
          }}
        >
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <GroupAddIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              여행 참여하기
            </Typography>
            <Typography variant="body2" color="text.secondary">
              친구에게 받은 초대 코드를 입력하세요
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 3 }}>
              {success}
            </Alert>
          )}

          <form onSubmit={handleJoin}>
            <TextField
              label="초대 코드"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="예: ABC123"
              fullWidth
              autoFocus
              inputProps={{
                maxLength: 6,
                style: {
                  fontSize: '1.5rem',
                  letterSpacing: '0.2em',
                  textAlign: 'center',
                  textTransform: 'uppercase',
                },
              }}
              sx={{ mb: 3 }}
              disabled={loading || !!success}
            />

            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              disabled={loading || !!success || !inviteCode.trim()}
              sx={{ mb: 2, py: 1.5 }}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                '참여하기'
              )}
            </Button>

            <Button
              variant="text"
              fullWidth
              onClick={() => router.push('/')}
              disabled={loading || !!success}
            >
              홈으로 돌아가기
            </Button>
          </form>

          <Box
            sx={{
              mt: 4,
              p: 2,
              bgcolor: 'grey.100',
              borderRadius: 2,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              💡 <strong>초대 코드가 없나요?</strong>
              <br />
              여행을 만든 친구에게 초대 코드를 요청하세요!
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
