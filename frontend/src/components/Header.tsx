import React, { useEffect, useState } from 'react';
import { AppBar, Toolbar, Typography, Button, Box, Container } from '@mui/material';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../hooks/useAuth';

export default function Header() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Call useAuth unconditionally
  const authHook = useAuth();
  const { isAuthenticated, user, logout, loading } = authHook || {};

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = () => {
    if (logout) {
      logout();
      alert('로그아웃되었습니다.');
      router.push('/');
    }
  };

  // Prevent hydration mismatch
  if (!mounted || loading) {
    return (
      <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: '1px solid #eee', mb: 5 }}>
        <Container maxWidth="lg">
          <Toolbar sx={{ justifyContent: 'space-between', py: 2 }}>
            <Link href="/" passHref>
              <Typography
                variant="h6"
                component="a"
                sx={{
                  color: 'primary.main',
                  fontWeight: 'bold',
                  fontSize: '1.8rem',
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}
              >
                Triplan
              </Typography>
            </Link>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Link href="/places" passHref legacyBehavior>
                <Button
                  variant="text"
                  component="a"
                  sx={{
                    textTransform: 'none',
                    fontSize: '1rem',
                    fontWeight: 500,
                    color: '#333',
                    '&:hover': {
                      bgcolor: 'rgba(0, 0, 0, 0.04)',
                    }
                  }}
                >
                  여행지
                </Button>
              </Link>
              <Button variant="outlined" color="primary" disabled>
                로딩중...
              </Button>
            </Box>
          </Toolbar>
        </Container>
      </AppBar>
    );
  }

  return (
    <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: '1px solid #eee', mb: 5 }}>
      <Container maxWidth="lg">
        <Toolbar sx={{ justifyContent: 'space-between', py: 2 }}>
          <Link href="/" passHref>
            <Typography
              variant="h6"
              component="a"
              sx={{
                color: 'primary.main',
                fontWeight: 'bold',
                fontSize: '1.8rem',
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              Triplan
            </Typography>
          </Link>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Link href="/places" passHref legacyBehavior>
              <Button
                variant="text"
                component="a"
                sx={{
                  textTransform: 'none',
                  fontSize: '1rem',
                  fontWeight: 500,
                  color: '#333',
                  '&:hover': {
                    bgcolor: 'rgba(0, 0, 0, 0.04)',
                  }
                }}
              >
                여행지
              </Button>
            </Link>
            {isAuthenticated ? (
              <>
                <Button
                  variant="text"
                  onClick={() => {
                    console.log('Navigating to mypage');
                    router.push('/mypage');
                  }}
                  sx={{
                    textTransform: 'none',
                    color: '#333',
                    fontSize: '0.875rem',
                    '&:hover': {
                      bgcolor: 'rgba(0, 0, 0, 0.08)',
                    }
                  }}
                >
                  {user?.email}
                </Button>
                <Button
                  variant="outlined"
                  color="primary"
                  onClick={handleLogout}
                  sx={{
                    fontWeight: 600,
                  }}
                >
                  로그아웃
                </Button>
              </>
            ) : (
              <>
                <Link href="/login" passHref legacyBehavior>
                  <Button variant="outlined" color="primary" component="a">
                    로그인
                  </Button>
                </Link>
                <Link href="/signup" passHref legacyBehavior>
                  <Button variant="contained" color="primary" component="a">
                    회원가입
                  </Button>
                </Link>
              </>
            )}
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
