import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  TextField,
  MenuItem,
  CircularProgress,
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import api from '../../services/api';

interface Trip {
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
  owner_name: string | null;
  invite_code: string;
  country_name: string | null;
  province_name: string | null;
  city_name: string | null;
}

interface ChatRequest {
  request_idx: number;
  user_message: string;
  agent_response: string;
  tools_used: string[] | null;
  request_type: string | null;
  execution_time_ms: number | null;
  success: boolean;
  error_message: string | null;
  user_email: string | null;
  created_at: string;
}

interface TripListResponse {
  success: boolean;
  trips: Trip[];
  pagination: {
    page: number;
    page_size: number;
    total_count: number;
    total_pages: number;
  };
}

export default function TripManagement() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [satisfactionFilter, setSatisfactionFilter] = useState('all');

  // Chat request modal
  const [chatModalOpen, setChatModalOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [chatRequests, setChatRequests] = useState<ChatRequest[]>([]);
  const [loadingChatRequests, setLoadingChatRequests] = useState(false);

  useEffect(() => {
    loadTrips();
  }, [page, searchQuery, statusFilter, satisfactionFilter]);

  const loadTrips = async () => {
    try {
      setLoading(true);
      const params: any = {
        page,
        page_size: pageSize,
      };

      if (searchQuery) params.search = searchQuery;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (satisfactionFilter !== 'all') params.satisfaction = satisfactionFilter;

      const response = await api.get<TripListResponse>('/api/plans/admin/trips/', { params });

      if (response.data.success) {
        setTrips(response.data.trips);
        setTotalPages(response.data.pagination.total_pages);
        setTotalCount(response.data.pagination.total_count);
      }
    } catch (error: any) {
      console.error('Failed to load trips:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChatRequests = async (tripIdx: number) => {
    try {
      setLoadingChatRequests(true);
      const response = await api.get(`/api/plans/admin/trips/${tripIdx}/chat-logs/`);

      if (response.data.success) {
        setChatRequests(response.data.requests || []);
      }
    } catch (error: any) {
      console.error('Failed to load chat requests:', error);
    } finally {
      setLoadingChatRequests(false);
    }
  };

  const handleViewChatLogs = (trip: Trip) => {
    setSelectedTrip(trip);
    setChatModalOpen(true);
    loadChatRequests(trip.trip_idx);
  };

  const handleCloseChatModal = () => {
    setChatModalOpen(false);
    setSelectedTrip(null);
    setChatRequests([]);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1); // Reset to first page on search
  };

  const handleStatusFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStatusFilter(e.target.value);
    setPage(1);
  };

  const handleSatisfactionFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSatisfactionFilter(e.target.value);
    setPage(1);
  };

  return (
    <Box>
      <Card elevation={2}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
            전체 여행 계획 관리
          </Typography>

          {/* Filters */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <TextField
              label="검색 (제목, 이메일, 초대코드)"
              variant="outlined"
              size="small"
              value={searchQuery}
              onChange={handleSearchChange}
              sx={{ minWidth: 300 }}
            />
            <TextField
              select
              label="상태"
              size="small"
              value={statusFilter}
              onChange={handleStatusFilterChange}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="all">전체</MenuItem>
              <MenuItem value="planning">계획중</MenuItem>
              <MenuItem value="confirmed">확정됨</MenuItem>
              <MenuItem value="completed">완료됨</MenuItem>
              <MenuItem value="cancelled">취소됨</MenuItem>
            </TextField>
            <TextField
              select
              label="만족도"
              size="small"
              value={satisfactionFilter}
              onChange={handleSatisfactionFilterChange}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="all">전체</MenuItem>
              <MenuItem value="like">좋아요</MenuItem>
              <MenuItem value="dislike">아쉬워요</MenuItem>
              <MenuItem value="none">미평가</MenuItem>
            </TextField>
            <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                총 {totalCount}개
              </Typography>
            </Box>
          </Box>

          {/* Table */}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 600 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>ID</strong></TableCell>
                      <TableCell><strong>제목</strong></TableCell>
                      <TableCell><strong>소유자</strong></TableCell>
                      <TableCell><strong>목적지</strong></TableCell>
                      <TableCell><strong>기간</strong></TableCell>
                      <TableCell><strong>인원</strong></TableCell>
                      <TableCell><strong>예산</strong></TableCell>
                      <TableCell><strong>만족도</strong></TableCell>
                      <TableCell><strong>상태</strong></TableCell>
                      <TableCell><strong>초대코드</strong></TableCell>
                      <TableCell><strong>생성일</strong></TableCell>
                      <TableCell><strong>액션</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {trips.map((trip) => (
                      <TableRow key={trip.trip_idx} hover>
                        <TableCell>{trip.trip_idx}</TableCell>
                        <TableCell>{trip.title}</TableCell>
                        <TableCell>
                          {trip.owner_name || '-'}
                          <br />
                          <Typography variant="caption" color="text.secondary">
                            {trip.owner_email || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {trip.country_name || '-'}
                          {trip.province_name && ` - ${trip.province_name}`}
                          {trip.city_name && ` - ${trip.city_name}`}
                        </TableCell>
                        <TableCell>
                          {new Date(trip.start_date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} ~{' '}
                          {new Date(trip.end_date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                        </TableCell>
                        <TableCell>{trip.party_size || '-'}명</TableCell>
                        <TableCell>
                          {trip.budget ? `${(trip.budget / 10000).toFixed(0)}만원` : '-'}
                        </TableCell>
                        <TableCell>
                          {trip.user_satisfaction === 'like' && (
                            <Chip label="👍" color="success" size="small" />
                          )}
                          {trip.user_satisfaction === 'dislike' && (
                            <Chip label="👎" color="error" size="small" />
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
                          <Chip label={trip.invite_code} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>
                          {new Date(trip.created_at).toLocaleDateString('ko-KR')}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleViewChatLogs(trip)}
                          >
                            봇 명령어
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Pagination */}
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(e, newPage) => setPage(newPage)}
                  color="primary"
                />
              </Box>
            </>
          )}
        </CardContent>
      </Card>

      {/* Bot Command Log Modal */}
      <Dialog
        open={chatModalOpen}
        onClose={handleCloseChatModal}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h6">봇 명령어 로그</Typography>
              {selectedTrip && (
                <Typography variant="body2" color="text.secondary">
                  {selectedTrip.title} (ID: {selectedTrip.trip_idx})
                </Typography>
              )}
            </Box>
            <IconButton onClick={handleCloseChatModal}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent>
          {loadingChatRequests ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : chatRequests.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">
                봇 명령어 기록이 없습니다.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {chatRequests.map((request) => (
                <Card key={request.request_idx} variant="outlined">
                  <CardContent>
                    {/* Header with metadata */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {request.request_type && (
                          <Chip label={request.request_type} size="small" color="primary" />
                        )}
                        {request.success ? (
                          <Chip label="성공" size="small" color="success" />
                        ) : (
                          <Chip label="실패" size="small" color="error" />
                        )}
                        {request.execution_time_ms && (
                          <Chip label={`${request.execution_time_ms}ms`} size="small" variant="outlined" />
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(request.created_at).toLocaleString('ko-KR')}
                      </Typography>
                    </Box>

                    {/* User Message */}
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#1976d2' }}>
                        👤 사용자 메시지 ({request.user_email})
                      </Typography>
                      <Paper sx={{ p: 2, bgcolor: '#e3f2fd' }}>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {request.user_message}
                        </Typography>
                      </Paper>
                    </Box>

                    {/* Agent Response */}
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#2e7d32' }}>
                        🤖 봇 응답
                      </Typography>
                      <Paper sx={{ p: 2, bgcolor: '#f1f8f4' }}>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {request.agent_response || '(응답 없음)'}
                        </Typography>
                      </Paper>
                    </Box>

                    {/* Tools Used */}
                    {request.tools_used && request.tools_used.length > 0 && (
                      <Box sx={{ mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                          🛠️ 사용된 도구
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          {request.tools_used.map((tool, idx) => (
                            <Chip key={idx} label={tool} size="small" variant="outlined" />
                          ))}
                        </Box>
                      </Box>
                    )}

                    {/* Error Message */}
                    {request.error_message && (
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#d32f2f' }}>
                          ❌ 에러 메시지
                        </Typography>
                        <Paper sx={{ p: 2, bgcolor: '#ffebee' }}>
                          <Typography variant="body2" color="error" sx={{ whiteSpace: 'pre-wrap' }}>
                            {request.error_message}
                          </Typography>
                        </Paper>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseChatModal}>닫기</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
