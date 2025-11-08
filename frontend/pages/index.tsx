import React from 'react';
import {
  Container,
  Box,
  Typography,
  Button,
  Grid,
  Card,
  Paper,
} from '@mui/material';
import { useRouter } from 'next/router';
import Header from '../src/components/Header';
import { useAuth } from '../src/hooks/useAuth';

export default function Home() {
  const router = useRouter();
  const authHook = useAuth();
  const isAuthenticated = authHook?.isAuthenticated || false;

  const handleStartPlanning = () => {
    if (isAuthenticated) {
      // 로그인된 상태면 마이페이지로 이동
      router.push('/mypage');
    } else {
      // 로그인 안 되어 있으면 로그인 페이지로
      router.push('/login?redirect=/mypage');
    }
  };

  return (
    <>
      <Header />
      <Container maxWidth="lg">
        {/* Hero Section */}
        <Box
          sx={{
            background: 'linear-gradient(135deg, #364C84 0%, #2a3a66 100%)',
            color: 'white',
            py: 8,
            px: 5,
            borderRadius: '15px',
            mb: 8,
            textAlign: 'center',
          }}
        >
          <Typography variant="h1" sx={{ mb: 2, fontSize: { xs: '2.5rem', md: '3.5rem' } }}>
            AI와 함께하는
            <br />
            스마트 여행 계획
          </Typography>
          <Typography variant="h6" sx={{ mb: 4, opacity: 0.95, fontSize: '1.3rem' }}>
            채팅으로 간편하게 여행 일정을 계획하고
            <br />
            동행자와 실시간으로 협업하세요
          </Typography>

          <Box sx={{ mb: 5 }}>
            <Button
              variant="contained"
              size="large"
              onClick={handleStartPlanning}
              sx={{
                bgcolor: 'white',
                color: 'primary.main',
                fontSize: '1.1rem',
                px: 4,
                py: 2,
                fontWeight: 600,
                mr: 2,
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.9)',
                },
              }}
            >
              여행 계획 시작하기
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => router.push('/planner')}
              sx={{
                borderColor: 'white',
                color: 'white',
                fontSize: '1.1rem',
                px: 4,
                py: 2,
                borderWidth: 2,
                '&:hover': {
                  borderColor: 'white',
                  bgcolor: 'rgba(255,255,255,0.1)',
                  borderWidth: 2,
                },
              }}
            >
              데모 보기
            </Button>
          </Box>

          {/* Demo Chat */}
          <Paper
            elevation={8}
            sx={{
              maxWidth: 420,
              mx: 'auto',
              borderRadius: '20px',
              overflow: 'hidden',
              bgcolor: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(15px)',
            }}
          >
            {/* Chat Header */}
            <Box
              sx={{
                background: 'linear-gradient(135deg, #364C84 0%, #2a3a66 100%)',
                color: 'white',
                p: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                  제주도 2박 3일 여행
                </Typography>
              </Box>
              <Box
                sx={{
                  bgcolor: 'rgba(255,255,255,0.2)',
                  px: 1.5,
                  py: 0.5,
                  borderRadius: '12px',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                }}
              >
                3명 참여중
              </Box>
            </Box>

            {/* Chat Messages */}
            <Box sx={{ p: 2.5, bgcolor: '#f8f9fa', maxHeight: 320, overflowY: 'auto' }}>
              {/* User Message */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
                <Box sx={{ maxWidth: '75%' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.3, justifyContent: 'flex-end' }}>
                    <Typography variant="caption" sx={{ color: '#666', fontSize: '0.7rem' }}>
                      민지
                    </Typography>
                  </Box>
                  <Paper
                    sx={{
                      background: 'linear-gradient(135deg, #364C84, #2a3a66)',
                      color: 'white',
                      p: 1.5,
                      borderRadius: '18px 18px 4px 18px',
                      boxShadow: '0 2px 8px rgba(54, 76, 132, 0.25)',
                    }}
                  >
                    <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
                      제주도 2박 3일 여행 계획 짜줘!
                    </Typography>
                  </Paper>
                </Box>
              </Box>

              {/* AI Message */}
              <Box sx={{ display: 'flex', mb: 1.5 }}>
                <Box sx={{ maxWidth: '75%' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.3 }}>
                    <Typography variant="caption" sx={{ color: '#666', fontSize: '0.7rem' }}>
                      🤖 AI 어시스턴트
                    </Typography>
                  </Box>
                  <Paper
                    sx={{
                      bgcolor: 'white',
                      border: '1px solid #e3e3e3',
                      p: 1.5,
                      borderRadius: '18px 18px 18px 4px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                    }}
                  >
                    <Typography variant="body2" sx={{ lineHeight: 1.5, color: '#333' }}>
                      제주도 2박 3일 여행을 계획해드릴게요! 🍊
                      <br />
                      선호하는 여행 스타일과 예산을 알려주시면
                      <br />
                      맞춤형 일정을 추천해드리겠습니다.
                    </Typography>
                  </Paper>
                </Box>
              </Box>

              {/* Friend Message 1 */}
              <Box sx={{ display: 'flex', mb: 1.5 }}>
                <Box sx={{ maxWidth: '75%' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.3 }}>
                    <Typography variant="caption" sx={{ color: '#666', fontSize: '0.7rem' }}>
                      수현
                    </Typography>
                  </Box>
                  <Paper
                    sx={{
                      bgcolor: '#fff',
                      border: '1px solid #e3e3e3',
                      p: 1.5,
                      borderRadius: '18px 18px 18px 4px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                    }}
                  >
                    <Typography variant="body2" sx={{ lineHeight: 1.5, color: '#333' }}>
                      우리 예산은 1인당 50만원 정도!
                    </Typography>
                  </Paper>
                </Box>
              </Box>

              {/* Friend Message 2 */}
              <Box sx={{ display: 'flex', mb: 1.5 }}>
                <Box sx={{ maxWidth: '75%' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.3 }}>
                    <Typography variant="caption" sx={{ color: '#666', fontSize: '0.7rem' }}>
                      지훈
                    </Typography>
                  </Box>
                  <Paper
                    sx={{
                      bgcolor: '#fff',
                      border: '1px solid #e3e3e3',
                      p: 1.5,
                      borderRadius: '18px 18px 18px 4px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                    }}
                  >
                    <Typography variant="body2" sx={{ lineHeight: 1.5, color: '#333' }}>
                      자연 경관이랑 맛집 위주로 가고 싶어요 🌊
                    </Typography>
                  </Paper>
                </Box>
              </Box>

              {/* AI Response */}
              <Box sx={{ display: 'flex' }}>
                <Box sx={{ maxWidth: '75%' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.3 }}>
                    <Typography variant="caption" sx={{ color: '#666', fontSize: '0.7rem' }}>
                      🤖 AI 어시스턴트
                    </Typography>
                  </Box>
                  <Paper
                    sx={{
                      bgcolor: 'white',
                      border: '1px solid #e3e3e3',
                      p: 1.5,
                      borderRadius: '18px 18px 18px 4px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                    }}
                  >
                    <Typography variant="body2" sx={{ lineHeight: 1.5, color: '#333' }}>
                      완벽해요! 자연과 맛집 중심으로
                      <br />
                      📍 성산일출봉 → 🍜 흑돼지 맛집 → 🌊 협재 해수욕장
                      <br />
                      이런 루트는 어떠세요? 상세 계획을 만들어드릴게요!
                    </Typography>
                  </Paper>
                </Box>
              </Box>
            </Box>

            {/* Chat Input */}
            <Box
              sx={{
                display: 'flex',
                p: 2,
                bgcolor: 'white',
                borderTop: '1px solid #e0e0e0',
                gap: 1,
                alignItems: 'center',
              }}
            >
              <Box
                sx={{
                  flex: 1,
                  border: '1px solid #ddd',
                  borderRadius: '22px',
                  p: '11px 16px',
                  bgcolor: '#f8f9fa',
                  fontSize: '0.85rem',
                  color: '#999',
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: '#f0f1f3',
                    borderColor: '#ccc',
                  },
                }}
              >
                메시지를 입력하세요...
              </Box>
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #364C84, #2a3a66)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    transform: 'scale(1.05)',
                    boxShadow: '0 4px 12px rgba(54, 76, 132, 0.3)',
                  },
                }}
              >
                ✈️
              </Box>
            </Box>
          </Paper>
        </Box>

        {/* Features Section */}
        <Box sx={{ mb: 10 }}>
          <Typography variant="h2" align="center" sx={{ mb: 2 }}>
            주요 기능
          </Typography>
          <Typography variant="h6" align="center" color="text.secondary" sx={{ mb: 6 }}>
            모든 여행 계획을 한 곳에서 간편하게
          </Typography>

          <Grid container spacing={5}>
            <Grid item xs={12} md={4}>
              <Card
                sx={{
                  p: 5,
                  textAlign: 'center',
                  border: '1px solid #e0e0e0',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-5px)',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
                  },
                }}
              >
                <Typography variant="h2" sx={{ mb: 3 }}>
                  💬
                </Typography>
                <Typography variant="h4" color="primary" sx={{ mb: 2 }}>
                  대화형 계획 수립
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  AI 챗봇과 자연스러운 대화로 여행 일정을 계획하세요. 복잡한 폼 작성 없이 말로만 설명하면
                  완벽한 일정이 완성됩니다.
                </Typography>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card
                sx={{
                  p: 5,
                  textAlign: 'center',
                  border: '1px solid #e0e0e0',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-5px)',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
                  },
                }}
              >
                <Typography variant="h2" sx={{ mb: 3 }}>
                  👥
                </Typography>
                <Typography variant="h4" color="primary" sx={{ mb: 2 }}>
                  실시간 협업
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  동행자들과 실시간 채팅으로 의견을 나누고 합의된 내용이 자동으로 일정에 반영됩니다.
                </Typography>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card
                sx={{
                  p: 5,
                  textAlign: 'center',
                  border: '1px solid #e0e0e0',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-5px)',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
                  },
                }}
              >
                <Typography variant="h2" sx={{ mb: 3 }}>
                  📁
                </Typography>
                <Typography variant="h4" color="primary" sx={{ mb: 2 }}>
                  다양한 내보내기
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  완성된 일정을 PDF, 캘린더(ICS), CSV 등 다양한 형태로 내보내서 어디서든 확인하세요.
                </Typography>
              </Card>
            </Grid>
          </Grid>
        </Box>

        {/* Travel Info Section */}
        <Box sx={{ bgcolor: '#f8f9fa', py: 8, px: 5, borderRadius: '15px', mb: 10 }}>
          <Typography variant="h2" align="center" sx={{ mb: 2 }}>
            통합 여행 정보
          </Typography>
          <Typography variant="h6" align="center" color="text.secondary" sx={{ mb: 6 }}>
            여행에 필요한 모든 정보를 한눈에
          </Typography>

          <Grid container spacing={3}>
            {[
              { icon: '✈️', title: '항공권', desc: '실시간 항공료 비교' },
              { icon: '🏨', title: '숙소', desc: '지역별 추천 숙소' },
              { icon: '🍽️', title: '맛집', desc: '현지 맛집 추천' },
              { icon: '⭐', title: '관광지', desc: '인기 관광명소' },
            ].map((item, idx) => (
              <Grid item xs={12} sm={6} md={3} key={idx}>
                <Card
                  sx={{
                    p: 4,
                    textAlign: 'center',
                    transition: 'transform 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-3px)',
                    },
                  }}
                >
                  <Typography variant="h2" sx={{ mb: 2 }}>
                    {item.icon}
                  </Typography>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    {item.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {item.desc}
                  </Typography>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* CTA Section */}
        <Box sx={{ textAlign: 'center', mb: 10 }}>
          <Typography variant="h2" sx={{ mb: 2 }}>
            지금 시작해보세요
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 5 }}>
            간단한 회원가입으로 AI 여행 플래너를 무료로 이용하세요
          </Typography>
          <Box>
            <Button
              variant="contained"
              size="large"
              onClick={handleStartPlanning}
              sx={{ mr: 2, fontSize: '1.1rem', px: 4, py: 2 }}
            >
              무료로 시작하기
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => router.push('/planner')}
              sx={{ fontSize: '1.1rem', px: 4, py: 2 }}
            >
              더 알아보기
            </Button>
          </Box>
        </Box>

        {/* Footer */}
        <Box
          sx={{
            bgcolor: '#2c3e50',
            color: 'white',
            py: 6,
            px: 5,
            borderRadius: '15px',
            mb: 4,
          }}
        >
          <Grid container spacing={5}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" sx={{ color: '#3498db', mb: 2 }}>
                TriPlan
              </Typography>
              <Typography variant="body1" sx={{ color: '#bdc3c7', lineHeight: 1.8 }}>
                AI 기반 대화형 여행 일정 추천 서비스
                <br />
                LeCun 팀에서 개발했습니다.
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" sx={{ color: '#3498db', mb: 2 }}>
                문의
              </Typography>
              <Typography variant="body1" sx={{ color: '#bdc3c7', lineHeight: 1.8 }}>
                이메일: lecun2222@gmail.com
                <br />
                전화: 010-0000-0000
              </Typography>
            </Grid>
          </Grid>
        </Box>
      </Container>
    </>
  );
}
