/**
 * Bot Performance Monitor - 봇 응답 시간 통계 모니터링
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
} from '@mui/material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import api from '../../services/api';

interface PerformanceStats {
  period: string;
  total_stats: {
    total_requests: number;
    avg_total_time: number;
    avg_llm_time: number;
    avg_rag_time: number;
    success_count: number;
    error_count: number;
  };
  tool_stats: Array<{
    tool_used: string;
    count: number;
    avg_time: number;
    success_rate: number;
  }>;
  hourly_stats: Array<{
    hour: number;
    count: number;
    avg_time: number;
  }>;
  slow_requests: Array<{
    created_at: string;
    user_message: string;
    tool_used: string;
    total_time: number;
    success: boolean;
  }>;
}

export default function BotPerformanceMonitor() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);

  useEffect(() => {
    fetchStats();
  }, [days]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/api/chat/admin/performance/stats/?days=${days}`);
      setStats(response.data);
    } catch (err: any) {
      console.error('Failed to fetch performance stats:', err);
      setError(err.response?.data?.detail || 'Failed to load performance data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!stats) {
    return <Alert severity="info">No data available</Alert>;
  }

  const { total_stats, tool_stats, hourly_stats, slow_requests } = stats;
  const successRate = total_stats.total_requests > 0
    ? ((total_stats.success_count / total_stats.total_requests) * 100).toFixed(1)
    : '0';

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">⏱️ 봇 응답 시간 모니터링</Typography>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>기간</InputLabel>
          <Select value={days} onChange={(e) => setDays(Number(e.target.value))} label="기간">
            <MenuItem value={1}>최근 1일</MenuItem>
            <MenuItem value={7}>최근 7일</MenuItem>
            <MenuItem value={30}>최근 30일</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* 요약 통계 카드 */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={3}>
          <Card elevation={2}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                총 요청 수
              </Typography>
              <Typography variant="h4">{total_stats.total_requests}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card elevation={2}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                평균 응답 시간
              </Typography>
              <Typography variant="h4">{total_stats.avg_total_time?.toFixed(2) || 0}s</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card elevation={2}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                성공률
              </Typography>
              <Typography variant="h4" color="success.main">{successRate}%</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card elevation={2}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                에러 수
              </Typography>
              <Typography variant="h4" color="error.main">{total_stats.error_count}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 시간대별 요청 그래프 */}
      <Card elevation={2} sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            시간대별 요청 분포
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={hourly_stats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" label={{ value: '시간 (hour)', position: 'insideBottom', offset: -5 }} />
              <YAxis label={{ value: '요청 수', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#8884d8" name="요청 수" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 도구별 성능 통계 */}
      <Card elevation={2} sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            도구별 성능 통계
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                  <TableCell><strong>도구명</strong></TableCell>
                  <TableCell align="right"><strong>사용 횟수</strong></TableCell>
                  <TableCell align="right"><strong>평균 처리 시간</strong></TableCell>
                  <TableCell align="right"><strong>성공률</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tool_stats.map((tool) => (
                  <TableRow key={tool.tool_used} hover>
                    <TableCell>
                      <Chip label={tool.tool_used || 'unknown'} size="small" />
                    </TableCell>
                    <TableCell align="right">{tool.count}</TableCell>
                    <TableCell align="right">{tool.avg_time.toFixed(2)}s</TableCell>
                    <TableCell align="right">
                      <Chip
                        label={`${tool.success_rate.toFixed(1)}%`}
                        color={tool.success_rate >= 90 ? 'success' : 'warning'}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* 느린 요청 Top 10 */}
      <Card elevation={2}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            느린 요청 Top 10
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                  <TableCell><strong>시간</strong></TableCell>
                  <TableCell><strong>메시지</strong></TableCell>
                  <TableCell><strong>도구</strong></TableCell>
                  <TableCell align="right"><strong>처리 시간</strong></TableCell>
                  <TableCell><strong>상태</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {slow_requests.map((req, index) => (
                  <TableRow key={index} hover>
                    <TableCell>
                      {new Date(req.created_at).toLocaleString('ko-KR')}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                        {req.user_message}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={req.tool_used || '-'} size="small" />
                    </TableCell>
                    <TableCell align="right">
                      <strong>{req.total_time.toFixed(2)}s</strong>
                    </TableCell>
                    <TableCell>
                      {req.success ? (
                        <Chip label="성공" color="success" size="small" />
                      ) : (
                        <Chip label="실패" color="error" size="small" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}
