import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  AppBar,
  Toolbar,
  Button,
  CircularProgress,
} from '@mui/material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useAuth } from '../src/hooks/useAuth';
import api from '../src/services/api';

interface AdminStats {
  success: boolean;
  total_trips: number;
  total_users: number;
  satisfaction: {
    like: number;
    dislike: number;
    none: number;
    rate: number;
  };
  daily_creation: Array<{ date: string; count: number }>;
  satisfaction_trend: Array<{ date: string; like: number; dislike: number }>;
  trip_stats: {
    avg_duration_days: number | null;
    avg_party_size: number;
    avg_budget: number;
  };
  budget_distribution: Array<{ budget_range: string; count: number }>;
  party_distribution: Array<{ party_size: number; count: number }>;
  recent_trips: Array<{
    trip_idx: number;
    title: string;
    start_date: string;
    end_date: string;
    party_size: number | null;
    budget: number | null;
    user_satisfaction: string | null;
    status: string;
    created_at: string;
    owner_email: string | null;
  }>;
}

const COLORS = ['#364C84', '#4CAF50', '#FF9800', '#F44336', '#9C27B0', '#00BCD4'];

export default function AdminPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) {
      return;
    }

    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    loadStats();
  }, [isAuthenticated, authLoading]);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/plans/admin/statistics/');
      setStats(response.data);
    } catch (error: any) {
      console.error('Failed to load stats:', error);
      if (error.response?.status === 403) {
        setError('❌ 관리자 권한이 필요합니다. 이 페이지는 관리자만 접근할 수 있습니다.');
      } else {
        setError(error.response?.data?.error || error.response?.data?.detail || 'Failed to load statistics');
      }
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', gap: 2 }}>
        <Typography variant="h5" color="error">{error}</Typography>
        <Button variant="contained" onClick={() => router.push('/')}>
          홈으로 돌아가기
        </Button>
      </Box>
    );
  }

  if (!stats) return null;

  // 만족도 파이 차트 데이터
  const satisfactionPieData = [
    { name: '좋아요', value: stats.satisfaction.like, color: '#4CAF50' },
    { name: '아쉬워요', value: stats.satisfaction.dislike, color: '#F44336' },
    { name: '미평가', value: stats.satisfaction.none, color: '#999' },
  ].filter(item => item.value > 0);

  // 일별 생성 추이 데이터
  const dailyCreationData = stats.daily_creation.map(item => ({
    date: new Date(item.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
    count: item.count,
  }));

  // 만족도 트렌드 데이터
  const satisfactionTrendData = stats.satisfaction_trend.map(item => ({
    date: new Date(item.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
    like: item.like,
    dislike: item.dislike,
  }));

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      {/* Header */}
      <AppBar position="static" sx={{ bgcolor: '#364C84' }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 600 }}>
            Triplan 관리자 대시보드
          </Typography>
          <Button color="inherit" onClick={() => router.push('/')}>
            홈으로
          </Button>
          <Button color="inherit" onClick={() => router.push('/mypage')}>
            마이페이지
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Stats Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card elevation={2} sx={{ height: '100%' }}>
              <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  총 여행 계획
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 600, color: '#364C84', mt: 'auto' }}>
                  {stats.total_trips}
                </Typography>
                <Box sx={{ height: '24px' }}></Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card elevation={2} sx={{ height: '100%' }}>
              <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  총 사용자
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 600, color: '#364C84', mt: 'auto' }}>
                  {stats.total_users}
                </Typography>
                <Box sx={{ height: '24px' }}></Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card elevation={2} sx={{ height: '100%' }}>
              <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  만족도 (좋아요)
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 600, color: '#4caf50', mt: 'auto' }}>
                  {stats.satisfaction.like}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ height: '24px', display: 'flex', alignItems: 'center' }}>
                  {stats.satisfaction.rate.toFixed(1)}% 만족
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card elevation={2} sx={{ height: '100%' }}>
              <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  평균 여행 기간
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 600, color: '#364C84', mt: 'auto' }}>
                  {stats.trip_stats.avg_duration_days?.toFixed(1) || '0'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ height: '24px', display: 'flex', alignItems: 'center' }}>
                  일
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Charts Row 1 */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* 일별 생성 추이 */}
          <Grid item xs={12} lg={8}>
            <Card elevation={2}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                  최근 30일 여행 계획 생성 추이
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dailyCreationData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="count" stroke="#364C84" strokeWidth={2} name="생성 수" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* 만족도 파이 차트 */}
          <Grid item xs={12} lg={4}>
            <Card elevation={2}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                  사용자 만족도 분포
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={satisfactionPieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {satisfactionPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Charts Row 2 */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* 만족도 트렌드 */}
          {satisfactionTrendData.length > 0 && (
            <Grid item xs={12} lg={6}>
              <Card elevation={2}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                    만족도 트렌드 (최근 30일)
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={satisfactionTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="like" fill="#4CAF50" name="좋아요" />
                      <Bar dataKey="dislike" fill="#F44336" name="아쉬워요" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* 예산 분포 */}
          {stats.budget_distribution.length > 0 && (
            <Grid item xs={12} lg={6}>
              <Card elevation={2}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                    예산 구간별 분포
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stats.budget_distribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="budget_range" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#364C84" name="여행 수" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>

        {/* Stats Summary */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={6}>
            <Card elevation={2}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  주요 통계
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      평균 여행 인원
                    </Typography>
                    <Typography variant="h6">
                      {stats.trip_stats.avg_party_size.toFixed(1)} 명
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      평균 예산
                    </Typography>
                    <Typography variant="h6">
                      {stats.trip_stats.avg_budget > 0
                        ? `${(stats.trip_stats.avg_budget / 10000).toFixed(0)}만원`
                        : '데이터 없음'}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card elevation={2}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  개선 제안
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {stats.satisfaction.dislike > 0 && (
                    <Box sx={{ p: 2, bgcolor: '#fff3e0', borderRadius: 1 }}>
                      <Typography variant="body2">
                        ⚠️ {stats.satisfaction.dislike}개의 여행이 부정적 피드백을 받았습니다. 개선이 필요합니다.
                      </Typography>
                    </Box>
                  )}
                  {stats.satisfaction.none > stats.total_trips * 0.5 && (
                    <Box sx={{ p: 2, bgcolor: '#e3f2fd', borderRadius: 1 }}>
                      <Typography variant="body2">
                        ℹ️ 많은 여행이 만족도 평가를 받지 않았습니다. 피드백 수집 프로세스를 개선하세요.
                      </Typography>
                    </Box>
                  )}
                  {stats.satisfaction.rate > 70 && (
                    <Box sx={{ p: 2, bgcolor: '#e8f5e9', borderRadius: 1 }}>
                      <Typography variant="body2">
                        ✅ 높은 만족도를 유지하고 있습니다! 계속 좋은 서비스를 제공하세요.
                      </Typography>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Recent Trips Table */}
        <Card elevation={2}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
              최근 여행 계획 (20개)
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 600 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                    <TableCell><strong>ID</strong></TableCell>
                    <TableCell><strong>제목</strong></TableCell>
                    <TableCell><strong>소유자</strong></TableCell>
                    <TableCell><strong>기간</strong></TableCell>
                    <TableCell><strong>인원</strong></TableCell>
                    <TableCell><strong>예산</strong></TableCell>
                    <TableCell><strong>만족도</strong></TableCell>
                    <TableCell><strong>상태</strong></TableCell>
                    <TableCell><strong>생성일</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stats.recent_trips.map((trip) => (
                    <TableRow key={trip.trip_idx} hover>
                      <TableCell>{trip.trip_idx}</TableCell>
                      <TableCell>{trip.title}</TableCell>
                      <TableCell>{trip.owner_email || '-'}</TableCell>
                      <TableCell>
                        {new Date(trip.start_date).toLocaleDateString()} ~ {new Date(trip.end_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{trip.party_size || '-'}명</TableCell>
                      <TableCell>
                        {trip.budget ? `${(trip.budget / 10000).toFixed(0)}만원` : '-'}
                      </TableCell>
                      <TableCell>
                        {trip.user_satisfaction === 'like' && (
                          <Chip label="👍 좋아요" color="success" size="small" />
                        )}
                        {trip.user_satisfaction === 'dislike' && (
                          <Chip label="👎 아쉬워요" color="error" size="small" />
                        )}
                        {!trip.user_satisfaction && (
                          <Chip label="미평가" size="small" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={trip.status}
                          size="small"
                          color={trip.status === 'confirmed' ? 'primary' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        {new Date(trip.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
