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
  TextField,
  Pagination,
  Link,
} from '@mui/material';
import { Upload, Refresh, Stop, Search, OpenInNew } from '@mui/icons-material';
import youtubeCrawlerAPI, { YouTubeCrawlerJob } from '../../services/youtubeCrawlerAPI';

export default function YouTubeCrawler() {
  const [jobs, setJobs] = useState<YouTubeCrawlerJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // 수집된 데이터 조회 state
  const [collectedData, setCollectedData] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, page_size: 20, total_pages: 0 });

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
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // 파일 확장자 검증
    const invalidFiles = Array.from(files).filter(file => !file.name.endsWith('.txt'));
    if (invalidFiles.length > 0) {
      setError(`Only .txt files are allowed. Invalid files: ${invalidFiles.map(f => f.name).join(', ')}`);
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setSuccess(null);

      // 여러 파일 순차적으로 업로드
      const results = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const result = await youtubeCrawlerAPI.uploadFile(file);
          results.push(`✓ ${file.name}: ${result.message}`);
        } catch (err: any) {
          results.push(`✗ ${file.name}: ${err.response?.data?.error || 'Failed'}`);
        }
      }

      setSuccess(`${files.length}개 파일 업로드 완료:\n${results.join('\n')}`);
      loadJobs(); // 목록 새로고침
    } catch (err: any) {
      console.error('Failed to upload files:', err);
      setError(err.response?.data?.error || 'Failed to upload files');
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

  const loadCollectedData = async () => {
    try {
      setDataLoading(true);
      const result = await youtubeCrawlerAPI.getCollectedData({
        location: locationSearch,
        page: currentPage,
        page_size: 20,
      });
      setCollectedData(result.data);
      setPagination(result.pagination);
    } catch (err: any) {
      console.error('Failed to load collected data:', err);
    } finally {
      setDataLoading(false);
    }
  };

  const handleSearchCollectedData = () => {
    setCurrentPage(1);
    loadCollectedData();
  };

  const handlePageChange = (_event: React.ChangeEvent<unknown>, page: number) => {
    setCurrentPage(page);
  };

  useEffect(() => {
    loadCollectedData();
  }, [currentPage]);

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
              <strong>사용 방법:</strong> data.txt 파일을 업로드하면 자동으로 크롤링이 시작됩니다. (여러 파일 동시 선택 가능)
              <br />
              파일 형식: 첫 줄에 지역명, 그 다음 줄부터 YouTube URL (한 줄에 하나씩)
              <br />
              예시: <code>서울<br />https://youtu.be/...<br />https://youtu.be/...</code>
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
              {uploading ? '업로드 중...' : '파일 업로드 (다중 선택 가능)'}
              <input type="file" hidden accept=".txt" multiple onChange={handleFileUpload} />
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
                    <TableCell><strong>지역</strong></TableCell>
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
                        <Typography variant="body2" sx={{ fontWeight: 500, color: '#364C84' }}>
                          {job.location || '-'}
                        </Typography>
                      </TableCell>
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

      {/* Collected Data Section */}
      <Card elevation={2} sx={{ mt: 4 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            📁 수집된 데이터 조회
          </Typography>

          <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="지역명으로 검색 (예: 서울, 강남구)"
              value={locationSearch}
              onChange={(e) => setLocationSearch(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearchCollectedData()}
              sx={{ flexGrow: 1, maxWidth: 400 }}
            />
            <Button
              variant="contained"
              startIcon={<Search />}
              onClick={handleSearchCollectedData}
              sx={{ bgcolor: '#364C84' }}
            >
              검색
            </Button>
            <IconButton onClick={loadCollectedData} disabled={dataLoading}>
              <Refresh />
            </IconButton>
          </Box>

          {dataLoading && collectedData.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : collectedData.length === 0 ? (
            <Alert severity="info">수집된 데이터가 없습니다.</Alert>
          ) : (
            <>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                      <TableCell><strong>ID</strong></TableCell>
                      <TableCell><strong>제목</strong></TableCell>
                      <TableCell><strong>채널</strong></TableCell>
                      <TableCell><strong>지역</strong></TableCell>
                      <TableCell><strong>업로드</strong></TableCell>
                      <TableCell><strong>조회수</strong></TableCell>
                      <TableCell><strong>파싱 여부</strong></TableCell>
                      <TableCell><strong>링크</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {collectedData.map((item) => (
                      <TableRow key={item.id} hover>
                        <TableCell>{item.id}</TableCell>
                        <TableCell sx={{ maxWidth: 300 }}>
                          <Typography variant="body2" noWrap title={item.title}>
                            {item.title}
                          </Typography>
                        </TableCell>
                        <TableCell>{item.channel || '-'}</TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                            {item.location}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {item.upload_year && item.upload_month
                            ? `${item.upload_year}.${item.upload_month}`
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {item.views ? item.views.toLocaleString() : '-'}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={item.has_parsed_data ? '완료' : '없음'}
                            color={item.has_parsed_data ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {item.url && (
                            <Link
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                            >
                              <OpenInNew fontSize="small" />
                            </Link>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  총 {pagination.total}개 항목 (페이지 {pagination.page}/{pagination.total_pages})
                </Typography>
                <Pagination
                  count={pagination.total_pages}
                  page={currentPage}
                  onChange={handlePageChange}
                  color="primary"
                  showFirstButton
                  showLastButton
                />
              </Box>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
