import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  AppBar,
  Toolbar,
  Card,
  CardContent,
  CardActions,
  Grid,
  CircularProgress,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import { useRouter } from 'next/router';
import { useAuth } from '../src/hooks/useAuth';
import tripAPI, { TripPlan } from '../src/services/tripAPI';
import AddIcon from '@mui/icons-material/Add';
import GroupIcon from '@mui/icons-material/Group';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import Calendar from '../src/components/planner/Calendar';

export default function Trips() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const [trips, setTrips] = useState<TripPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTripTitle, setNewTripTitle] = useState('');
  const [newTripStartDate, setNewTripStartDate] = useState<Date | null>(null);
  const [newTripEndDate, setNewTripEndDate] = useState<Date | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login?redirect=/trips');
    }
  }, [isAuthenticated, router]);

  // Load trips
  useEffect(() => {
    if (isAuthenticated) {
      loadTrips();
    }
  }, [isAuthenticated]);

  const loadTrips = async () => {
    try {
      setLoading(true);
      const data = await tripAPI.getTrips();
      setTrips(data);
    } catch (error) {
      console.error('Failed to load trips:', error);
    } finally {
      setLoading(false);
    }
  };

  // Date formatting helper
  const formatDateForDB = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleDateSelect = (start: Date | null, end: Date | null) => {
    setNewTripStartDate(start);
    setNewTripEndDate(end);
  };

  const handleCreateTrip = async () => {
    if (!newTripTitle || !newTripStartDate || !newTripEndDate) {
      alert('여행 제목과 날짜를 모두 입력해주세요.');
      return;
    }

    try {
      const newTrip = await tripAPI.createTrip({
        title: newTripTitle,
        start_date: formatDateForDB(newTripStartDate),
        end_date: formatDateForDB(newTripEndDate),
        party_size: 1, // 기본값 1로 설정
        status: 'draft',
      });

      // Redirect to planner with new trip using invite_code
      if (newTrip.invite_code) {
        router.push(`/planner/${newTrip.invite_code}`);
      } else {
        alert('여행이 생성되었습니다.');
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to create trip:', error);
      alert('여행 생성에 실패했습니다.');
    }
  };

  const handleDeleteTrip = async (tripId: number) => {
    if (!window.confirm('정말로 이 여행을 삭제하시겠습니까?')) {
      return;
    }

    try {
      await tripAPI.deleteTrip(tripId);
      loadTrips();
    } catch (error) {
      console.error('Failed to delete trip:', error);
      alert('여행 삭제에 실패했습니다. 여행의 소유자만 삭제할 수 있습니다.');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'default';
      case 'confirmed':
        return 'success';
      case 'archived':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return '계획 중';
      case 'confirmed':
        return '확정됨';
      case 'archived':
        return '보관됨';
      default:
        return status;
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f8f9fa' }}>
      <AppBar position="static" color="transparent" elevation={1} sx={{ bgcolor: 'white', borderBottom: '1px solid #eee' }}>
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Typography
            onClick={() => router.push('/')}
            variant="h6"
            sx={{
              color: 'primary.main',
              fontWeight: 'bold',
              fontSize: '1.5rem',
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            Triplan
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Typography variant="body1" sx={{ mr: 1, color: '#333' }}>
              {user?.email} 님
            </Typography>
            <Button
              variant="outlined"
              color="primary"
              size="small"
              onClick={() => {
                logout();
                router.push('/');
              }}
            >
              로그아웃
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      <Box sx={{ maxWidth: 1200, mx: 'auto', p: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 600, color: '#333', mb: 1 }}>
              내 여행 목록
            </Typography>
            <Typography variant="body2" sx={{ color: '#666' }}>
              여행을 선택하거나 새로운 여행을 만들어보세요
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="large"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
            sx={{ px: 3 }}
          >
            새 여행 만들기
          </Button>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : trips.length === 0 ? (
          <Box
            sx={{
              textAlign: 'center',
              py: 8,
              bgcolor: 'white',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}
          >
            <Typography variant="h6" sx={{ color: '#999', mb: 2 }}>
              아직 여행이 없습니다
            </Typography>
            <Typography variant="body2" sx={{ color: '#999', mb: 3 }}>
              새로운 여행을 만들어 계획을 시작하세요!
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
            >
              첫 여행 만들기
            </Button>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {trips.map((trip) => (
              <Grid item xs={12} sm={6} md={4} key={trip.trip_idx}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    },
                  }}
                >
                  <CardContent sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, color: '#333', flex: 1 }}>
                        {trip.title}
                      </Typography>
                      <Chip
                        label={getStatusLabel(trip.status)}
                        color={getStatusColor(trip.status)}
                        size="small"
                      />
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                      <CalendarTodayIcon sx={{ fontSize: 18, color: '#666' }} />
                      <Typography variant="body2" sx={{ color: '#666' }}>
                        {formatDate(trip.start_date)} ~ {formatDate(trip.end_date)}
                      </Typography>
                    </Box>

                    {trip.party_size && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <GroupIcon sx={{ fontSize: 18, color: '#666' }} />
                        <Typography variant="body2" sx={{ color: '#666' }}>
                          {trip.party_size}명
                        </Typography>
                      </Box>
                    )}

                    {trip.budget_amount && (
                      <Box sx={{ mt: 1.5, p: 1.5, bgcolor: '#f8f9fa', borderRadius: '8px' }}>
                        <Typography variant="body2" sx={{ color: '#333', fontWeight: 500 }}>
                          예산: {trip.budget_currency} {trip.budget_amount.toLocaleString()}
                        </Typography>
                      </Box>
                    )}
                  </CardContent>

                  <CardActions sx={{ p: 2, pt: 0 }}>
                    <Button
                      size="small"
                      variant="contained"
                      fullWidth
                      onClick={() => {
                        if (trip.invite_code) {
                          router.push(`/planner/${trip.invite_code}`);
                        } else {
                          alert('초대 코드가 생성되지 않았습니다.');
                        }
                      }}
                    >
                      여행 보기
                    </Button>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDeleteTrip(trip.trip_idx)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      {/* Create Trip Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => {
          setCreateDialogOpen(false);
          setNewTripTitle('');
          setNewTripStartDate(null);
          setNewTripEndDate(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>새 여행 만들기</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
            <TextField
              label="여행 제목"
              fullWidth
              value={newTripTitle}
              onChange={(e) => setNewTripTitle(e.target.value)}
              placeholder="예: 도쿄 여행"
            />

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, color: '#666' }}>
                여행 날짜 선택
              </Typography>
              <Calendar
                onDateSelect={handleDateSelect}
                selectedStart={newTripStartDate}
                selectedEnd={newTripEndDate}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setCreateDialogOpen(false);
            setNewTripTitle('');
            setNewTripStartDate(null);
            setNewTripEndDate(null);
          }}>
            취소
          </Button>
          <Button
            onClick={handleCreateTrip}
            variant="contained"
            disabled={!newTripTitle || !newTripStartDate || !newTripEndDate}
          >
            만들기
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
