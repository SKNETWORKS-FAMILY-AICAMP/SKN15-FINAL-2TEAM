import React, { useState, useEffect, useRef } from 'react';
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
  TextField,
} from '@mui/material';
import { useRouter } from 'next/router';
import Calendar from '../src/components/planner/Calendar';
import WeatherWidget from '../src/components/planner/WeatherWidget';
import DayPlanningCard from '../src/components/planner/DayPlanningCard';
import TimelineView from '../src/components/planner/TimelineView';
import ScheduleModal from '../src/components/planner/ScheduleModal';
import UnifiedChatWidget from '../src/components/planner/UnifiedChatWidget';
import InviteCodeModal from '../src/components/planner/InviteCodeModal';
import KakaoMapSearch, { KakaoMapSearchHandle } from '../src/components/KakaoMapSearch';
import PlaceSearchSidebar, { PlaceSearchSidebarRef } from '../src/components/planner/PlaceSearchSidebar';
import TravelInfoCard from '../src/components/planner/TravelInfoCard';
import {
  ScheduleItem,
  TripData,
  DayPlan,
  ViewMode,
} from '../src/types/planner';
import { destinationData } from '../src/data/mockData';
import tripAPI, { TripPlan } from '../src/services/tripAPI';
import commonAPI, { Province } from '../src/services/commonAPI';
import weatherAPI, { WeatherDaily } from '../src/services/weatherAPI';
import { useAuth } from '../src/hooks/useAuth';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import SaveIcon from '@mui/icons-material/Save';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import IconButton from '@mui/material/IconButton';
import {
  savePlannerSession,
  loadPlannerSession,
  clearPlannerSession,
  getPlannerSummaryForAgent,
  backupToLocalStorage,
  restoreFromLocalStorage,
} from '../src/utils/plannerStorage';

const steps = [
  { id: 1, title: '날짜 확인', desc: '여행 기간 설정' },
  { id: 2, title: '여행지 정보', desc: '날씨 및 필수정보' },
  { id: 3, title: '일차별 계획', desc: '장소 및 일정' },
  { id: 4, title: '미리보기', desc: '최종 확인' },
];

export default function Planner() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const hasJoinedRef = useRef(false); // Track if user has already joined

  const [activeStep, setActiveStep] = useState(1);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [travelers, setTravelers] = useState('');
  const [tripData, setTripData] = useState<TripData>({});
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [dayPlans, setDayPlans] = useState<DayPlan[]>([]);
  const [dayIdxMap, setDayIdxMap] = useState<{ [dayNo: number]: number }>({});
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | undefined>(undefined);
  const [editingItem, setEditingItem] = useState<ScheduleItem | undefined>(undefined);
  const [selectedDestination, setSelectedDestination] = useState<string>('도쿄');

  // 독립적인 여행 제목 관리
  const [tripTitle, setTripTitle] = useState<string>('나의 여행');

  // Location selection
  const [selectedCountry, setSelectedCountry] = useState<number | null>(null);
  const [selectedProvince, setSelectedProvince] = useState<number | null>(null);
  const [selectedCity, setSelectedCity] = useState<number | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<number | null>(null);
  const [countries, setCountries] = useState<any[]>([]);
  const [provinceList, setProvinceList] = useState<any[]>([]);
  const [cityList, setCityList] = useState<any[]>([]);
  const [districtList, setDistrictList] = useState<any[]>([]);
  const [isLoadingCities, setIsLoadingCities] = useState(false);

  // Real trip data
  const [currentTrip, setCurrentTrip] = useState<TripPlan | null>(null);
  const [tripId, setTripId] = useState<number | null>(null);
  const [isLoadingTrip, setIsLoadingTrip] = useState(false);

  // Invite modal
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  // Place search sidebar
  const [searchSidebarOpen, setSearchSidebarOpen] = useState(false);
  const [searchTargetDay, setSearchTargetDay] = useState<number | undefined>(undefined);

  // Selected day for adding places
  const [selectedDayNo, setSelectedDayNo] = useState<number | null>(null);

  // Map reference for chatbot integration
  const [recommendedPlaces, setRecommendedPlaces] = useState<string[]>([]);
  const [recommendationPanelVisible, setRecommendationPanelVisible] = useState(false); // 패널 표시 여부
  const [recommendationPanelExpanded, setRecommendationPanelExpanded] = useState(true); // 패널 확장 여부
  const [recommendationDetails, setRecommendationDetails] = useState<any[]>([]);
  const kakaoMapRef = useRef<KakaoMapSearchHandle>(null);
  const placeSearchSidebarRef = useRef<PlaceSearchSidebarRef>(null);

  // 사용자 만족도
  const [userSatisfaction, setUserSatisfaction] = useState<'like' | 'dislike' | null>(null);
  const [satisfactionSubmitted, setSatisfactionSubmitted] = useState(false);

  // 날씨 데이터
  const [weatherData, setWeatherData] = useState<WeatherDaily[]>([]);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);

  // 챗봇 메시지에서 장소 추천을 파싱하는 함수 (상세 정보 포함)
  const parseRecommendedPlaces = (message: string): { places: string[], details: any[] } => {
    const places: string[] = [];
    const details: any[] = [];

    // JSON 배열 추출 시도 (에이전트가 recommend_places 도구 결과를 포함한 경우)
    try {
      const jsonMatch = message.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (jsonMatch) {
        const jsonData = JSON.parse(jsonMatch[0]);
        if (Array.isArray(jsonData) && jsonData.length > 0) {
          jsonData.forEach((place: any, index: number) => {
            places.push(place.name);
            details.push({
              name: place.name,
              description: place.address || place.category || '추천 장소입니다.',
              index: index + 1,
              rating: place.rating,
              reviews: place.reviews,
              phone: place.phone,
              website: place.website,
            });
          });
          console.log('✅ JSON에서 장소 추출 성공:', places.length, '개');
          return { places, details };
        }
      }
    } catch (e) {
      console.log('JSON 파싱 실패, 마크다운 파싱 시도:', e);
    }

    // 패턴: "1. **장소명**: 설명" 형식
    const numberedPattern = /(\d+)\.\s*\*\*([^*]+)\*\*:?\s*([^\n]+)/g;
    let match;
    while ((match = numberedPattern.exec(message)) !== null) {
      const placeName = match[2].trim();
      const description = match[3].trim();

      places.push(placeName);
      details.push({
        name: placeName,
        description: description,
        index: parseInt(match[1])
      });
    }

    // 대체 패턴: "1. 장소명: 설명" 형식
    if (places.length === 0) {
      const simplePattern = /(\d+)[.)]\s*([^:：\n]+)[：:]?\s*([^\n]*)/g;
      while ((match = simplePattern.exec(message)) !== null) {
        const placeName = match[2].trim();
        const description = match[3].trim();

        if (placeName.length > 0 && placeName.length < 50) {
          places.push(placeName);
          details.push({
            name: placeName,
            description: description || '추천 장소입니다.',
            index: parseInt(match[1])
          });
        }
      }
    }

    console.log('📍 추출된 장소:', places);
    console.log('📝 상세 정보:', details);
    return { places, details };
  };

  // 챗봇 명령어 파싱: "첫째날에 서울역 스타벅스 추가해"
  const parseChatbotCommand = (message: string): { action: string; day?: number; place?: string } | null => {
    const lowerMsg = message.toLowerCase();

    // "X일차" 또는 "X째날" 패턴
    const dayPatterns = [
      /(\d+)일차/,
      /(\d+)째\s*날/,
      /첫\s*째\s*날|첫날|1일차/,
      /둘\s*째\s*날|2일차/,
      /셋\s*째\s*날|3일차/,
    ];

    let dayNumber: number | undefined;
    for (const pattern of dayPatterns) {
      const match = message.match(pattern);
      if (match) {
        if (match[1]) {
          dayNumber = parseInt(match[1]);
        } else if (message.includes('첫')) {
          dayNumber = 1;
        } else if (message.includes('둘')) {
          dayNumber = 2;
        } else if (message.includes('셋')) {
          dayNumber = 3;
        }
        break;
      }
    }

    // "추가" 명령어
    if (lowerMsg.includes('추가')) {
      // "서울역 스타벅스" 같은 장소명 추출
      const addPatterns = [
        /에\s+([^\s]+(?:\s+[^\s]+)*?)\s+추가/,
        /(\S+(?:\s+\S+)*?)\s+추가/,
      ];

      for (const pattern of addPatterns) {
        const match = message.match(pattern);
        if (match && match[1]) {
          const place = match[1].trim();
          console.log('🤖 챗봇 명령어 파싱:', { action: 'add', day: dayNumber, place });
          return { action: 'add', day: dayNumber, place };
        }
      }
    }

    return null;
  };

  // Session management
  const [isDirty, setIsDirty] = useState(false); // 저장되지 않은 변경사항 여부
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true); // 초기 로드 여부

  // 챗봇/에이전트가 접근할 수 있도록 전역 함수 노출
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).getPlannerData = (targetTripId?: number | null) => {
        const id = targetTripId !== undefined ? targetTripId : tripId;
        return getPlannerSummaryForAgent(id);
      };
      (window as any).backupPlannerData = (targetTripId?: number | null) => {
        const id = targetTripId !== undefined ? targetTripId : tripId;
        backupToLocalStorage(id);
      };
      (window as any).restorePlannerData = (targetTripId?: number | null) => {
        const id = targetTripId !== undefined ? targetTripId : tripId;
        return restoreFromLocalStorage(id);
      };
      console.log('✅ Planner API functions exposed to window object for chatbot/agent');
    }
  }, [tripId]);

  // Load countries and regions from database
  useEffect(() => {
    const loadLocationData = async () => {
      try {
        setIsLoadingCities(true);

        // Load countries
        const countriesData = await commonAPI.getCountries();
        setCountries(countriesData);
        console.log('🌍 Loaded countries:', countriesData.length);

        // Load all provinces (시/도)
        const provincesData = await commonAPI.getProvinces();
        setProvinceList(provincesData);
        console.log('📍 Loaded provinces from database:', provincesData.length);
      } catch (error) {
        console.error('Failed to load location data:', error);
        setCountries([]);
        setProvinceList([]);
      } finally {
        setIsLoadingCities(false);
      }
    };

    loadLocationData();
  }, []);

  // Filter Province when country changes
  useEffect(() => {
    const filterProvince = async () => {
      if (selectedCountry) {
        try {
          const filtered = await commonAPI.getProvincesByCountry(selectedCountry);
          setProvinceList(filtered);
          console.log(`🏙️ Filtered provinces for country ${selectedCountry}:`, filtered.length);
        } catch (error) {
          console.error('Failed to filter provinces:', error);
          setProvinceList([]);
        }
      }
    };

    filterProvince();
  }, [selectedCountry]);

  // Load cities when province changes
  useEffect(() => {
    const loadCities = async () => {
      if (selectedProvince) {
        try {
          const citiesData = await commonAPI.getCitiesByProvince(selectedProvince);
          setCityList(citiesData);
          console.log(`🏘️ Loaded ${citiesData.length} cities for province ${selectedProvince}`);
        } catch (error) {
          console.error('Failed to load cities:', error);
          setCityList([]);
        }
      } else {
        setCityList([]);
        setSelectedCity(null);
      }
    };
    loadCities();
  }, [selectedProvince]);

  // Load districts when city changes
  useEffect(() => {
    const loadDistricts = async () => {
      if (selectedCity) {
        try {
          const districtsData = await commonAPI.getDistrictsByCity(selectedCity);
          setDistrictList(districtsData);
          console.log(`🏡 Loaded ${districtsData.length} districts for city ${selectedCity}`);
        } catch (error) {
          console.error('Failed to load districts:', error);
          setDistrictList([]);
        }
      } else {
        setDistrictList([]);
        setSelectedDistrict(null);
      }
    };
    loadDistricts();
  }, [selectedCity]);

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
          setTripTitle(trip.title || '나의 여행');
          setSelectedDestination(trip.province_name || '도쿄');

          // Restore destination info
          if (trip.country_idx) {
            setSelectedCountry(trip.country_idx);
          }
          if (trip.province_idx) {
            setSelectedProvince(trip.province_idx);
          }

          // Load user satisfaction
          if (trip.user_satisfaction) {
            setUserSatisfaction(trip.user_satisfaction);
            setSatisfactionSubmitted(true);
            console.log('✅ Loaded user satisfaction:', trip.user_satisfaction);
          }

          // Clear dirty flag - data just loaded from DB
          setIsDirty(false);
          clearPlannerSession(trip.trip_idx);
          setIsInitialLoad(false);
        } catch (loadError: any) {
          // If 403 (not a member), try to join first
          if (loadError.response?.status === 403) {
            console.log('🔑 Not a member yet, attempting to join with invite code...');

            // Prevent duplicate join attempts using both ref and localStorage
            const joinKey = `joined_${inviteCodeParam}`;
            const alreadyJoined = hasJoinedRef.current || localStorage.getItem(joinKey);

            if (alreadyJoined) {
              console.log('⚠️ Already joined this trip, skipping duplicate join attempt');
              setIsLoadingTrip(false);
              return;
            }

            try {
              // Mark as joining to prevent race conditions
              hasJoinedRef.current = true;
              localStorage.setItem(joinKey, 'true');

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
              setTripTitle(trip.title || '나의 여행');
              setSelectedDestination(trip.province_name || '도쿄');

              // Restore destination info
              if (trip.country_idx) {
                setSelectedCountry(trip.country_idx);
              }
              if (trip.province_idx) {
                setSelectedProvince(trip.province_idx);
              }

              // Load user satisfaction
              if (trip.user_satisfaction) {
                setUserSatisfaction(trip.user_satisfaction);
                setSatisfactionSubmitted(true);
                console.log('✅ Loaded user satisfaction:', trip.user_satisfaction);
              }

              // Clear dirty flag - data just loaded from DB
              setIsDirty(false);
              clearPlannerSession(trip.trip_idx);
              setIsInitialLoad(false);

              alert('여행에 성공적으로 참여했습니다!');
            } catch (joinError: any) {
              console.error('Failed to join trip:', joinError);
              // Reset on error
              hasJoinedRef.current = false;
              localStorage.removeItem(joinKey);
              throw joinError; // Re-throw to outer catch
            }
          } else {
            throw loadError; // Re-throw other errors to outer catch
          }
        }
      } catch (error: any) {
        console.error('❌ Failed to load trip:', error);
        console.error('❌ Error status:', error.response?.status);
        console.error('❌ Error status type:', typeof error.response?.status);
        console.error('❌ Error data:', error.response?.data);
        console.error('❌ Error response:', error.response);
        console.error('❌ Invite code:', inviteCodeParam);

        // If not authenticated (401), redirect to login with return URL
        if (error.response?.status === 401) {
          console.log('🔐 Not authenticated, redirecting to login...');
          // Save the invite code URL to return after login
          if (inviteCodeParam) {
            const returnUrl = `/planner?inviteCode=${inviteCodeParam}`;
            router.push(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
          } else {
            router.push('/login');
          }
          return;
        }

        // Show error message to user for other errors
        if (error.response?.status === 403) {
          alert('이 여행에 접근 권한이 없습니다.');
        } else if (error.response?.status === 404) {
          alert('유효하지 않거나 만료된 초대 코드입니다.');
        } else {
          alert(`여행 정보를 불러올 수 없습니다. (에러: ${error.response?.status || 'unknown'})`);
        }

        // Redirect to mypage for other errors
        router.push('/mypage');
      } finally {
        setIsLoadingTrip(false);
      }
    };

    loadTrip();
  }, [router]);

  // Load days data and restore dates when trip is loaded
  const loadDaysData = async () => {
    if (!tripId) {
      console.log('⚠️ No tripId, skipping days load');
      return;
    }

    try {
      console.log('🔄 Loading days for trip:', tripId);

      // Reload trip info to get latest data
      const trip = await tripAPI.getTrip(tripId);
      setCurrentTrip(trip);

      // Update dates and destination
      if (trip.start_date && trip.end_date) {
        setStartDate(parseDateFromDB(trip.start_date));
        setEndDate(parseDateFromDB(trip.end_date));
      }
      if (trip.party_size) {
        setTravelers(trip.party_size.toString());
      }
      if (trip.title) {
        setTripTitle(trip.title);
      }
      if (trip.province_name) {
        setSelectedDestination(trip.province_name);
      }
      if (trip.country_idx) {
        setSelectedCountry(trip.country_idx);
      }
      if (trip.province_idx) {
        setSelectedProvince(trip.province_idx);
      }

      const daysData = await tripAPI.getDays(tripId);
      console.log('✅ Days data loaded:', daysData);

      if (daysData && Array.isArray(daysData) && daysData.length > 0) {
        // Convert API data to tripData format
        const newTripData: TripData = {};

        // Store day_idx mapping for later use
        const dayIdxMap: { [dayNo: number]: number } = {};
        daysData.forEach(day => {
          dayIdxMap[day.day_no] = day.day_idx;
        });

        // Load items for each day (don't pre-initialize to avoid reference sharing)
        for (const day of daysData) {
          try {
            const items = await tripAPI.getItems(day.day_idx);
            console.log(`📋 Loading items for Day ${day.day_no} (day_idx: ${day.day_idx}):`, items);

            // Map items to schedule format (ScheduleItem type)
            // IMPORTANT: Always create a NEW array for each day
            if (items && Array.isArray(items) && items.length > 0) {
              newTripData[day.day_no] = items.map((item: any) => {
                // Remove seconds from time if present (HH:MM:SS -> HH:MM)
                let time = item.start_time || '';
                if (time && time.length === 8) {
                  time = time.substring(0, 5); // "09:00:00" -> "09:00"
                }

                return {
                  time,
                  location: item.title || '',
                  description: item.notes || '',
                  icon: '📍',
                };
              });
              console.log(`✅ Loaded ${items.length} items for Day ${day.day_no}`, newTripData[day.day_no]);
            } else {
              // Create a NEW empty array for each day (don't reuse)
              newTripData[day.day_no] = [];
              console.log(`📝 No items for Day ${day.day_no} - created empty array`);
            }
          } catch (error) {
            console.error(`❌ Failed to load items for Day ${day.day_no}:`, error);
            // Create a NEW empty array for this day
            newTripData[day.day_no] = [];
          }
        }

        console.log('📝 Final tripData:', JSON.stringify(newTripData, null, 2));
        console.log('📝 Verifying each day has unique array:');
        Object.keys(newTripData).forEach(dayNo => {
          console.log(`  Day ${dayNo}: ${newTripData[Number(dayNo)].length} items`);
        });

        setTripData(newTripData);
        setDayIdxMap(dayIdxMap); // Store day_idx mapping
        setIsDirty(false); // 데이터 로드 후 dirty 플래그 초기화
      } else {
        // No days found - initialize empty tripData
        console.log('📝 No days found, initializing empty tripData');
        setTripData({});
      }
    } catch (error) {
      console.error('❌ Failed to load days:', error);
    }
  };

  useEffect(() => {
    loadDaysData();
  }, [tripId]);

  useEffect(() => {
    if (startDate && endDate) {
      const days: DayPlan[] = [];
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      console.log('🔄 Building dayPlans from tripData:', tripData);

      for (let i = 0; i < totalDays; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dayNumber = i + 1;

        // Deep copy schedules to prevent reference sharing
        const schedulesForDay = tripData[dayNumber] ? [...tripData[dayNumber]] : [];

        console.log(`  Day ${dayNumber}: ${schedulesForDay.length} schedules`, schedulesForDay);

        days.push({
          dayNumber,
          dayIdx: dayIdxMap[dayNumber] || 0, // Use stored day_idx or 0 if not found
          date: formatDateForDisplay(date),
          schedules: schedulesForDay,
        });
      }

      console.log('✅ Final dayPlans:', days);
      setDayPlans(days);
    }
  }, [startDate, endDate, tripData, dayIdxMap]);

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

    // Update tripData while preserving existing data
    if (start && end) {
      const newDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      console.log('📅 New trip duration:', newDays, 'days');

      setTripData((prevTripData) => {
        const newTripData: TripData = {};
        const existingDays = Object.keys(prevTripData).length;

        // Copy existing days (preserve data)
        for (let i = 1; i <= newDays; i++) {
          if (prevTripData[i]) {
            // Day already exists - keep its data
            newTripData[i] = [...prevTripData[i]];
            console.log(`📝 Preserved Day ${i} data (${prevTripData[i].length} items)`);
          } else {
            // New day - create empty array
            newTripData[i] = [];
            console.log(`➕ Created new Day ${i}`);
          }
        }

        // Days beyond newDays are automatically excluded (deleted)
        if (newDays < existingDays) {
          console.log(`🗑️ Removed days ${newDays + 1} to ${existingDays} (trip duration decreased)`);
        }

        console.log('📊 Updated tripData:', newTripData);
        return newTripData;
      });
    } else {
      console.log('⚠️ No start or end date provided');
    }
  };

  const handleNextStep = () => {
    if (activeStep < 4) setActiveStep(activeStep + 1);

    // 미리보기 단계로 이동 시 날씨 데이터 가져오기
    if (activeStep === 3 && tripId) {
      fetchWeatherDataByDays();
    }
  };

  // 날씨 데이터 가져오기 (각 일차의 첫 번째 일정 위치 기준)
  const fetchWeatherDataByDays = async () => {
    if (!tripId) {
      console.warn('⚠️ No trip ID, cannot fetch weather');
      return;
    }

    setIsLoadingWeather(true);
    try {
      console.log('🌤️ Fetching weather by days for trip:', tripId);
      const result = await tripAPI.getWeatherByDays(tripId);
      console.log('✅ Weather data received:', result);

      // 날짜를 키로 하는 날씨 데이터 맵으로 변환
      const weatherMap: any[] = [];
      result.days.forEach(day => {
        console.log('🔍 Processing day:', day.day_no, 'date:', day.date, 'weather:', day.weather);
        if (day.weather) {
          weatherMap.push({
            forecast_date: day.date,
            weather_am: day.weather.weather_am,
            weather_pm: day.weather.weather_pm,
            temp_min_c: day.weather.temp_min_c,
            temp_max_c: day.weather.temp_max_c,
            precipitation_am: day.weather.precipitation_am,
            precipitation_pm: day.weather.precipitation_pm,
          });
        } else {
          console.warn('⚠️ No weather for day', day.day_no, day.date);
        }
      });

      console.log('🌤️ Final weatherMap:', weatherMap);
      setWeatherData(weatherMap);
    } catch (error) {
      console.error('❌ Failed to fetch weather:', error);
      setWeatherData([]);
    } finally {
      setIsLoadingWeather(false);
    }
  };

  // Step 4(미리보기)로 들어올 때 자동으로 날씨 데이터 가져오기
  useEffect(() => {
    if (activeStep === 4 && tripId) {
      console.log('📍 Step 4 (미리보기) - 날씨 데이터 가져오기');
      fetchWeatherDataByDays();
    }
  }, [activeStep, tripId]);

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
      console.log(`🗑️ Deleting schedule: Day ${dayNumber}, Index ${itemIndex}`);

      setTripData((prev: TripData) => {
        // Deep copy: copy object AND all arrays
        const newData: TripData = {};
        Object.keys(prev).forEach(key => {
          const dayNo = Number(key);
          newData[dayNo] = [...prev[dayNo]]; // Create NEW array for each day
        });

        // Ensure the day exists
        if (!newData[dayNumber]) {
          console.warn(`⚠️ Day ${dayNumber} not found in tripData`);
          return prev;
        }

        console.log(`📋 Before delete - Day ${dayNumber} items:`, newData[dayNumber].length);

        // Filter out the item at the specified index
        newData[dayNumber] = newData[dayNumber].filter((_: ScheduleItem, index: number) => index !== itemIndex);

        console.log(`✅ After delete - Day ${dayNumber} items:`, newData[dayNumber].length);

        return newData;
      });

      setIsDirty(true); // Mark as dirty when schedule is deleted
    }
  };

  const handleSaveSchedule = (item: ScheduleItem, dayNumber?: number) => {
    const targetDay = dayNumber || selectedDay || 1;

    setTripData((prev: TripData) => {
      // Deep copy: copy object AND all arrays
      const newData: TripData = {};
      Object.keys(prev).forEach(key => {
        const dayNo = Number(key);
        newData[dayNo] = [...prev[dayNo]]; // Create NEW array for each day
      });

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

      console.log(`📝 handleSaveSchedule - Day ${targetDay} now has ${newData[targetDay].length} items`);
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
      setTripData((prev: TripData) => {
        // Deep copy: copy object AND all arrays
        const newData: TripData = {};
        Object.keys(prev).forEach(key => {
          const dayNo = Number(key);
          newData[dayNo] = [...prev[dayNo]]; // Create NEW array for each day
        });

        // Copy schedules from previous day
        newData[dayNumber] = [...prevDaySchedules];

        return newData;
      });
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
    a.download = `여행계획_${tripTitle}_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSharePlan = () => {
    const shareText = `${tripTitle} 계획! 총 ${getTotalDays()}일 일정입니다.`;

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

  // 사용자 만족도 제출
  const handleSubmitSatisfaction = async (satisfaction: 'like' | 'dislike') => {
    if (!tripId) {
      alert('여행 정보를 불러올 수 없습니다.');
      return;
    }

    try {
      setUserSatisfaction(satisfaction);
      await tripAPI.submitSatisfaction(tripId, satisfaction);
      console.log(`✅ 만족도 제출 성공: ${satisfaction} for trip ${tripId}`);
      setSatisfactionSubmitted(true);
      alert('소중한 의견 감사합니다! 😊');
    } catch (error) {
      console.error('❌ 만족도 제출 실패:', error);
      alert('만족도 제출에 실패했습니다.');
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

      // 1. Update trip basic info (dates, party_size, title, destination)
      const updatedTrip = await tripAPI.updateTrip(tripId, {
        start_date: formatDateForDB(startDate),
        end_date: formatDateForDB(endDate),
        party_size: parseInt(travelers) || 1,
        title: tripTitle,
        country_idx: selectedCountry || undefined,
        province_idx: selectedProvince || undefined,
        city_idx: selectedCity || undefined,
        district_idx: selectedDistrict || undefined,
      });

      console.log('✅ Trip info updated:', updatedTrip);

      // 2. Get existing days
      const existingDays = await tripAPI.getDays(tripId);
      console.log('📋 Found existing days:', existingDays);
      console.log('📋 Existing days count:', existingDays?.length);

      // 3. Calculate required days based on date range
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const dayMapping: { [dayNo: number]: number } = {}; // dayNo -> day_idx

      // Build expected date map
      const expectedDates = new Map<number, string>(); // dayNo -> expected date
      for (let i = 0; i < totalDays; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        expectedDates.set(i + 1, formatDateForDB(date));
      }
      console.log('📅 Expected dates:', Object.fromEntries(expectedDates));

      // 4. Delete days with WRONG dates (orphaned from previous date changes)
      if (existingDays && Array.isArray(existingDays)) {
        for (const day of existingDays) {
          const expectedDate = expectedDates.get(day.day_no);

          // Delete if: day_no is out of range OR date doesn't match expected
          if (!expectedDate || day.date !== expectedDate) {
            try {
              console.log(`🗑️ Deleting Day ${day.day_no} (day_idx: ${day.day_idx}) - Wrong date: ${day.date} (expected: ${expectedDate || 'N/A'})`);
              await tripAPI.deleteDay(day.day_idx);
              console.log(`✅ Deleted Day ${day.day_no}`);
            } catch (deleteError: any) {
              console.error(`❌ Failed to delete Day ${day.day_no}:`, deleteError);
            }
          } else {
            // Keep this day and clear its items only
            console.log(`♻️ Reusing Day ${day.day_no} (day_idx: ${day.day_idx}) - Date matches: ${day.date}`);
            dayMapping[day.day_no] = day.day_idx;

            // Delete all existing items for this day (we'll recreate from tripData)
            try {
              const existingItems = await tripAPI.getItems(day.day_idx);
              console.log(`📋 Found ${existingItems.length} existing items for Day ${day.day_no}`);

              for (const item of existingItems) {
                try {
                  await tripAPI.deleteItem(item.item_idx);
                  console.log(`  🗑️ Deleted item ${item.item_idx}`);
                } catch (deleteItemError) {
                  console.error(`  ❌ Failed to delete item ${item.item_idx}:`, deleteItemError);
                }
              }
            } catch (getItemsError) {
              console.error(`❌ Failed to get items for Day ${day.day_no}:`, getItemsError);
            }
          }
        }
      }

      // 5. Create missing days (days that don't exist yet or were deleted)
      console.log(`🔄 Creating missing days...`);
      for (let i = 0; i < totalDays; i++) {
        const dayNo = i + 1;
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);

        // Skip if day already exists (and matched date)
        if (dayMapping[dayNo]) {
          console.log(`✓ Day ${dayNo} already exists with correct date`);
          continue;
        }

        // Create new day
        try {
          console.log('🔄 Creating new day:', {
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
      console.log('✅ All days processed. Final dayMapping:', dayMapping);

      // 6. Save schedules (tripData) to DB as items
      console.log('📊 Current tripData state:', JSON.stringify(tripData, null, 2));

      for (const dayNoStr in tripData) {
        const dayNo = parseInt(dayNoStr);
        const schedules = tripData[dayNo];
        const dayIdx = dayMapping[dayNo];

        console.log(`🔄 Processing Day ${dayNo}:`, {
          dayIdx,
          schedulesCount: schedules?.length || 0,
          schedules: schedules
        });

        if (!dayIdx) {
          console.warn(`⚠️ No day_idx found for Day ${dayNo}, skipping items`);
          continue;
        }

        if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
          console.log(`📝 No items to save for Day ${dayNo} (empty or invalid array)`);
          continue;
        }

        console.log(`💾 Saving ${schedules.length} items for Day ${dayNo} (day_idx: ${dayIdx})`);

        for (let i = 0; i < schedules.length; i++) {
          const schedule = schedules[i];

          console.log(`  📝 Item ${i + 1}/${schedules.length}:`, {
            title: schedule.location,
            time: schedule.time,
            description: schedule.description
          });

          try {
            await tripAPI.createItem({
              day_idx: dayIdx,
              item_type: 'custom',
              title: schedule.location || '제목 없음',
              start_time: schedule.time || '',
              notes: schedule.description || '',
              order_in_day: i + 1,
              lock_flag: false,
            });
            console.log(`  ✅ Created item ${i + 1} for Day ${dayNo}`);
          } catch (itemError) {
            console.error(`  ❌ Failed to create item ${i + 1} for Day ${dayNo}:`, itemError);
          }
        }

        console.log(`✅ Saved ${schedules.length} items for Day ${dayNo}`);
      }

      // Clear session storage after successful save
      clearPlannerSession(tripId);
      setIsDirty(false);
      setSaveSuccess(true);

      console.log('✅ Saved to DB successfully');

      // Reload data from DB to ensure consistency
      console.log('🔄 Reloading data from DB...');
      await loadDaysData();
      console.log('✅ Data reloaded successfully');

    } catch (error: any) {
      console.error('❌ Failed to save to DB:', error);
      setSaveError('저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * 모든 일정 초기화 (세션만 비우기, DB는 건드리지 않음)
   */
  const handleClearAllSchedules = () => {
    if (!tripId) return;

    const confirmed = window.confirm(
      '⚠️ 화면의 모든 일정이 삭제됩니다.\n(저장하지 않으면 DB에는 영향 없음)\n\n정말로 모든 일정을 초기화하시겠습니까?'
    );

    if (!confirmed) return;

    // 1. 세션 스토리지 초기화
    clearPlannerSession(tripId);

    // 2. 로컬 상태 초기화 (빈 일정으로)
    setTripData({});

    // 3. Dirty 플래그 설정 (저장 필요 상태로)
    setIsDirty(true);

    console.log('✅ All schedules cleared from session (not saved to DB yet)');
    alert('✅ 모든 일정이 초기화되었습니다.\n저장하지 않으면 DB에는 영향이 없습니다.');
  };

  /**
   * Auto-save to sessionStorage when data changes (모든 플래너 정보 저장)
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
        selectedCountry,
        selectedProvince,
        activeStep,
        viewMode,
        selectedDay,
        isDirty,
      });
      console.log('💾 Auto-saved to sessionStorage (all planner data)');
    }
  }, [
    tripData,
    startDate,
    endDate,
    travelers,
    selectedDestination,
    selectedCountry,
    selectedProvince,
    activeStep,
    viewMode,
    selectedDay,
    isDirty,
    tripId,
    isLoadingTrip,
    isSaving,
    isInitialLoad,
  ]);


  /**
   * Load from sessionStorage on mount (모든 플래너 정보 복원)
   */
  useEffect(() => {
    if (tripId !== null) {
      const sessionData = loadPlannerSession(tripId);
      if (sessionData) {
        console.log('🔄 Restoring from session storage (all planner data)...');
        setTripData(sessionData.tripData);
        setStartDate(sessionData.startDate ? new Date(sessionData.startDate) : null);
        setEndDate(sessionData.endDate ? new Date(sessionData.endDate) : null);
        setTravelers(sessionData.travelers);
        setSelectedDestination(sessionData.selectedDestination);
        setSelectedCountry(sessionData.selectedCountry);
        setSelectedProvince(sessionData.selectedProvince);
        setActiveStep(sessionData.activeStep);
        setViewMode(sessionData.viewMode);
        setSelectedDay(sessionData.selectedDay || undefined);
        setIsDirty(sessionData.isDirty); // Restore dirty state
        console.log('✅ All planner data restored from session');
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
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h4" sx={{ color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                📅 여행 날짜 확인
              </Typography>
              {tripId && (
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  startIcon={<SaveIcon />}
                  onClick={handleSaveToDB}
                  disabled={!isDirty || isSaving}
                  sx={{
                    bgcolor: isDirty ? 'primary.main' : 'grey.400',
                    '&:hover': {
                      bgcolor: isDirty ? 'primary.dark' : 'grey.500',
                    },
                  }}
                >
                  {isSaving ? '저장 중...' : isDirty ? '저장' : '저장됨'}
                </Button>
              )}
            </Box>

            {/* 여행 제목 입력 */}
            <TextField
              fullWidth
              label="여행 제목"
              value={tripTitle}
              onChange={(e) => {
                setTripTitle(e.target.value);
                setIsDirty(true);
              }}
              placeholder="예: 서울 가족 여행, 제주도 힐링 여행"
              sx={{ mb: 3 }}
              helperText="여행의 제목을 자유롭게 입력하세요"
            />

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
              다음 단계 → 여행지 정보
            </Button>
          </Box>
        );

      case 2:
        const destInfo = destinationData[selectedDestination];
        return (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h4" sx={{ color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                🌍 여행지 정보
              </Typography>
              {tripId && (
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  startIcon={<SaveIcon />}
                  onClick={handleSaveToDB}
                  disabled={!isDirty || isSaving}
                  sx={{
                    bgcolor: isDirty ? 'primary.main' : 'grey.400',
                    '&:hover': {
                      bgcolor: isDirty ? 'primary.dark' : 'grey.500',
                    },
                  }}
                >
                  {isSaving ? '저장 중...' : isDirty ? '저장' : '저장됨'}
                </Button>
              )}
            </Box>

            {/* Country Selection */}
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>국가 선택</InputLabel>
              <Select
                value={selectedCountry || ''}
                onChange={(e: any) => {
                  const countryIdx = e.target.value;
                  setSelectedCountry(countryIdx);
                  setSelectedProvince(null); // Reset province when country changes
                  // Find country name
                  const country = countries.find((c: any) => c.country_idx === countryIdx);
                  setSelectedDestination(country?.country_name || '');
                  // Mark as dirty to enable save button
                  setIsDirty(true);
                }}
                label="국가 선택"
                disabled={isLoadingCities}
              >
                {isLoadingCities ? (
                  <MenuItem disabled>로딩 중...</MenuItem>
                ) : countries.length > 0 ? (
                  countries.map((country: any) => (
                    <MenuItem key={country.country_idx} value={country.country_idx}>
                      🌍 {country.country_name}
                    </MenuItem>
                  ))
                ) : (
                  <MenuItem disabled>국가 정보를 불러올 수 없습니다</MenuItem>
                )}
              </Select>
            </FormControl>

            {/* Province (City) Selection */}
            {selectedCountry && (
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>도시 선택</InputLabel>
                <Select
                  value={selectedProvince || ''}
                  onChange={(e: any) => {
                    const provinceIdx = e.target.value;
                    setSelectedProvince(provinceIdx);
                    // Reset child selections
                    setSelectedCity(null);
                    setSelectedDistrict(null);
                    setCityList([]);
                    setDistrictList([]);
                    // Find province name
                    const province = provinceList.find((r: any) => r.province_idx === provinceIdx);
                    if (province) {
                      setSelectedDestination(`${province.name}`);
                    }
                    // Mark as dirty to enable save button
                    setIsDirty(true);
                  }}
                  label="도시 선택"
                >
                  {provinceList.length > 0 ? (
                    provinceList.map((province: any) => (
                      <MenuItem key={province.province_idx} value={province.province_idx}>
                        🏙️ {province.name}
                      </MenuItem>
                    ))
                  ) : (
                    <MenuItem disabled>해당 국가에 도시 정보가 없습니다</MenuItem>
                  )}
                </Select>
              </FormControl>
            )}

            {/* City Selection (구/군) - Optional */}
            {selectedProvince && cityList.length > 0 && (
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>구/군 선택 (선택)</InputLabel>
                <Select
                  value={selectedCity || ''}
                  onChange={(e: any) => {
                    const cityIdx = e.target.value;
                    setSelectedCity(cityIdx || null);
                    // Reset district selection
                    setSelectedDistrict(null);
                    setDistrictList([]);
                    // Find city name and update destination
                    const province = provinceList.find((p: any) => p.province_idx === selectedProvince);
                    if (cityIdx) {
                      const city = cityList.find((c: any) => c.city_idx === cityIdx);
                      if (city && province) {
                        setSelectedDestination(`${province.name} ${city.name}`);
                      }
                    } else {
                      // No city selected, just show province
                      if (province) {
                        setSelectedDestination(province.name);
                      }
                    }
                    // Mark as dirty to enable save button
                    setIsDirty(true);
                  }}
                  label="구/군 선택 (선택)"
                >
                  <MenuItem value="">선택</MenuItem>
                  {cityList.map((city: any) => (
                    <MenuItem key={city.city_idx} value={city.city_idx}>
                      🏘️ {city.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* District Selection (읍/면/동) - Optional */}
            {selectedCity && districtList.length > 0 && (
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>읍/면/동 선택 (선택)</InputLabel>
                <Select
                  value={selectedDistrict || ''}
                  onChange={(e: any) => {
                    const districtIdx = e.target.value;
                    setSelectedDistrict(districtIdx || null);
                    // Find district name and update destination
                    const city = cityList.find((c: any) => c.city_idx === selectedCity);
                    const province = provinceList.find((p: any) => p.province_idx === selectedProvince);
                    if (districtIdx) {
                      const district = districtList.find((d: any) => d.district_idx === districtIdx);
                      if (district && city && province) {
                        setSelectedDestination(`${province.name} ${city.name} ${district.name}`);
                      }
                    } else {
                      // No district selected, just show province and city
                      if (city && province) {
                        setSelectedDestination(`${province.name} ${city.name}`);
                      }
                    }
                    // Mark as dirty to enable save button
                    setIsDirty(true);
                  }}
                  label="읍/면/동 선택 (선택)"
                >
                  <MenuItem value="">선택</MenuItem>
                  {districtList.map((district: any) => (
                    <MenuItem key={district.district_idx} value={district.district_idx}>
                      📍 {district.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* 여행지 정보 - 항상 표시 (데이터가 없으면 빈 틀로 표시) */}
            {selectedCountry && (
              <>
                {/* Weather Forecast - 날씨 예보 (기본정보 위로 이동) */}
                {selectedProvince && startDate && endDate && (
                  <Box sx={{ mb: 4 }}>
                    <TravelInfoCard
                      countryCode={selectedCountry || undefined}
                      provinceIdx={selectedProvince || undefined}
                      cityIdx={selectedCity || undefined}
                      districtIdx={selectedDistrict || undefined}
                      startDate={startDate}
                      endDate={endDate}
                      weatherOnly={true}
                    />
                  </Box>
                )}

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
                        {destInfo?.name || selectedDestination || '-'}
                      </Typography>
                    </Box>
                    <Box sx={{ bgcolor: '#f8f9fa', p: 2, borderRadius: '8px', borderLeft: '4px solid', borderColor: 'primary.main' }}>
                      <Typography variant="caption" sx={{ color: '#666', display: 'block', mb: 0.5 }}>
                        🕐 시차
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {destInfo?.timezone || '-'}
                      </Typography>
                    </Box>
                    <Box sx={{ bgcolor: '#f8f9fa', p: 2, borderRadius: '8px', borderLeft: '4px solid', borderColor: 'primary.main' }}>
                      <Typography variant="caption" sx={{ color: '#666', display: 'block', mb: 0.5 }}>
                        🗣️ 언어
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {destInfo?.language || '-'}
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                {destInfo?.weather && (
                  <Box sx={{ mb: 3 }}>
                    <WeatherWidget weather={destInfo.weather} />
                  </Box>
                )}

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
                        {destInfo?.voltage || '-'}
                      </Typography>
                    </Box>
                    <Box sx={{ bgcolor: '#f8f9fa', p: 2, borderRadius: '8px', borderLeft: '4px solid', borderColor: 'primary.main' }}>
                      <Typography variant="caption" sx={{ color: '#666', display: 'block', mb: 0.5 }}>
                        🔌 플러그 타입
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {destInfo?.plugType || '-'}
                      </Typography>
                    </Box>
                    <Box sx={{ bgcolor: '#f8f9fa', p: 2, borderRadius: '8px', borderLeft: '4px solid', borderColor: 'primary.main' }}>
                      <Typography variant="caption" sx={{ color: '#666', display: 'block', mb: 0.5 }}>
                        💱 환율 정보
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {destInfo?.exchangeRate || '-'}
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                {destInfo?.tips && destInfo.tips.length > 0 && (
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
                )}

                {/* Airflow 배치 데이터: 환율, 여행경보 (날씨는 위로 이동) */}
                <TravelInfoCard
                  countryCode={selectedCountry || undefined}
                  provinceIdx={selectedProvince || undefined}
                  cityIdx={selectedCity || undefined}
                  districtIdx={selectedDistrict || undefined}
                  startDate={startDate}
                  endDate={endDate}
                  weatherOnly={false}
                />
              </>
            )}

            <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
              <Button variant="outlined" onClick={handlePrevStep} sx={{ flex: 1 }}>
                ← 이전 단계
              </Button>
              <Button variant="contained" onClick={handleNextStep} sx={{ flex: 2 }}>
                다음 단계 → 일차별 계획
              </Button>
            </Box>
          </Box>
        );

      case 3:
        return (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h4" sx={{ color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                📋 일차별 상세 계획
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={toggleViewMode}
                  sx={{ textTransform: 'none' }}
                >
                  {viewMode === 'card' ? '📋 타임라인뷰' : '📋 카드뷰'}
                </Button>
                {tripId && dayPlans.some(day => day.schedules.length > 0) && (
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    startIcon={<DeleteSweepIcon />}
                    onClick={handleClearAllSchedules}
                    sx={{ textTransform: 'none' }}
                  >
                    모든 일정 초기화
                  </Button>
                )}
                {tripId && (
                  <Button
                    variant="contained"
                    color="primary"
                    size="small"
                    startIcon={<SaveIcon />}
                    onClick={handleSaveToDB}
                    disabled={!isDirty || isSaving}
                    sx={{
                      bgcolor: isDirty ? 'primary.main' : 'grey.400',
                      '&:hover': {
                        bgcolor: isDirty ? 'primary.dark' : 'grey.500',
                      },
                    }}
                  >
                    {isSaving ? '저장 중...' : isDirty ? '저장' : '저장됨'}
                  </Button>
                )}
              </Box>
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
                    onSearchPlace={(dayNum) => {
                      // Day 선택
                      setSelectedDayNo(dayNum);
                      console.log(`📌 Day ${dayNum} selected from search button`);

                      // 카카오맵 검색창에 포커스
                      kakaoMapRef.current?.focusSearchInput();
                    }}
                    isSelected={selectedDayNo === day.dayNumber}
                    onSelect={(dayNum) => {
                      if (selectedDayNo === dayNum) {
                        console.log(`📌 Day ${dayNum} deselected`);
                        setSelectedDayNo(null);
                      } else {
                        console.log(`📌 Day ${dayNum} selected for adding places`);
                        setSelectedDayNo(dayNum);
                      }
                    }}
                    onUpdateTime={(dayNum, scheduleIndex, newTime) => {
                      console.log(`⏰ Updating time for Day ${dayNum}, Schedule ${scheduleIndex} to ${newTime}`);

                      setTripData((prev: TripData) => {
                        // Deep copy
                        const newData: TripData = {};
                        Object.keys(prev).forEach(key => {
                          const dayNo = Number(key);
                          newData[dayNo] = [...prev[dayNo]];
                        });

                        // Update time
                        if (newData[dayNum] && newData[dayNum][scheduleIndex]) {
                          newData[dayNum][scheduleIndex] = {
                            ...newData[dayNum][scheduleIndex],
                            time: newTime
                          };

                          // Sort by time
                          newData[dayNum].sort((a, b) => a.time.localeCompare(b.time));
                        }

                        return newData;
                      });

                      setIsDirty(true);
                      console.log(`✅ Time updated successfully`);
                    }}
                  />
                ))}
              </Box>
            ) : (
              <TimelineView
                tripData={tripData}
                onEdit={handleEditSchedule}
                onDelete={handleDeleteSchedule}
                onAdd={(dayNum) => {
                  // Day 선택
                  setSelectedDayNo(dayNum);
                  console.log(`📌 Day ${dayNum} selected from timeline add button`);

                  // 카카오맵 검색창에 포커스
                  kakaoMapRef.current?.focusSearchInput();
                }}
                selectedDayNo={selectedDayNo}
                onSelectDay={(dayNum) => {
                  if (selectedDayNo === dayNum) {
                    console.log(`📌 Day ${dayNum} deselected (timeline)`);
                    setSelectedDayNo(null);
                  } else {
                    console.log(`📌 Day ${dayNum} selected (timeline)`);
                    setSelectedDayNo(dayNum);
                  }
                }}
                onUpdateTime={(dayNum, scheduleIndex, newTime) => {
                  console.log(`⏰ Updating time (timeline) for Day ${dayNum}, Schedule ${scheduleIndex} to ${newTime}`);

                  setTripData((prev: TripData) => {
                    // Deep copy
                    const newData: TripData = {};
                    Object.keys(prev).forEach(key => {
                      const dayNo = Number(key);
                      newData[dayNo] = [...prev[dayNo]];
                    });

                    // Update time
                    if (newData[dayNum] && newData[dayNum][scheduleIndex]) {
                      newData[dayNum][scheduleIndex] = {
                        ...newData[dayNum][scheduleIndex],
                        time: newTime
                      };

                      // Sort by time
                      newData[dayNum].sort((a, b) => a.time.localeCompare(b.time));
                    }

                    return newData;
                  });

                  setIsDirty(true);
                  console.log(`✅ Time updated successfully (timeline)`);
                }}
                onReorder={(dayNum, oldIndex, newIndex) => {
                  console.log(`🔄 Reordering Day ${dayNum}: ${oldIndex} → ${newIndex}`);

                  setTripData((prev: TripData) => {
                    // Deep copy
                    const newData: TripData = {};
                    Object.keys(prev).forEach(key => {
                      const dayNo = Number(key);
                      newData[dayNo] = [...prev[dayNo]];
                    });

                    // Reorder items
                    if (newData[dayNum]) {
                      const [movedItem] = newData[dayNum].splice(oldIndex, 1);
                      newData[dayNum].splice(newIndex, 0, movedItem);
                    }

                    return newData;
                  });

                  setIsDirty(true);
                  console.log(`✅ Reordered successfully`);
                }}
                onMoveToDay={(sourceDayNo, sourceIndex, targetDayNo) => {
                  console.log(`📦 Moving item from Day ${sourceDayNo}[${sourceIndex}] to Day ${targetDayNo}`);

                  setTripData((prev: TripData) => {
                    // Deep copy
                    const newData: TripData = {};
                    Object.keys(prev).forEach(key => {
                      const dayNo = Number(key);
                      newData[dayNo] = [...prev[dayNo]];
                    });

                    // Move item
                    if (newData[sourceDayNo] && newData[targetDayNo]) {
                      const [movedItem] = newData[sourceDayNo].splice(sourceIndex, 1);
                      newData[targetDayNo].push(movedItem);

                      // Sort target day by time
                      newData[targetDayNo].sort((a, b) => a.time.localeCompare(b.time));
                    }

                    return newData;
                  });

                  setIsDirty(true);
                  console.log(`✅ Moved to Day ${targetDayNo} successfully`);
                }}
              />
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
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h4" sx={{ color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                ✨ 미리보기
              </Typography>
              {tripId && (
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  startIcon={<SaveIcon />}
                  onClick={handleSaveToDB}
                  disabled={!isDirty || isSaving}
                  sx={{
                    bgcolor: isDirty ? 'primary.main' : 'grey.400',
                    '&:hover': {
                      bgcolor: isDirty ? 'primary.dark' : 'grey.500',
                    },
                  }}
                >
                  {isSaving ? '저장 중...' : isDirty ? '저장' : '저장됨'}
                </Button>
              )}
            </Box>

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
                    {tripTitle}
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
                <Box>
                  <Typography variant="caption" sx={{ opacity: 0.8, display: 'block', mb: 0.5 }}>
                    여행 국가
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {currentTrip?.country_name || countries.find(c => c.country_idx === selectedCountry)?.country_name || '-'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ opacity: 0.8, display: 'block', mb: 0.5 }}>
                    여행 지역
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {currentTrip?.province_name || provinceList.find(r => r.province_idx === selectedProvince)?.name || '-'}
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Box sx={{ bgcolor: 'white', borderRadius: '15px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
              {dayPlans.map((day: DayPlan) => {
                // 해당 일차의 날씨 정보 찾기 (day.date는 "2025-11-17 (일)" 형식이므로 YYYY-MM-DD만 추출)
                const dateOnly = day.date.split(' ')[0]; // "2025-11-17 (일)" → "2025-11-17"
                const dayWeather = weatherData.find(w => w.forecast_date === dateOnly);
                console.log(`🌤️ Day ${day.dayNumber} (${day.date} → ${dateOnly}): weatherData.length=${weatherData.length}, found=${!!dayWeather}`, dayWeather);

                return (
                <Box key={day.dayNumber} sx={{ borderBottom: '1px solid #e9ecef', '&:last-child': { borderBottom: 'none' } }}>
                  <Box sx={{ p: 2.5, bgcolor: '#f8f9fa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 600 }}>
                      Day {day.dayNumber} - {day.date}
                    </Typography>

                    {/* 날씨 정보 */}
                    {dayWeather && (
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', bgcolor: 'white', px: 2, py: 1, borderRadius: '8px' }}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
                            오전
                          </Typography>
                          <Typography sx={{ fontSize: '1.2rem' }}>
                            {dayWeather.weather_am || '☀️'}
                          </Typography>
                          {dayWeather.precipitation_am !== null && (
                            <Typography variant="caption" sx={{ color: '#2196f3' }}>
                              💧{dayWeather.precipitation_am}%
                            </Typography>
                          )}
                        </Box>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
                            오후
                          </Typography>
                          <Typography sx={{ fontSize: '1.2rem' }}>
                            {dayWeather.weather_pm || '☀️'}
                          </Typography>
                          {dayWeather.precipitation_pm !== null && (
                            <Typography variant="caption" sx={{ color: '#2196f3' }}>
                              💧{dayWeather.precipitation_pm}%
                            </Typography>
                          )}
                        </Box>
                        <Box sx={{ textAlign: 'center', ml: 1 }}>
                          <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
                            기온
                          </Typography>
                          <Typography sx={{ fontWeight: 600, color: '#d32f2f' }}>
                            {dayWeather.temp_max_c !== null ? `${dayWeather.temp_max_c}°` : '-'}
                          </Typography>
                          <Typography sx={{ fontSize: '0.75rem', color: '#1976d2' }}>
                            {dayWeather.temp_min_c !== null ? `${dayWeather.temp_min_c}°` : '-'}
                          </Typography>
                        </Box>
                      </Box>
                    )}

                    {!dayWeather && isLoadingWeather && (
                      <CircularProgress size={20} />
                    )}
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
                );
              })}
            </Box>

            {/* 사용자 만족도 수집 */}
            <Box
              sx={{
                bgcolor: 'white',
                borderRadius: '15px',
                p: 3,
                mt: 3,
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                textAlign: 'center',
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                이 여행 계획이 마음에 드시나요?
              </Typography>
              <Typography variant="body2" sx={{ color: '#666', mb: 3 }}>
                여러분의 의견은 더 나은 서비스를 만드는 데 큰 도움이 됩니다
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                <Button
                  variant={userSatisfaction === 'like' ? 'contained' : 'outlined'}
                  size="large"
                  onClick={() => handleSubmitSatisfaction('like')}
                  disabled={satisfactionSubmitted}
                  sx={{
                    minWidth: 120,
                    bgcolor: userSatisfaction === 'like' ? '#4caf50' : 'transparent',
                    borderColor: userSatisfaction === 'like' ? '#4caf50' : '#ddd',
                    color: userSatisfaction === 'like' ? 'white' : '#333',
                    '&:hover': {
                      bgcolor: userSatisfaction === 'like' ? '#45a049' : '#f0f0f0',
                      borderColor: '#4caf50',
                    },
                  }}
                >
                  👍 좋아요
                </Button>
                <Button
                  variant={userSatisfaction === 'dislike' ? 'contained' : 'outlined'}
                  size="large"
                  onClick={() => handleSubmitSatisfaction('dislike')}
                  disabled={satisfactionSubmitted}
                  sx={{
                    minWidth: 120,
                    bgcolor: userSatisfaction === 'dislike' ? '#f44336' : 'transparent',
                    borderColor: userSatisfaction === 'dislike' ? '#f44336' : '#ddd',
                    color: userSatisfaction === 'dislike' ? 'white' : '#333',
                    '&:hover': {
                      bgcolor: userSatisfaction === 'dislike' ? '#e53935' : '#f0f0f0',
                      borderColor: '#f44336',
                    },
                  }}
                >
                  👎 아쉬워요
                </Button>
              </Box>
              {satisfactionSubmitted && (
                <Typography variant="body2" sx={{ color: '#4caf50', mt: 2, fontWeight: 500 }}>
                  ✅ 의견이 제출되었습니다. 감사합니다!
                </Typography>
              )}
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
            {isAuthenticated ? (
              <>
                {/* Invite Button */}
                {tripId && (
                  <Button
                    variant="outlined"
                    color="primary"
                    size="small"
                    startIcon={<GroupAddIcon />}
                    onClick={() => setInviteModalOpen(true)}
                    sx={{ mr: 1 }}
                  >
                    초대
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
                <Button
                  onClick={() => router.push('/login')}
                  variant="outlined"
                  color="primary"
                  size="small"
                >
                  로그인
                </Button>
                <Button
                  onClick={() => router.push('/signup')}
                  variant="contained"
                  color="primary"
                  size="small"
                >
                  회원가입
                </Button>
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
          }}
        >
          {/* 선택된 Day 안내 - 고정 영역 */}
          <Box
            sx={{
              py: 1,
              px: 2,
              bgcolor: selectedDayNo ? '#364C84' : '#e0e0e0',
              color: selectedDayNo ? 'white' : '#666',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              height: '48px',
            }}
          >
            {selectedDayNo ? (
              <>
                <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '0.95rem' }}>
                  📌 Day {selectedDayNo} 선택됨 - 장소 검색 후 + 버튼으로 추가하세요
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setSelectedDayNo(null)}
                  sx={{
                    color: 'white',
                    borderColor: 'white',
                    fontSize: '0.8rem',
                    py: 0.5,
                    px: 1.5,
                    '&:hover': {
                      borderColor: 'white',
                      bgcolor: 'rgba(255,255,255,0.1)',
                    },
                  }}
                >
                  선택 해제
                </Button>
              </>
            ) : (
              <Typography variant="body1" sx={{ fontStyle: 'italic', fontSize: '0.95rem' }}>
                Day를 선택하면 지도에서 검색한 장소를 일정에 추가할 수 있습니다
              </Typography>
            )}
          </Box>
          <KakaoMapSearch
            ref={kakaoMapRef}
            onPlaceSelect={(place) => {
              // 장소 클릭 시 지도 위치만 이동, 추가는 안 함
              console.log('🗺️ 선택된 장소 (위치 이동만):', place.ko_name || place.name);
              // 지도는 KakaoMapSearch 컴포넌트 내부에서 자동으로 이동됨
            }}
            onPlaceAdd={(place) => {
              if (!selectedDayNo) {
                console.warn('⚠️ Day가 선택되지 않음');
                return;
              }

              console.log(`➕ Day ${selectedDayNo}에 장소 추가:`, place);

              // 선택된 장소를 스케줄로 변환
              const placeTypes = place.types || '';
              const ratingInfo = place.rating ? `\n평점: ${place.rating}⭐` : '';

              // 해당 Day의 마지막 일정 시간 가져오기
              const daySchedules = tripData[selectedDayNo] || [];
              let defaultTime = '09:00'; // 기본 시작 시간

              if (daySchedules.length > 0) {
                // 마지막 일정의 시간에서 1시간 추가
                const lastTime = daySchedules[daySchedules.length - 1].time;
                const [hours, minutes] = lastTime.split(':').map(Number);
                const nextHour = (hours + 1) % 24;
                defaultTime = `${String(nextHour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
              }

              const newSchedule: ScheduleItem = {
                time: defaultTime,
                location: place.ko_name || place.name,
                description: `${place.address || ''}${placeTypes ? `\n카테고리: ${placeTypes}` : ''}${ratingInfo}`,
                icon: '📍',
              };

              handleSaveSchedule(newSchedule, selectedDayNo);
              console.log(`✅ Day ${selectedDayNo}에 "${newSchedule.location}" 추가 완료 (시간: ${defaultTime})`);
            }}
            selectedDayNo={selectedDayNo}
            initialCenter={{ lat: 37.5665, lng: 126.9780 }}
            initialZoom={10}
            recommendedPlaces={recommendedPlaces}
            tripData={tripData}
          />
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
        onMessage={(message: any) => {
          // 사용자 메시지일 때 명령어 파싱
          if (!message.is_bot && message.content) {
            const command = parseChatbotCommand(message.content);
            if (command && command.action === 'add' && command.place && command.day) {
              console.log('📝 사용자가 장소 추가 요청:', command);
              // 사용자가 직접 명령했을 때는 표시만 하고, 봇 응답을 기다림
            }
          }

          // 봇 메시지일 때 처리
          if (message.is_bot && message.content) {
            console.log('🤖 챗봇 메시지 수신:', message.content);

            // RAG 추천은 별도 이벤트로 처리되므로 여기서는 파싱하지 않음
            if (!message.content.includes('[RAG_RECOMMENDATION]')) {
              // 장소 추천 파싱 (지도 마커용)
              const { places, details } = parseRecommendedPlaces(message.content);
              if (places.length > 0) {
                console.log('📍 추출된 추천 장소:', places);
                console.log('📝 추천 상세 정보:', details);
                setRecommendedPlaces(places);
                setRecommendationDetails(details);
                setRecommendationPanelVisible(true); // 하단 패널 표시
                setRecommendationPanelExpanded(true); // 확장 상태로 오픈

                // 추천 장소가 있으면 채팅창에 마크다운 메시지 표시하지 않음
                // UI 패널로만 표시하고 메시지 추가를 건너뜀
                return;
              }
            }

            // 챗봇 응답에서 장소 추가 명령 확인
            const command = parseChatbotCommand(message.content);
            if (command && command.action === 'add' && command.place) {
              const targetDay = command.day || 1;
              console.log(`✅ 챗봇이 Day ${targetDay}에 "${command.place}" 추가 확인됨`);

              // 카카오맵 SDK로 장소 검색
              if (typeof window !== 'undefined' && window.kakao && window.kakao.maps) {
                const ps = new window.kakao.maps.services.Places();
                ps.keywordSearch(command.place, (data: any[], status: any) => {
                  if (status === window.kakao.maps.services.Status.OK && data.length > 0) {
                    const place = data[0];
                    console.log('🔍 장소 검색 성공:', place.place_name);

                    // 일정에 추가
                    const newSchedule: ScheduleItem = {
                      time: '09:00', // 기본 시간
                      location: place.place_name,
                      description: place.address_name || place.road_address_name || '',
                      icon: '📍',
                    };

                    if (dayPlans.length > 0 && targetDay <= dayPlans.length) {
                      handleSaveSchedule(newSchedule, targetDay);
                      console.log(`✅ Day ${targetDay}에 "${newSchedule.location}" 자동 추가됨`);
                    } else {
                      console.warn('⚠️ dayPlans가 없거나 targetDay가 범위를 벗어남');
                    }
                  } else {
                    console.warn(`⚠️ "${command.place}" 검색 결과 없음`);
                  }
                });
              }
            }
          }
        }}
        onPlannerUpdate={(data: { updated_by: string; update_type: string; trip_idx: number; message: string }) => {
          console.log('🔄 Planner update received in planner.tsx:', data);

          // RAG 추천은 별도 이벤트로 처리되므로 여기서는 파싱하지 않음
          if (data.message && !data.message.includes('[RAG_RECOMMENDATION]')) {
            const { places, details } = parseRecommendedPlaces(data.message);
            if (places.length > 0) {
              console.log('🤖 챗봇이 추천한 장소들:', places);
              console.log('📝 추천 상세 정보:', details);
              setRecommendedPlaces(places);
              setRecommendationDetails(details);
              setRecommendationPanelVisible(true);
              setRecommendationPanelExpanded(true);
            }
          }

          // 날짜 변경 감지 - 전체 데이터 다시 로드
          if (data.update_type === 'dates_changed') {
            console.log('📅 Date change detected! Reloading all trip data...');
          }

          // Reload data from backend (날짜, 일정 모두 포함)
          loadDaysData();

          // 세션 데이터도 다시 로드 (RAG 추천이 세션에 저장되었을 수 있음)
          if (tripId) {
            const sessionData = loadPlannerSession(tripId);
            if (sessionData && sessionData.tripData) {
              console.log('🔄 세션에서 tripData 다시 로드:', sessionData.tripData);
              setTripData(sessionData.tripData);
              setIsDirty(sessionData.isDirty || false);
              console.log('✅ 세션 데이터 반영 완료 (RAG 추천 포함)');
            }
          }
        }}
        onMapSearch={(keyword: string, region?: string) => {
          console.log('🗺️ Map search triggered from chatbot:', { keyword, region });
          // Call KakaoMapSearch search method via ref
          if (kakaoMapRef.current) {
            kakaoMapRef.current.search(keyword);
          } else {
            console.warn('⚠️ KakaoMapSearch ref not available');
          }
        }}
        onRagRecommendations={(data: { query: string; rag_results: any[]; refined_plan: any; trip_idx: number; message: string }) => {
          console.log('✨ RAG recommendations received in planner.tsx:', data);

          // refined_plan 형식: { day_1: [{place, time, reason, address, ...}], day_2: [...] }
          const { refined_plan } = data;

          if (!refined_plan || Object.keys(refined_plan).length === 0) {
            console.warn('⚠️ No refined plan data');
            return;
          }

          // tripData에 추가 (세션만, DB 저장 안 함)
          setTripData((prevTripData) => {
            const updatedTripData = { ...prevTripData };

            Object.entries(refined_plan).forEach(([dayKey, places]: [string, any]) => {
              const dayNo = parseInt(dayKey.split('_')[1]);

              // Initialize day if not exists
              if (!updatedTripData[dayNo]) {
                updatedTripData[dayNo] = [];
              }

              // 각 장소를 ScheduleItem으로 변환하여 추가
              places.forEach((place: any) => {
                const newItem: ScheduleItem = {
                  time: place.time || '09:00',
                  location: place.place,
                  description: place.reason ? `💡 ${place.reason}\n${place.address || ''}` : (place.address || ''),
                  icon: '🎯',
                  // Kakao에서 검색한 좌표 포함 (마커 표시용)
                  latitude: place.latitude,
                  longitude: place.longitude,
                };

                // 중복 확인 (같은 장소명이 이미 있으면 스킵)
                const isDuplicate = updatedTripData[dayNo].some(
                  (item) => item.location === newItem.location
                );

                if (!isDuplicate) {
                  updatedTripData[dayNo].push(newItem);
                  console.log(`✅ Added "${newItem.location}" to Day ${dayNo} with coords (${place.latitude}, ${place.longitude})`);
                } else {
                  console.log(`⏭️ Skipped duplicate: "${newItem.location}" in Day ${dayNo}`);
                }
              });
            });

            // 세션에 저장
            if (tripId) {
              savePlannerSession(tripId, {
                tripData: updatedTripData,
                startDate,
                endDate,
                travelers,
                selectedDestination,
                selectedCountry,
                selectedProvince,
                activeStep,
                viewMode,
                selectedDay,
                isDirty: true, // 저장 버튼 활성화
              });
              console.log('💾 RAG recommendations saved to session');
            }

            return updatedTripData;
          });

          // 세션 상태를 dirty로 표시 (저장 버튼 활성화)
          setIsDirty(true);

          console.log('✅ RAG recommendations added to tripData and session (not saved to DB yet)');
        }}
        onTripDatesUpdated={(data: { trip_idx: number; start_date: string; end_date: string; total_days: number; message: string }) => {
          console.log('📅 Trip dates updated event received:', data);

          // 날짜 업데이트
          setStartDate(new Date(data.start_date));
          setEndDate(new Date(data.end_date));

          // DB에서 데이터 다시 로드
          loadDaysData();

          // 사용자에게 알림
          alert(data.message);
        }}
        tripTitle={tripTitle}
      />

      <InviteCodeModal
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        tripId={tripId || 0}
        tripTitle={tripTitle}
      />

      {/* Place Search Sidebar */}
      <PlaceSearchSidebar
        ref={placeSearchSidebarRef}
        open={searchSidebarOpen}
        onClose={() => setSearchSidebarOpen(false)}
        selectedDay={searchTargetDay}
        onPlaceAdd={async (place, time) => {
          console.log('Adding place:', place, 'at', time, 'to day', searchTargetDay);
          if (!searchTargetDay) {
            alert('날짜를 선택해주세요');
            return;
          }

          // Add place to the selected day
          const newItem: ScheduleItem = {
            time: time || '09:00',
            location: place.ko_name || place.name,
            description: place.address || '',
            icon: '📍',
          };

          setDayPlans(prev => prev.map(day =>
            day.dayNumber === searchTargetDay
              ? { ...day, schedules: [...day.schedules, newItem] }
              : day
          ));

          // Close sidebar and show success message
          setSearchSidebarOpen(false);
          setSaveSuccess(true);
        }}
      />

      {/* 추천 장소 하단 패널 */}
      {recommendationPanelVisible && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 0,
            left: '40%',
            right: 0,
            bgcolor: 'white',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
            zIndex: 1300,
            maxHeight: recommendationPanelExpanded ? '50vh' : 'auto',
            display: 'flex',
            flexDirection: 'column',
            transition: 'max-height 0.3s ease-in-out',
          }}
        >
          {/* 패널 헤더 */}
          <Box
            sx={{
              p: 2,
              bgcolor: '#364C84',
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
            }}
            onClick={() => setRecommendationPanelExpanded(!recommendationPanelExpanded)}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                ⭐ AI 추천 장소
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                ({recommendationDetails.length}곳)
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton
                size="small"
                sx={{ color: 'white' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setRecommendationPanelExpanded(!recommendationPanelExpanded);
                }}
              >
                {recommendationPanelExpanded ? '▼' : '▲'}
              </IconButton>
              <IconButton
                size="small"
                sx={{ color: 'white' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setRecommendationPanelVisible(false);
                }}
              >
                ✕
              </IconButton>
            </Box>
          </Box>

          {/* 패널 내용 */}
          {recommendationPanelExpanded && (
            <Box
              sx={{
                flex: 1,
                overflowX: 'auto',
                overflowY: 'hidden',
                p: 2,
              }}
            >
              <Box sx={{ display: 'flex', gap: 2, minWidth: 'fit-content' }}>
                {recommendationDetails.map((place, index) => (
                  <Box
                    key={index}
                    sx={{
                      minWidth: '320px',
                      maxWidth: '320px',
                      border: '1px solid #e0e0e0',
                      borderRadius: '12px',
                      p: 2,
                      transition: 'all 0.2s',
                      '&:hover': {
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        borderColor: '#364C84',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'start', gap: 1, mb: 1 }}>
                      <Typography
                        sx={{
                          bgcolor: '#FFD700',
                          color: '#333',
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold',
                          fontSize: '0.875rem',
                          flexShrink: 0,
                        }}
                      >
                        {place.index}
                      </Typography>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                          {place.name}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#666', fontSize: '0.875rem' }}>
                          {place.description}
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        fullWidth
                        onClick={() => {
                          // 지도에서 검색
                          if (kakaoMapRef.current) {
                            kakaoMapRef.current.search(place.name);
                          }
                        }}
                        sx={{ textTransform: 'none' }}
                      >
                        🗺️ 지도에서 보기
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        fullWidth
                        onClick={() => {
                          if (!selectedDayNo) {
                            alert('먼저 일차를 선택해주세요!');
                            setActiveStep(3); // 일차별 계획 탭으로 이동
                            return;
                          }
                          // 일정에 추가
                          const daySchedules = tripData[selectedDayNo] || [];
                          let defaultTime = '09:00';

                          if (daySchedules.length > 0) {
                            const lastTime = daySchedules[daySchedules.length - 1].time;
                            const [hours, minutes] = lastTime.split(':').map(Number);
                            const nextHour = (hours + 1) % 24;
                            defaultTime = `${String(nextHour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                          }

                          const newSchedule: ScheduleItem = {
                            time: defaultTime,
                            location: place.name,
                            description: place.description,
                            icon: '⭐',
                          };

                          handleSaveSchedule(newSchedule, selectedDayNo);
                          console.log(`✅ Day ${selectedDayNo}에 "${place.name}" 추가 완료`);
                        }}
                        sx={{
                          bgcolor: '#364C84',
                          '&:hover': {
                            bgcolor: '#2a3a66',
                          },
                          textTransform: 'none',
                        }}
                      >
                        ➕ Day {selectedDayNo || '?'}에 추가
                      </Button>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      )}

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
