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
  Tabs,
  Tab,
  Avatar,
  Divider,
  Paper,
} from '@mui/material';
import { useRouter } from 'next/router';
import { useAuth } from '../src/hooks/useAuth';
import tripAPI, { TripPlan, TripMember } from '../src/services/tripAPI';
import AddIcon from '@mui/icons-material/Add';
import GroupIcon from '@mui/icons-material/Group';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonIcon from '@mui/icons-material/Person';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import BarChartIcon from '@mui/icons-material/BarChart';
import Calendar from '../src/components/planner/Calendar';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export default function MyPage() {
  const router = useRouter();
  const { user, isAuthenticated, logout, loading: authLoading } = useAuth();
  const [trips, setTrips] = useState<TripPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [newTripTitle, setNewTripTitle] = useState('');
  const [newTripStartDate, setNewTripStartDate] = useState<Date | null>(null);
  const [newTripEndDate, setNewTripEndDate] = useState<Date | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=/mypage');
    }
  }, [isAuthenticated, authLoading, router]);

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
      console.log('🔍 loadTrips - Raw data:', data);
      console.log('🔍 loadTrips - Data length:', data?.length);
      console.log('🔍 loadTrips - First trip:', data?.[0]);
      setTrips(data || []);
    } catch (error) {
      console.error('Failed to load trips:', error);
      setTrips([]);
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

      setCreateDialogOpen(false);
      setNewTripTitle('');
      setNewTripStartDate(null);
      setNewTripEndDate(null);

      // Redirect to planner with new trip using invite_code
      if (newTrip.invite_code) {
        router.push(`/planner/${newTrip.invite_code}`);
      } else {
        // Fallback: if no invite_code yet, wait a moment and reload
        alert('여행이 생성되었습니다. 잠시 후 이동합니다.');
        setTimeout(() => {
          window.location.href = '/mypage';
        }, 1000);
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

  const handleLeaveTrip = async (tripId: number) => {
    if (!window.confirm('이 여행에서 나가시겠습니까?')) {
      return;
    }

    try {
      await tripAPI.leaveTrip(tripId);
      loadTrips();
    } catch (error) {
      console.error('Failed to leave trip:', error);
      alert('여행 나가기에 실패했습니다.');
    }
  };

  const handleShareTrip = async (trip: TripPlan) => {
    if (!trip.invite_code) {
      alert('초대 코드가 생성되지 않았습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    // Generate shareable URL
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/planner/${trip.invite_code}`;

    // Copy to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert(`공유 링크가 복사되었습니다!\n\n${shareUrl}\n\n이 링크를 친구들과 공유하세요.`);
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert(`공유 링크가 복사되었습니다!\n\n${shareUrl}\n\n이 링크를 친구들과 공유하세요.`);
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

  // Filter trips by ownership
  const safeTrips = Array.isArray(trips) ? trips : [];
  console.log('🔍 Filter - safeTrips:', safeTrips);
  console.log('🔍 Filter - user:', user);
  console.log('🔍 Filter - user.user_idx:', user?.user_idx);
  const myTrips = safeTrips.filter((trip) => {
    console.log('🔍 Filtering trip:', trip.trip_idx, 'owner:', trip.owner_user_idx, 'user:', user?.user_idx, 'match:', trip.owner_user_idx === user?.user_idx);
    return trip.owner_user_idx === user?.user_idx;
  });
  const sharedTrips = safeTrips.filter((trip) => trip.owner_user_idx !== user?.user_idx);
  console.log('🔍 Filter result - myTrips:', myTrips.length, 'sharedTrips:', sharedTrips.length);

  // Calculate statistics
  const totalTrips = safeTrips.length;
  const draftTrips = safeTrips.filter((t) => t.status === 'draft').length;
  const confirmedTrips = safeTrips.filter((t) => t.status === 'confirmed').length;
  const archivedTrips = safeTrips.filter((t) => t.status === 'archived').length;

  // Show loading or redirect
  if (authLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const renderTripCard = (trip: TripPlan, isOwner: boolean) => (
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
            <Box sx={{ display: 'flex', gap: 0.5, flexDirection: 'column', alignItems: 'flex-end' }}>
              <Chip label={getStatusLabel(trip.status)} color={getStatusColor(trip.status)} size="small" />
              {!isOwner && (
                <Chip label="공유받음" color="info" size="small" variant="outlined" />
              )}
            </Box>
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

        <CardActions sx={{ p: 2, pt: 0, display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button
            size="small"
            variant="contained"
            sx={{ flex: '0 0 auto', minWidth: '90px' }}
            onClick={() => {
              // Use invite_code only (required)
              if (trip.invite_code) {
                router.push(`/planner/${trip.invite_code}`);
              } else {
                alert('초대 코드가 생성되지 않았습니다. 잠시 후 다시 시도해주세요.');
              }
            }}
          >
            보기
          </Button>
          <Button
            size="small"
            variant="outlined"
            sx={{ flex: '0 0 auto', minWidth: '70px' }}
            onClick={() => handleShareTrip(trip)}
            title="공유 링크 복사"
          >
            공유
          </Button>
          {isOwner ? (
            <IconButton size="small" color="error" onClick={() => handleDeleteTrip(trip.trip_idx)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          ) : (
            <IconButton size="small" color="warning" onClick={() => handleLeaveTrip(trip.trip_idx)}>
              <ExitToAppIcon fontSize="small" />
            </IconButton>
          )}
        </CardActions>
      </Card>
    </Grid>
  );

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
        {/* Profile Section */}
        <Paper sx={{ p: 4, mb: 4, borderRadius: '12px' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 3 }}>
            <Avatar
              sx={{
                width: 80,
                height: 80,
                bgcolor: 'primary.main',
                fontSize: '2rem',
              }}
            >
              {user?.email?.[0].toUpperCase() || 'U'}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
                {user?.email}
              </Typography>
              <Typography variant="body2" sx={{ color: '#666' }}>
                회원님의 여행을 관리해보세요
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

          <Divider sx={{ my: 3 }} />

          {/* Statistics */}
          <Grid container spacing={3}>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#f8f9fa', borderRadius: '8px' }}>
                <Typography variant="h3" sx={{ color: 'primary.main', fontWeight: 600, mb: 0.5 }}>
                  {totalTrips}
                </Typography>
                <Typography variant="body2" sx={{ color: '#666' }}>
                  전체 여행
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#f8f9fa', borderRadius: '8px' }}>
                <Typography variant="h3" sx={{ color: '#ffa726', fontWeight: 600, mb: 0.5 }}>
                  {draftTrips}
                </Typography>
                <Typography variant="body2" sx={{ color: '#666' }}>
                  계획 중
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#f8f9fa', borderRadius: '8px' }}>
                <Typography variant="h3" sx={{ color: '#66bb6a', fontWeight: 600, mb: 0.5 }}>
                  {confirmedTrips}
                </Typography>
                <Typography variant="body2" sx={{ color: '#666' }}>
                  확정됨
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#f8f9fa', borderRadius: '8px' }}>
                <Typography variant="h3" sx={{ color: '#999', fontWeight: 600, mb: 0.5 }}>
                  {archivedTrips}
                </Typography>
                <Typography variant="body2" sx={{ color: '#666' }}>
                  보관됨
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {/* Trips Section with Tabs */}
        <Paper sx={{ borderRadius: '12px', overflow: 'hidden' }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'white' }}>
            <Tabs
              value={tabValue}
              onChange={(e, newValue) => setTabValue(newValue)}
              sx={{ px: 2 }}
            >
              <Tab
                label={`내가 만든 여행 (${myTrips.length})`}
                icon={<PersonIcon />}
                iconPosition="start"
              />
              <Tab
                label={`초대받은 여행 (${sharedTrips.length})`}
                icon={<GroupIcon />}
                iconPosition="start"
              />
            </Tabs>
          </Box>

          <Box sx={{ p: 3 }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                <TabPanel value={tabValue} index={0}>
                  {myTrips.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 8 }}>
                      <Typography variant="h6" sx={{ color: '#999', mb: 2 }}>
                        아직 만든 여행이 없습니다
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
                      {myTrips.map((trip) => renderTripCard(trip, true))}
                    </Grid>
                  )}
                </TabPanel>

                <TabPanel value={tabValue} index={1}>
                  {sharedTrips.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 8 }}>
                      <Typography variant="h6" sx={{ color: '#999', mb: 2 }}>
                        초대받은 여행이 없습니다
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#999' }}>
                        친구들이 보낸 초대 코드로 여행에 참여해보세요!
                      </Typography>
                    </Box>
                  ) : (
                    <Grid container spacing={3}>
                      {sharedTrips.map((trip) => renderTripCard(trip, false))}
                    </Grid>
                  )}
                </TabPanel>
              </>
            )}
          </Box>
        </Paper>
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
          <Button
            onClick={() => {
              setCreateDialogOpen(false);
              setNewTripTitle('');
              setNewTripStartDate(null);
              setNewTripEndDate(null);
            }}
          >
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
