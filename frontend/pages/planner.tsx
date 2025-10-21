import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  AppBar,
  Toolbar,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Snackbar,
  Alert,
} from '@mui/material';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Calendar from '../src/components/planner/Calendar';
import WeatherWidget from '../src/components/planner/WeatherWidget';
import DayPlanningCard from '../src/components/planner/DayPlanningCard';
import TimelineView from '../src/components/planner/TimelineView';
import ScheduleModal from '../src/components/planner/ScheduleModal';
import UnifiedChatWidget from '../src/components/planner/UnifiedChatWidget';
import InviteCodeModal from '../src/components/planner/InviteCodeModal';
import KakaoMap from '../src/components/planner/KakaoMap';
import {
  ScheduleItem,
  TripData,
  DayPlan,
  ViewMode,
} from '../src/types/planner';
import { destinationData } from '../src/data/mockData';
import tripAPI, { TripPlan } from '../src/services/tripAPI';
import commonAPI, { Region1 } from '../src/services/commonAPI';
import { useAuth } from '../src/hooks/useAuth';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import SaveIcon from '@mui/icons-material/Save';
import {
  savePlannerSession,
  loadPlannerSession,
  clearPlannerSession,
} from '../src/utils/plannerStorage';

const steps = [
  { id: 1, title: '날짜 확인', desc: '여행 기간 설정' },
  { id: 2, title: '일차별 계획', desc: '장소 및 일정' },
  { id: 3, title: '여행지 정보', desc: '날씨 및 필수정보' },
  { id: 4, title: '미리보기', desc: '최종 확인' },
];

export default function Planner() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();

  const [activeStep, setActiveStep] = useState(1);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [travelers, setTravelers] = useState('');
  const [tripData, setTripData] = useState<TripData>({});
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [dayPlans, setDayPlans] = useState<DayPlan[]>([]);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | undefined>(undefined);
  const [editingItem, setEditingItem] = useState<ScheduleItem | undefined>(undefined);
  const [selectedDestination, setSelectedDestination] = useState<string>('도쿄');
  const [cities, setCities] = useState<Region1[]>([]);
  const [isLoadingCities, setIsLoadingCities] = useState(false);

  // Real trip data
  const [currentTrip, setCurrentTrip] = useState<TripPlan | null>(null);
  const [tripId, setTripId] = useState<number | null>(null);
  const [isLoadingTrip, setIsLoadingTrip] = useState(false);

  // Invite modal
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  // Session management
  const [isDirty, setIsDirty] = useState(false); // 저장되지 않은 변경사항 여부
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true); // 초기 로드 여부

  // Load cities from database
  useEffect(() => {
    const loadCities = async () => {
      try {
        setIsLoadingCities(true);
        const citiesData = await commonAPI.getCities();
        setCities(citiesData);
        console.log('📍 Loaded cities from database:', citiesData.length);
      } catch (error) {
        console.error('Failed to load cities:', error);
        // Fallback to empty array
        setCities([]);
      } finally {
        setIsLoadingCities(false);
      }
    };

    loadCities();
  }, []);

  // Load trip from URL using invite code only
  useEffect(() => {
    const loadTrip = async () => {
      // Get invite code from URL query parameter
      const params = new URLSearchParams(window.location.search);
      const inviteCodeParam = params.get('inviteCode');

      if (!inviteCodeParam) {
        // Demo mode - no trip specified
        setTripId(null);
        setIsLoadingTrip(false);
        return;
      }

      try {
        setIsLoadingTrip(true);

        console.log('🔄 Loading trip by invite code:', inviteCodeParam);

        // Try to load trip first
        try {
          const trip = await tripAPI.getTripByCode(inviteCodeParam);

          console.log('✅ Trip loaded:', trip);
          console.log('📌 Setting tripId to:', trip.trip_idx);

          setCurrentTrip(trip);
          setTripId(trip.trip_idx);

          // Set dates from trip
          setStartDate(parseDateFromDB(trip.start_date));
          setEndDate(parseDateFromDB(trip.end_date));
          setTravelers(trip.party_size?.toString() || '');
          setSelectedDestination(trip.title || '도쿄');

          // Clear dirty flag - data just loaded from DB
          setIsDirty(false);
          clearPlannerSession(trip.trip_idx);
          setIsInitialLoad(false);
        } catch (loadError: any) {
          // If 403 (not a member), try to join first
          if (loadError.response?.status === 403) {
            console.log('🔑 Not a member yet, attempting to join with invite code...');

            try {
              // Join the trip using the invite code
              const joinResult = await tripAPI.joinByCode(inviteCodeParam);
              console.log('✅ Successfully joined trip:', joinResult);

              // Now try to load the trip again
              const trip = await tripAPI.getTripByCode(inviteCodeParam);

              console.log('✅ Trip loaded after joining:', trip);
              console.log('📌 Setting tripId to:', trip.trip_idx);

              setCurrentTrip(trip);
              setTripId(trip.trip_idx);

              // Set dates from trip
              setStartDate(parseDateFromDB(trip.start_date));
              setEndDate(parseDateFromDB(trip.end_date));
              setTravelers(trip.party_size?.toString() || '');
              setSelectedDestination(trip.title || '도쿄');

              // Clear dirty flag - data just loaded from DB
              setIsDirty(false);
              clearPlannerSession(trip.trip_idx);
              setIsInitialLoad(false);

              alert('여행에 성공적으로 참여했습니다!');
            } catch (joinError: any) {
              console.error('Failed to join trip:', joinError);
              throw joinError; // Re-throw to outer catch
            }
          } else {
            throw loadError; // Re-throw other errors to outer catch
          }
        }
      } catch (error: any) {
        console.error('Failed to load trip:', error);

        // Show error message to user
        if (error.response?.status === 403) {
          alert('이 여행에 접근 권한이 없습니다.');
        } else if (error.response?.status === 404) {
          alert('유효하지 않거나 만료된 초대 코드입니다.');
        } else {
          alert('여행 정보를 불러올 수 없습니다.');
        }

        // Redirect to mypage
        router.push('/mypage');
      } finally {
        setIsLoadingTrip(false);
      }
    };

    loadTrip();
  }, [router]);

  useEffect(() => {
    if (startDate && endDate) {
      const days: DayPlan[] = [];
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      for (let i = 0; i < totalDays; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dayNumber = i + 1;

        days.push({
          dayNumber,
          date: formatDateForDisplay(date),
          schedules: tripData[dayNumber] || [],
        });
      }

      setDayPlans(days);
    }
  }, [startDate, endDate, tripData]);

  const formatDateForDisplay = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const dayName = dayNames[date.getDay()];
    return `${year}-${month}-${day} (${dayName})`;
  };

  const formatDateForDB = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };


  const parseDateFromDB = (dateString: string): Date => {
    // "2025-01-20" -> Date object in local timezone
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  };
  const getTotalDays = (): number => {
    if (!startDate || !endDate) return 0;
    return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  const getSeasonInfo = (): string => {
    if (!startDate) return '계절별 여행 팁도 확인하세요!';
    const month = startDate.getMonth() + 1;
    if (month >= 3 && month <= 5) return '🌸 봄철 여행 - 꽃구경과 온화한 날씨를 즐기세요!';
    if (month >= 6 && month <= 8) return '☀️ 여름철 여행 - 시원한 곳을 찾아보세요!';
    if (month >= 9 && month <= 11) return '🍂 가을철 여행 - 단풍과 선선한 날씨가 좋아요!';
    return '❄️ 겨울철 여행 - 따뜻한 옷을 준비하세요!';
  };

  const handleDateSelect = (start: Date | null, end: Date | null) => {
    console.log('🔵 handleDateSelect called:', { start, end, tripId });

    setStartDate(start);
    setEndDate(end);
    setIsDirty(true); // Mark as dirty when dates change

    // Initialize tripData with empty arrays for each day
    if (start && end) {
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      console.log('📅 Creating', days, 'days');
      const newTripData: TripData = {};
      for (let i = 1; i <= days; i++) {
        newTripData[i] = [];
      }
      console.log('📊 New tripData:', newTripData);
      setTripData(newTripData);
    } else {
      console.log('⚠️ No start or end date provided');
    }
  };

  const handleNextStep = () => {
    if (activeStep < 4) setActiveStep(activeStep + 1);
  };

  const handlePrevStep = () => {
    if (activeStep > 1) setActiveStep(activeStep - 1);
  };

  const handleOpenScheduleModal = (dayNumber?: number) => {
    setSelectedDay(dayNumber);
    setEditingItem(undefined);
    setScheduleModalOpen(true);
  };

  const handleEditSchedule = (dayNumber: number, itemIndex: number) => {
    const item = tripData[dayNumber]?.[itemIndex];
    if (item) {
      setSelectedDay(dayNumber);
      setEditingItem(item);
      setScheduleModalOpen(true);
    }
  };

  const handleDeleteSchedule = (dayNumber: number, itemIndex: number) => {
    if (window.confirm('이 일정을 삭제하시겠습니까?')) {
      setTripData((prev: TripData) => {
        const newData = { ...prev };
        newData[dayNumber] = newData[dayNumber].filter((_: ScheduleItem, index: number) => index !== itemIndex);
        return newData;
      });
      setIsDirty(true); // Mark as dirty when schedule is deleted
    }
  };

  const handleSaveSchedule = (item: ScheduleItem, dayNumber?: number) => {
    const targetDay = dayNumber || selectedDay || 1;

    setTripData((prev: TripData) => {
      const newData = { ...prev };
      if (!newData[targetDay]) newData[targetDay] = [];

      if (editingItem) {
        const index = newData[targetDay].findIndex(
          (i: ScheduleItem) => i.time === editingItem.time && i.location === editingItem.location
        );
        if (index !== -1) {
          newData[targetDay][index] = item;
        }
      } else {
        newData[targetDay].push(item);
        newData[targetDay].sort((a: ScheduleItem, b: ScheduleItem) => a.time.localeCompare(b.time));
      }

      return newData;
    });

    setScheduleModalOpen(false);
    setEditingItem(undefined);
    setIsDirty(true); // Mark as dirty when schedule is saved
  };

  const handleCopyPrevDay = (dayNumber: number) => {
    if (dayNumber === 1) {
      alert('첫 번째 날은 복사할 이전 일차가 없습니다.');
      return;
    }

    const prevDaySchedules = tripData[dayNumber - 1];
    if (!prevDaySchedules || prevDaySchedules.length === 0) {
      alert('이전 일차에 복사할 일정이 없습니다.');
      return;
    }

    if (window.confirm(`Day ${dayNumber - 1}의 일정을 복사하시겠습니까?`)) {
      setTripData((prev: TripData) => ({
        ...prev,
        [dayNumber]: [...prevDaySchedules],
      }));
      setIsDirty(true); // Mark as dirty when schedule is copied
    }
  };

  const handleOpenDayDetail = (dayNumber: number) => {
    handleOpenScheduleModal(dayNumber);
  };

  const toggleViewMode = () => {
    setViewMode((prev) => (prev === 'card' ? 'timeline' : 'card'));
  };

  const handleDownloadPlan = () => {
    let content = `=== 여행 계획서 ===\n\n`;
    content += `여행지: ${selectedDestination}\n`;
    content += `여행 기간: ${startDate?.toLocaleDateString()} ~ ${endDate?.toLocaleDateString()}\n`;
    content += `총 ${getTotalDays()}일\n`;
    content += `여행 인원: ${travelers}명\n\n`;

    dayPlans.forEach((day: DayPlan) => {
      content += `\n=== Day ${day.dayNumber} (${day.date}) ===\n`;
      day.schedules.forEach((schedule: ScheduleItem) => {
        content += `${schedule.time} - ${schedule.icon} ${schedule.location}\n`;
        content += `  ${schedule.description}\n`;
        if (schedule.travel) {
          content += `  이동: ${schedule.travel.method} (${schedule.travel.time}, ${schedule.travel.distance})\n`;
        }
      });
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `여행계획_${selectedDestination}_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSharePlan = () => {
    const shareText = `나의 ${selectedDestination} 여행 계획! 총 ${getTotalDays()}일 일정입니다.`;

    if (navigator.share) {
      navigator.share({
        title: '여행 계획',
        text: shareText,
      }).catch(() => {
        navigator.clipboard.writeText(shareText);
        alert('클립보드에 복사되었습니다!');
      });
    } else {
      navigator.clipboard.writeText(shareText);
      alert('클립보드에 복사되었습니다!');
    }
  };

  /**
   * 수동 저장: DB에 실제로 저장
   */
  const handleSaveToDB = async () => {
    if (!tripId) {
      alert('여행 정보를 불러올 수 없습니다.');
      return;
    }

    if (!startDate || !endDate) {
      alert('날짜를 선택해주세요.');
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);

      console.log('💾 Saving to DB...', {
        tripId,
        startDate,
        endDate,
        travelers,
        tripData,
      });

      // 1. Update trip basic info (dates, party_size, title)
      const updatedTrip = await tripAPI.updateTrip(tripId, {
        start_date: formatDateForDB(startDate),
        end_date: formatDateForDB(endDate),
        party_size: parseInt(travelers) || 1,
        title: selectedDestination,
      });

      console.log('✅ Trip info updated:', updatedTrip);

      // 2. Delete existing days for this trip
      const existingDays = await tripAPI.getDays(tripId);
      console.log('📋 Found existing days:', existingDays);
      console.log('📋 Existing days count:', existingDays?.length);

      if (existingDays && Array.isArray(existingDays)) {
        for (const day of existingDays) {
          try {
            console.log(`🗑️ Deleting Day ${day.day_no} (day_idx: ${day.day_idx})`);
            await tripAPI.deleteDay(day.day_idx);
            console.log(`✅ Deleted Day ${day.day_no}`);
          } catch (deleteError: any) {
            console.error(`❌ Failed to delete Day ${day.day_no}:`, deleteError);
            // Continue deleting other days even if one fails
          }
        }
      } else {
        console.warn('⚠️ existingDays is not an array:', existingDays);
      }

      // 3. Create new days based on current dates
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const dayMapping: { [dayNo: number]: number } = {}; // dayNo -> day_idx

      for (let i = 0; i < totalDays; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dayNo = i + 1;

        try {
          console.log('🔄 Creating day:', {
            trip_idx: tripId,
            day_no: dayNo,
            date: formatDateForDB(date),
          });

          const newDay = await tripAPI.createDay({
            trip_idx: tripId,
            day_no: dayNo,
            date: formatDateForDB(date),
          });

          dayMapping[dayNo] = newDay.day_idx;
          console.log(`✅ Created Day ${dayNo}, day_idx: ${newDay.day_idx}`);
        } catch (dayError: any) {
          console.error(`❌ Failed to create Day ${dayNo}:`, dayError);
          console.error('Error response:', dayError.response?.data);
          throw dayError;
        }
      }

      // 4. Save schedules (tripData) to DB as items
      for (const dayNo in tripData) {
        const schedules = tripData[dayNo];
        const dayIdx = dayMapping[parseInt(dayNo)];

        if (!dayIdx || !schedules || schedules.length === 0) continue;

        for (let i = 0; i < schedules.length; i++) {
          const schedule = schedules[i];
          await tripAPI.createItem({
            day_idx: dayIdx,
            item_type: 'custom',
            title: schedule.location,
            start_time: schedule.time,
            notes: schedule.description,
            order_in_day: i + 1,
            lock_flag: false,
          });
        }

        console.log(`✅ Saved ${schedules.length} items for Day ${dayNo}`);
      }

      // Clear session storage after successful save
      clearPlannerSession(tripId);
      setIsDirty(false);
      setSaveSuccess(true);

      console.log('✅ Saved to DB successfully');
    } catch (error: any) {
      console.error('❌ Failed to save to DB:', error);
      setSaveError('저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Auto-save to sessionStorage when data changes
   */
  useEffect(() => {
    // Skip if loading, initial load, or no tripId
    if (isLoadingTrip || isInitialLoad || !tripId) return;

    // Only save to sessionStorage if there are unsaved changes
    if (isDirty) {
      savePlannerSession(tripId, {
        tripData,
        startDate,
        endDate,
        travelers,
        selectedDestination,
      });
      console.log('💾 Auto-saved to sessionStorage');
    }
  }, [tripData, startDate, endDate, travelers, selectedDestination, isDirty, tripId, isLoadingTrip, isSaving, isInitialLoad]);


  /**
   * Load from sessionStorage on mount
   */
  useEffect(() => {
    if (tripId !== null) {
      const sessionData = loadPlannerSession(tripId);
      if (sessionData) {
        console.log('🔄 Restoring from session storage...');
        setTripData(sessionData.tripData);
        setStartDate(sessionData.startDate ? new Date(sessionData.startDate) : null);
        setEndDate(sessionData.endDate ? new Date(sessionData.endDate) : null);
        setTravelers(sessionData.travelers);
        setSelectedDestination(sessionData.selectedDestination);
        setIsDirty(true); // Session data means unsaved changes
      }
    }
  }, [tripId]);

  /**
   * beforeunload: Warn user before leaving with unsaved changes (browser tab close, URL change)
   */
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '저장하지 않은 변경사항이 있습니다. 정말 나가시겠습니까?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  /**
   * Next.js Router events: Warn user before navigating away with unsaved changes
   */
  useEffect(() => {
    const handleRouteChange = (url: string) => {
      if (isDirty) {
        const confirmed = window.confirm(
          '저장하지 않은 변경사항이 있습니다.\n저장하지 않고 페이지를 나가시겠습니까?'
        );
        if (!confirmed) {
          router.events.emit('routeChangeError');
          throw 'Route change aborted by user';
        }
      }
    };

    router.events.on('routeChangeStart', handleRouteChange);

    return () => {
      router.events.off('routeChangeStart', handleRouteChange);
    };
  }, [isDirty, router]);

  const renderStepContent = () => {
    switch (activeStep) {
      case 1:
        return (
          <Box>
            <Typography variant="h4" sx={{ color: 'primary.main', mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              📅 여행 날짜 확인
            </Typography>

            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" sx={{ mb: 2, fontWeight: 600 }}>
                언제 여행을 떠나시나요?
              </Typography>

              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <Box sx={{ flex: 1, p: 2, bgcolor: startDate ? '#e3f2fd' : '#f8f9fa', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
                  <Typography variant="caption" sx={{ color: '#666', display: 'block', mb: 0.5 }}>
                    출발일
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600, color: startDate ? 'primary.main' : '#999' }}>
                    {startDate ? formatDateForDisplay(startDate) : '날짜를 선택해주세요'}
                  </Typography>
                </Box>
                <Box sx={{ flex: 1, p: 2, bgcolor: endDate ? '#e3f2fd' : '#f8f9fa', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
                  <Typography variant="caption" sx={{ color: '#666', display: 'block', mb: 0.5 }}>
                    귀국일
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600, color: endDate ? 'primary.main' : '#999' }}>
                    {endDate ? formatDateForDisplay(endDate) : '날짜를 선택해주세요'}
                  </Typography>
                </Box>
              </Box>

              <Calendar onDateSelect={handleDateSelect} selectedStart={startDate} selectedEnd={endDate} />
            </Box>

            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>여행 인원</InputLabel>
              <Select value={travelers} onChange={(e: any) => setTravelers(e.target.value)} label="여행 인원">
                <MenuItem value="1">혼자 (1명)</MenuItem>
                <MenuItem value="2">커플/친구 (2명)</MenuItem>
                <MenuItem value="3-4">소규모 그룹 (3-4명)</MenuItem>
                <MenuItem value="5+">대규모 그룹 (5명 이상)</MenuItem>
              </Select>
            </FormControl>

            <Box sx={{ bgcolor: '#f8f9fa', p: 2.5, borderRadius: '10px' }}>
              <Typography variant="h6" sx={{ color: 'primary.main', mb: 1.5, fontSize: '1.1rem' }}>
                📊 여행 기간 정보
              </Typography>
              <Typography variant="body1" sx={{ fontSize: '1.1rem', color: '#333', mb: 1 }}>
                {startDate && endDate ? `총 ${getTotalDays()}일 여행` : '기간을 선택하면 여기에 표시됩니다'}
              </Typography>
              <Typography variant="body2" sx={{ color: '#666' }}>
                {getSeasonInfo()}
              </Typography>
            </Box>

            <Button variant="contained" fullWidth onClick={handleNextStep} sx={{ mt: 3, py: 1.5 }}>
              다음 단계 → 일차별 계획
            </Button>
          </Box>
        );

      case 2:
        return (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h4" sx={{ color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                📋 일차별 상세 계획
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={toggleViewMode}
                sx={{ textTransform: 'none' }}
              >
                {viewMode === 'card' ? '📋 타임라인뷰' : '📋 카드뷰'}
              </Button>
            </Box>

            {dayPlans.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 5 }}>
                <Typography variant="h6" sx={{ color: '#999', mb: 2 }}>
                  먼저 날짜를 선택해주세요
                </Typography>
                <Button variant="contained" onClick={() => setActiveStep(1)}>
                  날짜 선택하러 가기
                </Button>
              </Box>
            ) : viewMode === 'card' ? (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 2 }}>
                {dayPlans.map((day: DayPlan) => (
                  <DayPlanningCard
                    key={day.dayNumber}
                    dayNumber={day.dayNumber}
                    date={day.date}
                    schedules={day.schedules}
                    onOpenDetail={handleOpenDayDetail}
                    onCopyPrevDay={handleCopyPrevDay}
                  />
                ))}
              </Box>
            ) : (
              <TimelineView
                tripData={tripData}
                onEdit={handleEditSchedule}
                onDelete={handleDeleteSchedule}
                onAdd={handleOpenScheduleModal}
              />
            )}

            <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
              <Button variant="outlined" onClick={handlePrevStep} sx={{ flex: 1 }}>
                ← 이전 단계
              </Button>
              <Button variant="contained" onClick={handleNextStep} sx={{ flex: 2 }}>
                다음 단계 → 여행지 정보
              </Button>
            </Box>
          </Box>
        );

      case 3:
        const destInfo = destinationData[selectedDestination];
        return (
          <Box>
            <Typography variant="h4" sx={{ color: 'primary.main', mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              🌍 여행지 정보
            </Typography>

            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>여행지 선택</InputLabel>
              <Select
                value={selectedDestination}
                onChange={(e: any) => setSelectedDestination(e.target.value)}
                label="여행지 선택"
                disabled={isLoadingCities}
              >
                {isLoadingCities ? (
                  <MenuItem disabled>로딩 중...</MenuItem>
                ) : cities.length > 0 ? (
                  cities.map((city) => (
                    <MenuItem key={city.region1_idx} value={city.city_name}>
                      📍 {city.city_name}
                    </MenuItem>
                  ))
                ) : (
                  <MenuItem disabled>도시 정보를 불러올 수 없습니다</MenuItem>
                )}
              </Select>
            </FormControl>

            {destInfo && (
              <>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                    📍 기본 정보
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2 }}>
                    <Box sx={{ bgcolor: '#f8f9fa', p: 2, borderRadius: '8px', borderLeft: '4px solid', borderColor: 'primary.main' }}>
                      <Typography variant="caption" sx={{ color: '#666', display: 'block', mb: 0.5 }}>
                        🗺️ 여행지
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {destInfo.name}
                      </Typography>
                    </Box>
                    <Box sx={{ bgcolor: '#f8f9fa', p: 2, borderRadius: '8px', borderLeft: '4px solid', borderColor: 'primary.main' }}>
                      <Typography variant="caption" sx={{ color: '#666', display: 'block', mb: 0.5 }}>
                        🕐 시차
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {destInfo.timezone}
                      </Typography>
                    </Box>
                    <Box sx={{ bgcolor: '#f8f9fa', p: 2, borderRadius: '8px', borderLeft: '4px solid', borderColor: 'primary.main' }}>
                      <Typography variant="caption" sx={{ color: '#666', display: 'block', mb: 0.5 }}>
                        🗣️ 언어
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {destInfo.language}
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                <Box sx={{ mb: 3 }}>
                  <WeatherWidget weather={destInfo.weather} />
                </Box>

                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                    💡 필수 여행 정보
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2 }}>
                    <Box sx={{ bgcolor: '#f8f9fa', p: 2, borderRadius: '8px', borderLeft: '4px solid', borderColor: 'primary.main' }}>
                      <Typography variant="caption" sx={{ color: '#666', display: 'block', mb: 0.5 }}>
                        🔌 전압
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {destInfo.voltage}
                      </Typography>
                    </Box>
                    <Box sx={{ bgcolor: '#f8f9fa', p: 2, borderRadius: '8px', borderLeft: '4px solid', borderColor: 'primary.main' }}>
                      <Typography variant="caption" sx={{ color: '#666', display: 'block', mb: 0.5 }}>
                        🔌 플러그 타입
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {destInfo.plugType}
                      </Typography>
                    </Box>
                    <Box sx={{ bgcolor: '#f8f9fa', p: 2, borderRadius: '8px', borderLeft: '4px solid', borderColor: 'primary.main' }}>
                      <Typography variant="caption" sx={{ color: '#666', display: 'block', mb: 0.5 }}>
                        💱 환율 정보
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {destInfo.exchangeRate}
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                    💡 여행 팁
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {destInfo.tips.map((tip: any, index: number) => (
                      <Box
                        key={index}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                          p: 2,
                          bgcolor: '#f8f9fa',
                          borderRadius: '8px',
                          borderLeft: '4px solid #E7F1A5',
                        }}
                      >
                        <Typography sx={{ fontSize: '1.2rem', minWidth: '24px' }}>{tip.icon}</Typography>
                        <Typography variant="body2" sx={{ color: '#495057', lineHeight: 1.4 }}>
                          {tip.text}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </>
            )}

            <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
              <Button variant="outlined" onClick={handlePrevStep} sx={{ flex: 1 }}>
                ← 이전 단계
              </Button>
              <Button variant="contained" onClick={handleNextStep} sx={{ flex: 2 }}>
                다음 단계 → 미리보기
              </Button>
            </Box>
          </Box>
        );

      case 4:
        return (
          <Box>
            <Typography variant="h4" sx={{ color: 'primary.main', mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              ✨ 미리보기
            </Typography>

            <Box
              sx={{
                background: 'linear-gradient(135deg, #364C84 0%, #2a3a66 100%)',
                color: 'white',
                borderRadius: '15px',
                p: 3,
                mb: 3,
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>
                    {selectedDestination} 여행
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    {startDate?.toLocaleDateString()} ~ {endDate?.toLocaleDateString()}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleDownloadPlan}
                    sx={{
                      color: 'white',
                      borderColor: 'rgba(255,255,255,0.5)',
                      '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' },
                    }}
                  >
                    📄 다운로드
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleSharePlan}
                    sx={{
                      color: 'white',
                      borderColor: 'rgba(255,255,255,0.5)',
                      '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' },
                    }}
                  >
                    🔗 공유
                  </Button>
                </Box>
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                <Box>
                  <Typography variant="caption" sx={{ opacity: 0.8, display: 'block', mb: 0.5 }}>
                    여행 기간
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    총 {getTotalDays()}일
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ opacity: 0.8, display: 'block', mb: 0.5 }}>
                    여행 인원
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {travelers || '-'}명
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Box sx={{ bgcolor: 'white', borderRadius: '15px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
              {dayPlans.map((day: DayPlan) => (
                <Box key={day.dayNumber} sx={{ borderBottom: '1px solid #e9ecef', '&:last-child': { borderBottom: 'none' } }}>
                  <Box sx={{ p: 2.5, bgcolor: '#f8f9fa' }}>
                    <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 600 }}>
                      Day {day.dayNumber} - {day.date}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 2.5 }}>
                    {day.schedules.length === 0 ? (
                      <Typography sx={{ color: '#999', fontStyle: 'italic' }}>일정이 없습니다</Typography>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {day.schedules.map((schedule: ScheduleItem, idx: number) => (
                          <Box key={idx} sx={{ display: 'flex', gap: 2, alignItems: 'start' }}>
                            <Typography sx={{ color: 'primary.main', fontWeight: 600, minWidth: '50px' }}>
                              {schedule.time}
                            </Typography>
                            <Typography sx={{ fontSize: '1.2rem' }}>{schedule.icon}</Typography>
                            <Box sx={{ flex: 1 }}>
                              <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{schedule.location}</Typography>
                              <Typography variant="body2" sx={{ color: '#666' }}>
                                {schedule.description}
                              </Typography>
                              {schedule.travel && (
                                <Typography variant="caption" sx={{ color: '#999', display: 'block', mt: 0.5 }}>
                                  🚗 {schedule.travel.method} ({schedule.travel.time}, {schedule.travel.distance})
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>

            <Button variant="outlined" onClick={handlePrevStep} sx={{ mt: 3, px: 4 }}>
              ← 이전 단계
            </Button>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f8f9fa' }}>
      <AppBar position="static" color="transparent" elevation={1} sx={{ bgcolor: 'white', borderBottom: '1px solid #eee' }}>
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Link href="/" passHref legacyBehavior>
            <Typography
              variant="h6"
              component="a"
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
          </Link>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {isAuthenticated ? (
              <>
                {/* Save Button */}
                {tripId && (
                  <Button
                    variant="contained"
                    color="primary"
                    size="small"
                    startIcon={<SaveIcon />}
                    onClick={handleSaveToDB}
                    disabled={!isDirty || isSaving}
                    sx={{
                      mr: 1,
                      bgcolor: isDirty ? 'primary.main' : 'grey.400',
                      '&:hover': {
                        bgcolor: isDirty ? 'primary.dark' : 'grey.500',
                      },
                    }}
                  >
                    {isSaving ? '저장 중...' : isDirty ? '저장' : '저장됨'}
                  </Button>
                )}
                <Button
                  variant="text"
                  size="small"
                  onClick={() => {
                    console.log('Navigating to mypage from planner');
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
                  size="small"
                  onClick={() => {
                    if (isDirty) {
                      const confirmed = window.confirm(
                        '저장하지 않은 변경사항이 있습니다.\n저장하지 않고 로그아웃하시겠습니까?'
                      );
                      if (!confirmed) return;
                    }
                    logout();
                    router.push('/');
                  }}
                >
                  로그아웃
                </Button>
              </>
            ) : (
              <>
                <Link href="/login" passHref legacyBehavior>
                  <Button variant="outlined" color="primary" size="small" component="a">
                    로그인
                  </Button>
                </Link>
                <Link href="/signup" passHref legacyBehavior>
                  <Button variant="contained" color="primary" size="small" component="a">
                    회원가입
                  </Button>
                </Link>
              </>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Box sx={{ width: '40%', display: 'flex', bgcolor: 'white', boxShadow: '2px 0 10px rgba(0,0,0,0.1)' }}>
          <Box
            sx={{
              width: 140,
              background: 'linear-gradient(180deg, #D0D9F5 0%, #D0D9F5 100%)',
              py: 2,
              overflowY: 'auto',
            }}
          >
            {steps.map((step) => (
              <Box
                key={step.id}
                onClick={() => setActiveStep(step.id)}
                sx={{
                  p: 2,
                  m: '3px 4px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  bgcolor: activeStep === step.id ? 'rgba(255, 255, 255, 0.5)' : 'transparent',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: 0.75,
                  '&:hover': {
                    bgcolor: activeStep === step.id ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.3)',
                  },
                }}
              >
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: activeStep === step.id ? 'white' : 'rgba(255, 255, 255, 0.4)',
                    color: activeStep === step.id ? 'primary.main' : '#364C84',
                    borderRadius: '50%',
                    fontWeight: 'bold',
                    fontSize: '0.75rem',
                  }}
                >
                  {step.id}
                </Box>
                <Box sx={{ width: '100%' }}>
                  <Typography
                    sx={{
                      fontWeight: 600,
                      color: '#364C84',
                      fontSize: '0.8rem',
                      mb: 0.25,
                      lineHeight: 1.1,
                    }}
                  >
                    {step.title}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '0.65rem',
                      color: '#364C84',
                      opacity: 0.8,
                      lineHeight: 1.1,
                    }}
                  >
                    {step.desc}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>

          <Box sx={{ flex: 1, p: '20px 30px', overflowY: 'auto', height: '100%' }}>{renderStepContent()}</Box>
        </Box>

        <Box
          sx={{
            width: '60%',
            background: '#f5f5f5',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            p: 2,
          }}
        >
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ color: 'primary.main', mb: 0.5 }}>
              🗺️ {selectedDestination || '여행지를 선택해주세요'}
            </Typography>
            {startDate && endDate && (
              <Typography variant="body2" sx={{ color: '#666' }}>
                {startDate.toLocaleDateString()} ~ {endDate.toLocaleDateString()}
              </Typography>
            )}
          </Box>
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <KakaoMap height="100%" />
          </Box>

          <Box
            sx={{
              position: 'absolute',
              top: '20%',
              left: '30%',
              fontSize: '3rem',
              animation: 'bounce 2s infinite',
              animationDelay: '0s',
            }}
          >
            📍
          </Box>
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              right: '25%',
              fontSize: '3rem',
              animation: 'bounce 2s infinite',
              animationDelay: '0.5s',
            }}
          >
            📍
          </Box>
          <Box
            sx={{
              position: 'absolute',
              bottom: '25%',
              left: '40%',
              fontSize: '3rem',
              animation: 'bounce 2s infinite',
              animationDelay: '1s',
            }}
          >
            📍
          </Box>
        </Box>
      </Box>

      <ScheduleModal
        open={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        onSave={handleSaveSchedule}
        dayNumber={selectedDay}
        editItem={editingItem}
      />

      <UnifiedChatWidget
        tripId={(() => {
          // Always try to get tripId from URL if not loaded
          if (typeof window === 'undefined') return null;
          if (tripId) return tripId;
          const params = new URLSearchParams(window.location.search);
          const urlTripId = params.get('tripId');
          return urlTripId ? parseInt(urlTripId) : null;
        })()}
        tripTitle={currentTrip?.title || `${selectedDestination} 여행`}
      />

      <InviteCodeModal
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        tripId={tripId || 0}
        tripTitle={currentTrip?.title || `${selectedDestination} 여행`}
      />

      {/* Success/Error Snackbars */}
      <Snackbar
        open={saveSuccess}
        autoHideDuration={3000}
        onClose={() => setSaveSuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSaveSuccess(false)} severity="success" sx={{ width: '100%' }}>
          성공적으로 저장되었습니다!
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!saveError}
        autoHideDuration={5000}
        onClose={() => setSaveError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSaveError(null)} severity="error" sx={{ width: '100%' }}>
          {saveError}
        </Alert>
      </Snackbar>

      <style jsx global>{`
        @keyframes bounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-20px);
          }
        }
      `}</style>
    </Box>
  );
}
