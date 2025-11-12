import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  LinearProgress,
  Alert,
  CircularProgress,
  IconButton,
} from '@mui/material';
import { Upload, Refresh, Stop } from '@mui/icons-material';
import youtubeCrawlerAPI, { YouTubeCrawlerJob } from '../../services/youtubeCrawlerAPI';

export default function YouTubeCrawler() {
  const [jobs, setJobs] = useState<YouTubeCrawlerJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadJobs();

    // 자동 새로고침 (5초마다)
    const interval = setInterval(() => {
      if (autoRefresh) {
        loadJobs();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const loadJobs = async () => {
    try {
      setLoading(true);
      const data = await youtubeCrawlerAPI.getJobs();
      setJobs(data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load jobs:', err);
      setError(err.response?.data?.error || 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 파일 확장자 검증
    if (!file.name.endsWith('.txt')) {
      setError('Only .txt files are allowed');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setSuccess(null);

      const result = await youtubeCrawlerAPI.uploadFile(file);

      setSuccess(result.message);
      loadJobs(); // 목록 새로고침
    } catch (err: any) {
      console.error('Failed to upload file:', err);
      setError(err.response?.data?.error || 'Failed to upload file');
    } finally {
      setUploading(false);
      // input 초기화
      event.target.value = '';
    }
  };

  const handleCancelJob = async (jobIdx: number) => {
    if (!confirm(`Job #${jobIdx}를 중지하시겠습니까?`)) {
      return;
    }

    try {
      await youtubeCrawlerAPI.cancelJob(jobIdx);
      setSuccess(`Job #${jobIdx}가 중지되었습니다.`);
      loadJobs();
    } catch (err: any) {
      console.error('Failed to cancel job:', err);
      setError(err.response?.data?.error || 'Failed to cancel job');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'default';
      case 'processing':
        return 'primary';
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return '대기중';
      case 'processing':
        return '처리중';
      case 'completed':
        return '완료';
      case 'failed':
        return '실패';
      default:
        return status;
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    if (seconds < 60) return `${Math.floor(seconds)}초`;
    if (seconds < 3600) {
      const min = Math.floor(seconds / 60);
      const sec = Math.floor(seconds % 60);
      return `${min}분 ${sec}초`;
    }
    const hours = Math.floor(seconds / 3600);
    const min = Math.floor((seconds % 3600) / 60);
    return `${hours}시간 ${min}분`;
  };

  return (
    <Box>
      {/* Upload Section */}
      <Card elevation={2} sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            🎬 YouTube 여행 일정 크롤러
          </Typography>

          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>사용 방법:</strong> data.txt 파일을 업로드하면 자동으로 크롤링이 시작됩니다.
              <br />
              형식: <code>(위치) YouTube_URL</code> (예: <code>(서울) https://youtu.be/...</code>)
            </Typography>
          </Alert>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              variant="contained"
              component="label"
              startIcon={uploading ? <CircularProgress size={20} /> : <Upload />}
              disabled={uploading}
              sx={{ bgcolor: '#364C84' }}
            >
              {uploading ? '업로드 중...' : 'data.txt 업로드'}
              <input type="file" hidden accept=".txt" onChange={handleFileUpload} />
            </Button>

            <IconButton onClick={loadJobs} disabled={loading}>
              <Refresh />
            </IconButton>

            <Typography variant="body2" color="text.secondary">
              {autoRefresh ? '자동 새로고침 활성화 (5초마다)' : '자동 새로고침 비활성화'}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Jobs Table */}
      <Card elevation={2}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            📊 크롤링 작업 목록
          </Typography>

          {loading && jobs.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : jobs.length === 0 ? (
            <Alert severity="info">아직 크롤링 작업이 없습니다. 위에서 파일을 업로드하세요.</Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                    <TableCell><strong>Job ID</strong></TableCell>
                    <TableCell><strong>상태</strong></TableCell>
                    <TableCell><strong>진행률</strong></TableCell>
                    <TableCell><strong>URL 수</strong></TableCell>
                    <TableCell><strong>성공/실패</strong></TableCell>
                    <TableCell><strong>소요 시간</strong></TableCell>
                    <TableCell><strong>생성 시간</strong></TableCell>
                    <TableCell><strong>작업</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.job_idx} hover>
                      <TableCell>#{job.job_idx}</TableCell>
                      <TableCell>
                        <Chip
                          label={getStatusLabel(job.status)}
                          color={getStatusColor(job.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ width: '100%' }}>
                          <LinearProgress
                            variant="determinate"
                            value={job.progress_percent}
                            sx={{ mb: 0.5 }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {job.progress_percent}% ({job.processed_count}/{job.total_urls})
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>{job.total_urls}</TableCell>
                      <TableCell>
                        <Typography
                          component="span"
                          sx={{ color: '#4caf50', fontWeight: 600, mr: 1 }}
                        >
                          ✓ {job.success_count}
                        </Typography>
                        <Typography
                          component="span"
                          sx={{ color: '#f44336', fontWeight: 600 }}
                        >
                          ✗ {job.fail_count}
                        </Typography>
                      </TableCell>
                      <TableCell>{formatDuration(job.duration_seconds)}</TableCell>
                      <TableCell>
                        {new Date(job.created_at).toLocaleString('ko-KR')}
                      </TableCell>
                      <TableCell>
                        {(job.status === 'pending' || job.status === 'processing') && (
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleCancelJob(job.job_idx)}
                            title="작업 중지"
                          >
                            <Stop />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
