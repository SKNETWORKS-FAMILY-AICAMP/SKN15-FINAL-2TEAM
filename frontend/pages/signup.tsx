import React, { useState } from 'react';
import { Box, Typography, TextField, Button, Checkbox, FormControlLabel, Link as MuiLink, Alert } from '@mui/material';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { authAPI } from '../src/services/api';
import tripAPI from '../src/services/tripAPI';

export default function Signup() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
  });
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [field]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    // Validate password length
    if (formData.password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }

    setLoading(true);

    try {
      const response = await authAPI.register(
        formData.email,
        formData.password,
        formData.confirmPassword
      );

      // Store tokens
      localStorage.setItem('access_token', response.tokens.access);
      localStorage.setItem('refresh_token', response.tokens.refresh);
      localStorage.setItem('user', JSON.stringify(response.user));

      alert('회원가입이 완료되었습니다! 환영합니다.');

      // Fetch user's trips and redirect to the first one
      try {
        const trips = await tripAPI.getTrips();
        if (trips && trips.length > 0) {
          // Redirect to the first trip using invite_code
          if (trips[0].invite_code) {
            router.push(`/planner/${trips[0].invite_code}`);
          } else {
            router.push('/mypage');
          }
        } else {
          // No trips found, redirect to main page
          router.push('/');
        }
      } catch (tripErr) {
        console.error('Failed to fetch trips:', tripErr);
        // Fallback to main page if trip fetching fails
        router.push('/');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error ||
                          err.response?.data?.email?.[0] ||
                          err.response?.data?.password?.[0] ||
                          '회원가입에 실패했습니다.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)' }}>
      {/* Header */}
      <Box sx={{ bgcolor: '#364C84', py: 2, px: 4, boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
        <Box sx={{ maxWidth: 1200, mx: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/" passHref>
            <Typography
              component="a"
              sx={{
                color: 'white',
                fontSize: '2rem',
                fontWeight: 'bold',
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              🌍 Triplan
            </Typography>
          </Link>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Link href="/login" passHref>
              <Button
                component="a"
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
                로그인
              </Button>
            </Link>
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
            maxWidth: 1000,
            width: '100%',
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            minHeight: 700,
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
                left: '-50%',
                width: '200%',
                height: '200%',
                background: 'radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)',
                backgroundSize: '60px 60px',
                animation: 'float 25s infinite linear',
              },
              '@keyframes float': {
                '0%': { transform: 'translateX(0px) rotate(0deg)' },
                '100%': { transform: 'translateX(-60px) rotate(360deg)' },
              },
            }}
          >
            <Box sx={{ position: 'relative', zIndex: 1 }}>
              <Typography variant="h3" sx={{ mb: 3, fontWeight: 700 }}>
                Triplan과 함께
                <br />
                새로운 여행을 시작하세요
              </Typography>
              <Typography variant="body1" sx={{ mb: 5, opacity: 0.9, lineHeight: 1.6 }}>
                AI 기반 여행 계획부터 실시간 협업까지
                <br />
                모든 것을 한 곳에서
              </Typography>

              {/* Stats */}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, width: '100%' }}>
                {[
                  { number: '10,000+', label: '활성 사용자' },
                  { number: '50,000+', label: '생성된 여행' },
                  { number: '150+', label: '지원 도시' },
                  { number: '4.8★', label: '평균 평점' },
                ].map((stat, idx) => (
                  <Box key={idx} sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                      {stat.number}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.8 }}>
                      {stat.label}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>

          {/* Right Form Section */}
          <Box sx={{ p: 7, display: 'flex', flexDirection: 'column', justifyContent: 'center', overflowY: 'auto' }}>
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <Typography variant="h4" sx={{ color: '#364c84', mb: 1, fontWeight: 700 }}>
                회원가입
              </Typography>
              <Typography variant="body1" color="text.secondary">
                무료로 시작하여 완벽한 여행을 계획하세요
              </Typography>
            </Box>

            <Box component="form" onSubmit={handleSubmit}>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 600, color: '#333' }}>
                  이름
                </Typography>
                <TextField
                  fullWidth
                  placeholder="홍길동"
                  value={formData.name}
                  onChange={handleChange('name')}
                  required
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: '#f8f9fa' } }}
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 600, color: '#333' }}>
                  이메일
                </Typography>
                <TextField
                  fullWidth
                  type="email"
                  placeholder="example@email.com"
                  value={formData.email}
                  onChange={handleChange('email')}
                  required
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: '#f8f9fa' } }}
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 600, color: '#333' }}>
                  비밀번호
                </Typography>
                <TextField
                  fullWidth
                  type="password"
                  placeholder="8자 이상 입력"
                  value={formData.password}
                  onChange={handleChange('password')}
                  required
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: '#f8f9fa' } }}
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 600, color: '#333' }}>
                  비밀번호 확인
                </Typography>
                <TextField
                  fullWidth
                  type="password"
                  placeholder="비밀번호 재입력"
                  value={formData.confirmPassword}
                  onChange={handleChange('confirmPassword')}
                  required
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: '#f8f9fa' } }}
                />
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 600, color: '#333' }}>
                  전화번호 (선택)
                </Typography>
                <TextField
                  fullWidth
                  placeholder="010-1234-5678"
                  value={formData.phone}
                  onChange={handleChange('phone')}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: '#f8f9fa' } }}
                />
              </Box>

              <Box sx={{ mb: 3 }}>
                <FormControlLabel
                  control={<Checkbox checked={agree} onChange={(e) => setAgree(e.target.checked)} size="small" />}
                  label={
                    <Typography variant="body2">
                      <MuiLink href="#" sx={{ color: '#364c84', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                        이용약관
                      </MuiLink>
                      {' 및 '}
                      <MuiLink href="#" sx={{ color: '#364c84', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                        개인정보처리방침
                      </MuiLink>
                      에 동의합니다
                    </Typography>
                  }
                />
              </Box>

              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={!agree || loading}
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
                  '&:disabled': {
                    bgcolor: '#e0e0e0',
                    color: '#999',
                  },
                }}
              >
                {loading ? '가입 중...' : '회원가입'}
              </Button>

              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  이미 계정이 있으신가요?{' '}
                  <Link href="/login" passHref>
                    <MuiLink sx={{ color: '#364c84', fontWeight: 600, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                      로그인
                    </MuiLink>
                  </Link>
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
