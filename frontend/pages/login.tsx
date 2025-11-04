import React, { useState } from 'react';
import { Box, Typography, TextField, Button, Checkbox, FormControlLabel, Link as MuiLink, Alert } from '@mui/material';
import { useRouter } from 'next/router';
import { authAPI } from '../src/services/api';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authAPI.login(email, password);

      // Store tokens
      localStorage.setItem('access_token', response.tokens.access);
      localStorage.setItem('refresh_token', response.tokens.refresh);
      localStorage.setItem('user', JSON.stringify(response.user));

      alert('로그인 성공! 환영합니다.');

      // Check if there's a return URL (for invite links)
      const returnUrl = router.query.returnUrl as string;
      if (returnUrl) {
        // Use window.location for hard navigation to ensure auth state is refreshed
        window.location.href = decodeURIComponent(returnUrl);
        return;
      }

      // Also check for legacy 'redirect' parameter
      const redirect = router.query.redirect as string;
      if (redirect) {
        // Use window.location for hard navigation to ensure auth state is refreshed
        window.location.href = redirect;
        return;
      }

      // Check if user is admin (staff or superuser) - redirect to dashboard
      // We need to verify this via API call
      try {
        const meResponse = await authAPI.me();
        if (meResponse.is_staff || meResponse.is_superuser) {
          router.push('/dashboard');
          return;
        }
      } catch (err) {
        console.error('Failed to check admin status:', err);
      }

      // Regular users redirect to mypage
      router.push('/mypage');
    } catch (err: any) {
      setError(err.response?.data?.error || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)' }}>
      {/* Header */}
      <Box sx={{ bgcolor: '#364C84', py: 2, px: 4, boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
        <Box sx={{ maxWidth: 1200, mx: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography
            onClick={() => router.push('/')}
            sx={{
              color: 'white',
              fontSize: '2rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            🌍 Triplan
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              onClick={() => router.push('/signup')}
              variant="outlined"
              sx={{
                color: 'white',
                borderColor: 'rgba(255,255,255,0.3)',
                fontWeight: 600,
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.1)',
                  borderColor: 'rgba(255,255,255,0.6)',
                },
              }}
            >
              회원가입
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Main Container */}
      <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', p: 5 }}>
        <Box
          sx={{
            bgcolor: 'white',
            borderRadius: '20px',
            boxShadow: '0 10px 30px rgba(54, 76, 132, 0.15)',
            overflow: 'hidden',
            maxWidth: 900,
            width: '100%',
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            minHeight: 600,
          }}
        >
          {/* Left Hero Section */}
          <Box
            sx={{
              background: 'linear-gradient(135deg, #D0D9F5 0%, #364c84 100%)',
              color: 'white',
              p: 7,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: '-50%',
                right: '-50%',
                width: '200%',
                height: '200%',
                background: 'radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)',
                backgroundSize: '50px 50px',
                animation: 'float 20s infinite linear',
              },
              '@keyframes float': {
                '0%': { transform: 'translateY(0px) rotate(0deg)' },
                '100%': { transform: 'translateY(-100px) rotate(360deg)' },
              },
            }}
          >
            <Box sx={{ position: 'relative', zIndex: 1 }}>
              <Typography variant="h3" sx={{ mb: 3, fontWeight: 700 }}>
                여행의 시작,
                <br />
                Triplan과 함께
              </Typography>
              <Typography variant="body1" sx={{ mb: 4, opacity: 0.9, lineHeight: 1.6 }}>
                AI가 추천하는 맞춤형 여행 일정으로
                <br />
                완벽한 여행을 계획하세요
              </Typography>
              <Box component="ul" sx={{ listStyle: 'none', textAlign: 'left', p: 0 }}>
                {['AI 기반 맞춤 일정', '실시간 협업 기능', '다양한 내보내기 옵션'].map((feature, idx) => (
                  <Box
                    component="li"
                    key={idx}
                    sx={{
                      py: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      fontSize: '1rem',
                    }}
                  >
                    <span>✈️</span>
                    <span>{feature}</span>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>

          {/* Right Form Section */}
          <Box sx={{ p: 7, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Box sx={{ textAlign: 'center', mb: 5 }}>
              <Typography variant="h4" sx={{ color: '#364c84', mb: 1, fontWeight: 700 }}>
                로그인
              </Typography>
              <Typography variant="body1" color="text.secondary">
                계정에 로그인하여 여행을 시작하세요
              </Typography>
            </Box>

            <Box component="form" onSubmit={handleSubmit}>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 600, color: '#333' }}>
                  이메일
                </Typography>
                <TextField
                  fullWidth
                  type="email"
                  placeholder="example@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '10px',
                      bgcolor: '#f8f9fa',
                    },
                  }}
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 600, color: '#333' }}>
                  비밀번호
                </Typography>
                <TextField
                  fullWidth
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '10px',
                      bgcolor: '#f8f9fa',
                    },
                  }}
                />
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <FormControlLabel
                  control={<Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)} size="small" />}
                  label={<Typography variant="body2">로그인 상태 유지</Typography>}
                />
                <MuiLink href="#" variant="body2" sx={{ color: '#364c84', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                  비밀번호 찾기
                </MuiLink>
              </Box>

              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={loading}
                sx={{
                  bgcolor: '#364c84',
                  color: 'white',
                  py: 1.5,
                  borderRadius: '10px',
                  fontSize: '1rem',
                  fontWeight: 600,
                  textTransform: 'none',
                  mb: 3,
                  '&:hover': {
                    bgcolor: '#2a3a66',
                  },
                }}
              >
                {loading ? '로그인 중...' : '로그인'}
              </Button>

              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  아직 계정이 없으신가요?{' '}
                  <MuiLink
                    onClick={() => router.push('/signup')}
                    sx={{
                      color: '#364c84',
                      fontWeight: 600,
                      textDecoration: 'none',
                      cursor: 'pointer',
                      '&:hover': { textDecoration: 'underline' }
                    }}
                  >
                    회원가입
                  </MuiLink>
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
