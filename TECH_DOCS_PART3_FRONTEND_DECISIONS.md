# TriPlan 프로젝트 종합 기술 문서 - Part 3: 프론트엔드 및 기술 선택 근거

> **작성일**: 2025-01-20
> **Part 3**: Next.js 프론트엔드 아키텍처 및 기술 의사결정

---

## 📋 목차

1. [프론트엔드 아키텍처](#1-프론트엔드-아키텍처)
2. [페이지 구조 분석](#2-페이지-구조-분석)
3. [컴포넌트 설계](#3-컴포넌트-설계)
4. [상태 관리 전략](#4-상태-관리-전략)
5. [WebSocket 클라이언트 구현](#5-websocket-클라이언트-구현)
6. [기술 스택 선택 근거](#6-기술-스택-선택-근거)
7. [아키텍처 의사결정 기록 (ADR)](#7-아키텍처-의사결정-기록-adr)

---

## 1. 프론트엔드 아키텍처

### 1.1 계층 구조

```
┌─────────────────────────────────────────────────────┐
│              Presentation Layer                      │
│  ┌──────────────────────────────────────────────┐  │
│  │  Pages (Next.js File-based Routing)          │  │
│  │  - index.tsx, login.tsx, planner.tsx, ...    │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                       ↓ uses
┌─────────────────────────────────────────────────────┐
│              Component Layer                         │
│  ┌──────────────────────────────────────────────┐  │
│  │  React Components (src/components/)          │  │
│  │  - Header, Calendar, KakaoMap, ...           │  │
│  │  - DayPlanningCard, TimelineView, ...        │  │
│  │  - UnifiedChatWidget, InviteCodeModal, ...   │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                       ↓ uses
┌─────────────────────────────────────────────────────┐
│              Logic Layer                             │
│  ┌──────────────────────────────────────────────┐  │
│  │  Custom Hooks (src/hooks/)                   │  │
│  │  - useAuth: 인증 상태 관리                  │  │
│  │  - useCollaborativeChat: WebSocket 연결     │  │
│  └──────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────┐  │
│  │  API Services (src/services/)                │  │
│  │  - api.ts: Axios 인스턴스 + 인터셉터        │  │
│  │  - tripAPI.ts: 여행 API 호출               │  │
│  │  - chatAPI.ts: 채팅 API 호출               │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                       ↓ communicates with
┌─────────────────────────────────────────────────────┐
│              Backend Layer                           │
│  - REST API (HTTP)                                   │
│  - WebSocket (WS)                                    │
└─────────────────────────────────────────────────────┘
```

### 1.2 디렉토리 구조 상세

```
frontend/
├── pages/                          # Next.js 페이지 (라우팅)
│   ├── _app.tsx                   # 앱 래퍼 (전역 설정)
│   ├── _document.tsx              # HTML 문서 템플릿
│   ├── index.tsx                  # 홈페이지 (/)
│   ├── login.tsx                  # 로그인 (/login)
│   ├── signup.tsx                 # 회원가입 (/signup)
│   ├── planner.tsx                # 플래너 메인 (/planner)
│   ├── trips.tsx                  # 여행 목록 (/trips)
│   ├── mypage.tsx                 # 마이페이지 (/mypage)
│   └── planner/
│       └── [inviteCode].tsx       # 초대 코드로 접속 (/planner/ABC123)
│
├── src/
│   ├── components/                # React 컴포넌트
│   │   ├── Header.tsx             # 공통 헤더
│   │   └── planner/               # 플래너 관련 컴포넌트
│   │       ├── Calendar.tsx       # 날짜 선택 캘린더
│   │       ├── DayPlanningCard.tsx # 일차별 계획 카드
│   │       ├── TimelineView.tsx   # 타임라인 뷰
│   │       ├── WeatherWidget.tsx  # 날씨 위젯
│   │       ├── KakaoMap.tsx       # 카카오 지도
│   │       ├── UnifiedChatWidget.tsx # 통합 채팅 위젯
│   │       ├── InviteCodeModal.tsx # 초대 코드 모달
│   │       └── ScheduleModal.tsx  # 일정 추가/수정 모달
│   │
│   ├── hooks/                     # Custom React Hooks
│   │   ├── useAuth.ts             # 인증 상태 관리
│   │   └── useCollaborativeChat.ts # WebSocket 채팅
│   │
│   ├── services/                  # API 서비스 레이어
│   │   ├── api.ts                 # Axios 설정 + 인터셉터
│   │   ├── tripAPI.ts             # 여행 API
│   │   ├── chatAPI.ts             # 채팅 API
│   │   ├── placesAPI.ts           # 장소 API
│   │   └── commonAPI.ts           # 공통 API
│   │
│   ├── types/                     # TypeScript 타입 정의
│   │   └── planner.ts             # 플래너 관련 타입
│   │
│   ├── theme/                     # Material-UI 테마
│   │   └── theme.ts               # 커스텀 테마 설정
│   │
│   ├── utils/                     # 유틸리티 함수
│   │   └── plannerStorage.ts     # 로컬 스토리지 관리
│   │
│   └── data/                      # 목 데이터 (개발용)
│       └── mockData.ts
│
├── public/                        # 정적 파일
│   ├── favicon.ico
│   └── images/
│
├── package.json                   # NPM 패키지
├── tsconfig.json                  # TypeScript 설정
├── next.config.js                 # Next.js 설정
└── Dockerfile                     # Docker 이미지
```

---

## 2. 페이지 구조 분석

### 2.1 페이지별 책임과 기능

#### **2.1.1 pages/_app.tsx**

**역할**: 모든 페이지의 래퍼, 전역 설정

```tsx
function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Component {...pageProps} />
    </ThemeProvider>
  );
}
```

**책임**:
- Material-UI 테마 적용
- 전역 CSS 리셋 (CssBaseline)
- 모든 페이지 공통 레이아웃

---

#### **2.1.2 pages/index.tsx (홈페이지)**

**라우트**: `/`

**기능**:
- 랜딩 페이지
- 로그인/회원가입 버튼
- 서비스 소개

**주요 컴포넌트**:
- `<Header />` - 네비게이션 바
- 히어로 섹션
- 기능 소개 섹션

---

#### **2.1.3 pages/login.tsx**

**라우트**: `/login`

**기능**:
- 이메일 + 비밀번호 로그인
- JWT 토큰 발급 및 저장
- 로그인 성공 시 `/trips`로 리다이렉트

**API 호출**:
```tsx
const handleLogin = async () => {
  try {
    const response = await authAPI.login(email, password);
    localStorage.setItem('access_token', response.access);
    localStorage.setItem('refresh_token', response.refresh);
    router.push('/trips');
  } catch (error) {
    setError('로그인 실패');
  }
};
```

---

#### **2.1.4 pages/signup.tsx**

**라우트**: `/signup`

**기능**:
- 회원가입 폼 (이메일, 비밀번호, 비밀번호 확인)
- 입력 검증
- 회원가입 성공 시 `/login`으로 리다이렉트

---

#### **2.1.5 pages/trips.tsx (여행 목록)**

**라우트**: `/trips`

**기능**:
- 내가 속한 여행 목록 조회
- 새 여행 만들기
- 여행 클릭 시 `/planner?trip_id={id}`로 이동

**상태 관리**:
```tsx
const [trips, setTrips] = useState<TripPlan[]>([]);
const [isLoading, setIsLoading] = useState(true);

useEffect(() => {
  const loadTrips = async () => {
    const data = await tripAPI.getTrips();
    // 내가 Owner인 여행과 Member인 여행 분리
    const myTrips = data.filter(t =>
      t.members.find(m => m.user_idx === user.user_idx && m.role === 'owner')
    );
    const sharedTrips = data.filter(t =>
      t.members.find(m => m.user_idx === user.user_idx && m.role !== 'owner')
    );
    setMyTrips(myTrips);
    setSharedTrips(sharedTrips);
  };
  loadTrips();
}, []);
```

---

#### **2.1.6 pages/planner.tsx (플래너 메인) ⭐ 핵심**

**라우트**: `/planner?trip_id={id}`

**기능**:
- 여행 계획 작성 및 수정
- 일차별 계획 관리
- 실시간 협업 채팅
- 날씨 정보 표시
- 지도 표시 (Kakao Map)
- 멤버 초대
- 초대 코드 생성

**주요 상태**:
```tsx
// 기본 여행 정보
const [tripId, setTripId] = useState<number | null>(null);
const [currentTrip, setCurrentTrip] = useState<TripPlan | null>(null);
const [startDate, setStartDate] = useState<Date | null>(null);
const [endDate, setEndDate] = useState<Date | null>(null);

// 위치 정보
const [selectedCountry, setSelectedCountry] = useState<number | null>(null);
const [selectedRegion1, setSelectedRegion1] = useState<number | null>(null);

// 일차별 계획
const [dayPlans, setDayPlans] = useState<DayPlan[]>([]);

// UI 상태
const [activeStep, setActiveStep] = useState(1);
const [viewMode, setViewMode] = useState<ViewMode>('timeline');
const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
const [inviteModalOpen, setInviteModalOpen] = useState(false);

// 저장 상태
const [isDirty, setIsDirty] = useState(false);
const [isSaving, setIsSaving] = useState(false);
```

**핵심 함수**:

**1) 데이터 로드**:
```tsx
const loadDaysData = async () => {
  if (!tripId) return;

  // 1. 여행 정보 로드
  const trip = await tripAPI.getTrip(tripId);
  setCurrentTrip(trip);

  // 2. 날짜 설정
  if (trip.start_date && trip.end_date) {
    setStartDate(parseDateFromDB(trip.start_date));
    setEndDate(parseDateFromDB(trip.end_date));
  }

  // 3. 위치 정보 설정
  if (trip.country_idx) setSelectedCountry(trip.country_idx);
  if (trip.region1_idx) setSelectedRegion1(trip.region1_idx);

  // 4. 일차별 데이터 로드
  const days = trip.days || [];
  const dayPlansData = await Promise.all(
    days.map(async (day: any) => {
      const items = await tripAPI.getItemsByDay(day.day_idx);
      return {
        day: day.day_no,
        date: new Date(day.date),
        schedules: items.map(convertToScheduleItem)
      };
    })
  );
  setDayPlans(dayPlansData);
};
```

**2) 저장**:
```tsx
const handleSaveAll = async () => {
  if (!tripId || !startDate || !endDate) return;

  setIsSaving(true);

  try {
    // 1. 여행 정보 업데이트
    await tripAPI.updateTrip(tripId, {
      title: currentTrip?.title || '새 여행',
      start_date: formatDateForDB(startDate),
      end_date: formatDateForDB(endDate),
      country_idx: selectedCountry,
      region1_idx: selectedRegion1,
    });

    // 2. 일차별 데이터 저장
    for (const dayPlan of dayPlans) {
      // Day 생성 또는 업데이트
      const dayData = {
        trip_idx: tripId,
        day_no: dayPlan.day,
        date: formatDateForDB(dayPlan.date)
      };

      let dayId = dayPlan.dayId;
      if (!dayId) {
        const newDay = await tripAPI.createDay(dayData);
        dayId = newDay.day_idx;
      }

      // 각 일정 아이템 저장
      for (const schedule of dayPlan.schedules) {
        const itemData = convertToTripItem(schedule, dayId);
        if (schedule.id) {
          await tripAPI.updateItem(schedule.id, itemData);
        } else {
          await tripAPI.createItem(itemData);
        }
      }
    }

    setSaveSuccess(true);
    setIsDirty(false);
  } catch (error) {
    setSaveError('저장 실패');
  } finally {
    setIsSaving(false);
  }
};
```

**3) 실시간 동기화** (WebSocket 연동):
```tsx
<UnifiedChatWidget
  tripId={tripId}
  tripTitle={currentTrip?.title}
  onPlannerUpdate={(data) => {
    console.log('🔄 Planner update received:', data);
    // 다른 사용자가 수정한 경우 데이터 리로드
    loadDaysData();
  }}
/>
```

**컴포넌트 구조**:
```tsx
<Box>
  {/* 헤더 */}
  <AppBar>
    <Button onClick={handleSaveAll}>저장</Button>
    <Button onClick={() => setInviteModalOpen(true)}>멤버 초대</Button>
  </AppBar>

  {/* 메인 콘텐츠 */}
  <Grid container>
    {/* 왼쪽: 날짜 선택 + 위치 선택 */}
    <Grid item xs={3}>
      <Calendar
        startDate={startDate}
        endDate={endDate}
        onChange={(start, end) => {
          setStartDate(start);
          setEndDate(end);
          setIsDirty(true);
        }}
      />
      <FormControl>
        <InputLabel>국가</InputLabel>
        <Select
          value={selectedCountry}
          onChange={(e) => setSelectedCountry(e.target.value)}
        >
          {countries.map(c => (
            <MenuItem value={c.country_idx}>{c.country_name}</MenuItem>
          ))}
        </Select>
      </FormControl>
    </Grid>

    {/* 중앙: 일차별 계획 */}
    <Grid item xs={6}>
      {viewMode === 'timeline' ? (
        <TimelineView
          dayPlans={dayPlans}
          onAddSchedule={(day) => {
            setSelectedDay(day);
            setScheduleModalOpen(true);
          }}
          onEditSchedule={(item) => {
            setEditingItem(item);
            setScheduleModalOpen(true);
          }}
        />
      ) : (
        dayPlans.map(dayPlan => (
          <DayPlanningCard
            key={dayPlan.day}
            dayPlan={dayPlan}
            onAddSchedule={() => {
              setSelectedDay(dayPlan.day);
              setScheduleModalOpen(true);
            }}
          />
        ))
      )}
    </Grid>

    {/* 오른쪽: 날씨 + 지도 */}
    <Grid item xs={3}>
      <WeatherWidget
        region1_idx={selectedRegion1}
        dates={[startDate, endDate]}
      />
      <KakaoMap
        center={{ lat: 37.5665, lng: 126.9780 }}
        markers={dayPlans.flatMap(d => d.schedules).map(s => s.location)}
      />
    </Grid>
  </Grid>

  {/* 채팅 위젯 (우하단 플로팅) */}
  <UnifiedChatWidget
    tripId={tripId}
    tripTitle={currentTrip?.title}
    onPlannerUpdate={loadDaysData}
  />

  {/* 모달들 */}
  <ScheduleModal
    open={scheduleModalOpen}
    onClose={() => setScheduleModalOpen(false)}
    dayNumber={selectedDay}
    editingItem={editingItem}
    onSave={(item) => {
      // dayPlans 업데이트
      setIsDirty(true);
    }}
  />

  <InviteCodeModal
    open={inviteModalOpen}
    onClose={() => setInviteModalOpen(false)}
    tripId={tripId}
  />
</Box>
```

---

#### **2.1.7 pages/planner/[inviteCode].tsx**

**라우트**: `/planner/ABC123`

**기능**:
- 초대 코드로 여행 접속
- 자동으로 여행 참여 처리
- 참여 완료 후 `/planner?trip_id={id}`로 리다이렉트

```tsx
const JoinByInviteCode = () => {
  const router = useRouter();
  const { inviteCode } = router.query;

  useEffect(() => {
    const joinTrip = async () => {
      if (!inviteCode) return;

      try {
        // 1. 초대 코드로 참여
        const result = await tripAPI.joinByInviteCode(inviteCode as string);

        // 2. 플래너로 리다이렉트
        router.push(`/planner?trip_id=${result.trip_id}`);
      } catch (error) {
        // 에러 처리
      }
    };

    joinTrip();
  }, [inviteCode]);

  return <CircularProgress />;  // 로딩 표시
};
```

---

## 3. 컴포넌트 설계

### 3.1 컴포넌트 계층 구조

```
<Planner>
├── <AppBar>
│   ├── <Button> 저장
│   ├── <Button> 멤버 초대
│   └── <Button> 로그아웃
├── <Grid>
│   ├── <Calendar>
│   ├── <FormControl> 국가 선택
│   ├── <FormControl> 도시 선택
│   └── <TimelineView>
│       └── <DayPlanningCard>
│           └── <ScheduleItem>
├── <WeatherWidget>
├── <KakaoMap>
└── <UnifiedChatWidget>
    └── <CollaborativeChatRoom>
        ├── <ChatMessage>
        └── <ChatInput>
```

### 3.2 주요 컴포넌트 상세

#### **3.2.1 UnifiedChatWidget.tsx (통합 채팅 위젯)**

**위치**: [src/components/planner/UnifiedChatWidget.tsx](frontend/src/components/planner/UnifiedChatWidget.tsx)

**역할**: WebSocket 기반 실시간 채팅 + 플래너 동기화 이벤트 수신

**Props**:
```tsx
interface UnifiedChatWidgetProps {
  tripId: number | null;
  tripTitle?: string;
  onPlannerUpdate?: (data: {
    updated_by: string;
    update_type: string;
    trip_idx: number;
    message: string;
  }) => void;
}
```

**구현**:
```tsx
const UnifiedChatWidget: React.FC<UnifiedChatWidgetProps> = ({
  tripId,
  tripTitle,
  onPlannerUpdate
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<ChatMember[]>([]);

  // WebSocket Hook 사용
  const { sendMessage, isConnected, typingUsers } = useCollaborativeChat({
    roomId: tripId,
    onMessage: (message) => {
      setMessages(prev => [...prev, message]);
    },
    onMemberUpdate: (members) => {
      setMembers(members);
    },
    onTypingUpdate: (userId, isTyping) => {
      // 타이핑 상태 업데이트
    },
    onPlannerUpdate: (data) => {
      // 플래너 업데이트 이벤트 전달
      if (onPlannerUpdate) {
        onPlannerUpdate(data);
      }
    }
  });

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        width: isOpen ? 400 : 60,
        height: isOpen ? 600 : 60,
      }}
    >
      {isOpen ? (
        <Paper elevation={3}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 2 }}>
            <Typography>{tripTitle} 채팅</Typography>
            <IconButton onClick={() => setIsOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>

          {/* 멤버 목록 */}
          <Box sx={{ p: 1 }}>
            {members.map(member => (
              <Chip
                key={member.user_idx}
                label={member.email}
                size="small"
                color={member.is_online ? 'primary' : 'default'}
              />
            ))}
          </Box>

          {/* 메시지 목록 */}
          <Box sx={{ height: 400, overflowY: 'auto', p: 2 }}>
            {messages.map((msg, idx) => (
              <ChatMessage key={idx} message={msg} />
            ))}
          </Box>

          {/* 입력창 */}
          <Box sx={{ p: 2 }}>
            <TextField
              fullWidth
              placeholder="메시지 입력..."
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  sendMessage(e.target.value);
                  e.target.value = '';
                }
              }}
            />
          </Box>
        </Paper>
      ) : (
        <Fab color="primary" onClick={() => setIsOpen(true)}>
          <ChatIcon />
        </Fab>
      )}
    </Box>
  );
};
```

---

#### **3.2.2 KakaoMap.tsx (카카오 지도)**

**위치**: [src/components/planner/KakaoMap.tsx](frontend/src/components/planner/KakaoMap.tsx)

**역할**: 카카오 맵 API를 사용한 지도 표시 및 마커 관리

**Props**:
```tsx
interface KakaoMapProps {
  center: { lat: number; lng: number };
  markers: Array<{ lat: number; lng: number; title: string }>;
  onMarkerClick?: (marker: any) => void;
}
```

**구현**:
```tsx
const KakaoMap: React.FC<KakaoMapProps> = ({ center, markers, onMarkerClick }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);

  useEffect(() => {
    // Kakao Maps SDK 로드
    const script = document.createElement('script');
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_API_KEY}&autoload=false`;
    script.async = true;
    document.head.appendChild(script);

    script.onload = () => {
      window.kakao.maps.load(() => {
        const container = mapRef.current;
        const options = {
          center: new window.kakao.maps.LatLng(center.lat, center.lng),
          level: 3
        };

        const mapInstance = new window.kakao.maps.Map(container, options);
        setMap(mapInstance);
      });
    };
  }, []);

  useEffect(() => {
    if (!map) return;

    // 마커 추가
    markers.forEach(marker => {
      const position = new window.kakao.maps.LatLng(marker.lat, marker.lng);
      const mapMarker = new window.kakao.maps.Marker({
        position,
        map
      });

      window.kakao.maps.event.addListener(mapMarker, 'click', () => {
        if (onMarkerClick) onMarkerClick(marker);
      });
    });
  }, [map, markers]);

  return <div ref={mapRef} style={{ width: '100%', height: '400px' }} />;
};
```

---

## 4. 상태 관리 전략

### 4.1 상태 관리 계층

TriPlan은 **Local State + Custom Hooks** 패턴을 사용합니다.

```
┌────────────────────────────────────────────────┐
│          Local Component State                  │
│  - useState로 UI 상태 관리                     │
│  - 페이지 컴포넌트 내부에서만 사용             │
└────────────────────────────────────────────────┘
                    ↓ shares
┌────────────────────────────────────────────────┐
│          Custom Hooks                           │
│  - useAuth: 인증 상태 공유                     │
│  - useCollaborativeChat: WebSocket 연결 공유   │
└────────────────────────────────────────────────┘
                    ↓ persists
┌────────────────────────────────────────────────┐
│          localStorage                           │
│  - JWT 토큰 저장                                │
│  - 플래너 임시 저장 (세션 유지)                │
└────────────────────────────────────────────────┘
```

**Redux를 사용하지 않은 이유**:
1. **복잡도 증가**: 프로젝트 규모가 Redux가 필요할 만큼 크지 않음
2. **빠른 개발**: useState + Custom Hooks로 충분히 상태 공유 가능
3. **Next.js SSR 호환**: SSR 환경에서 Redux 설정이 복잡함
4. **WebSocket 우선**: 실시간 데이터는 WebSocket으로 동기화

### 4.2 useAuth Hook (인증 상태 관리)

**위치**: [src/hooks/useAuth.ts](frontend/src/hooks/useAuth.ts)

**역할**: JWT 인증 상태 관리 및 사용자 정보 제공

```tsx
export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // 초기 로드 시 토큰 확인
    const checkAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        // /api/accounts/me/ 호출
        const userData = await authAPI.me();
        setUser(userData);
        setIsAuthenticated(true);
      } catch (error) {
        // 토큰 만료 또는 무효
        localStorage.clear();
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await authAPI.login(email, password);
    localStorage.setItem('access_token', response.access);
    localStorage.setItem('refresh_token', response.refresh);
    setUser(response.user);
    setIsAuthenticated(true);
    router.push('/trips');
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      await authAPI.logout(refreshToken);
    }
    localStorage.clear();
    setUser(null);
    setIsAuthenticated(false);
    router.push('/login');
  };

  return { user, isAuthenticated, isLoading, login, logout };
};
```

**사용 예시**:
```tsx
const Planner = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <CircularProgress />;
  }

  if (!isAuthenticated) {
    router.push('/login');
    return null;
  }

  return <div>Hello, {user.email}!</div>;
};
```

---

## 5. WebSocket 클라이언트 구현

### 5.1 useCollaborativeChat Hook

**위치**: [src/hooks/useCollaborativeChat.ts](frontend/src/hooks/useCollaborativeChat.ts)

**역할**: WebSocket 연결 관리 및 메시지 송수신

```tsx
interface UseCollaborativeChatOptions {
  roomId: number;
  onMessage?: (message: ChatMessage) => void;
  onMemberUpdate?: (members: ChatMember[]) => void;
  onTypingUpdate?: (userId: number, isTyping: boolean) => void;
  onPlannerUpdate?: (data: {
    updated_by: string;
    update_type: string;
    trip_idx: number;
    message: string;
  }) => void;
}

export const useCollaborativeChat = (options: UseCollaborativeChatOptions) => {
  const {
    roomId,
    onMessage,
    onMemberUpdate,
    onTypingUpdate,
    onPlannerUpdate
  } = options;

  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!roomId) return;

    // WebSocket 연결
    const token = localStorage.getItem('access_token');
    const wsUrl = `ws://localhost:8001/ws/chat/${roomId}/`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('✅ WebSocket Connected');
      setIsConnected(true);
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('📩 WebSocket Message:', data);

      switch (data.type) {
        case 'chat_message':
          if (onMessage) onMessage(data.message);
          break;

        case 'member_list':
          setMembers(data.members);
          if (onMemberUpdate) onMemberUpdate(data.members);
          break;

        case 'user_joined':
          console.log(`👋 ${data.user_email} joined`);
          break;

        case 'user_left':
          console.log(`👋 ${data.user_email} left`);
          break;

        case 'typing_status':
          if (data.is_typing) {
            setTypingUsers(prev => new Set(prev).add(data.user_idx));
          } else {
            setTypingUsers(prev => {
              const newSet = new Set(prev);
              newSet.delete(data.user_idx);
              return newSet;
            });
          }
          if (onTypingUpdate) onTypingUpdate(data.user_idx, data.is_typing);
          break;

        case 'planner_updated':
          console.log('📢 Planner updated:', data);
          if (onPlannerUpdate) {
            onPlannerUpdate({
              updated_by: data.updated_by,
              update_type: data.update_type,
              trip_idx: data.trip_idx,
              message: data.message
            });
          }
          break;

        case 'bot_message':
          if (onMessage) {
            onMessage({
              ...data.message,
              user_email: 'AI Bot',
              msg_type: 'ai'
            });
          }
          break;

        default:
          console.warn('Unknown message type:', data.type);
      }
    };

    socket.onerror = (error) => {
      console.error('❌ WebSocket Error:', error);
    };

    socket.onclose = () => {
      console.log('🔌 WebSocket Disconnected');
      setIsConnected(false);
    };

    setWs(socket);

    // 정리
    return () => {
      socket.close();
    };
  }, [roomId]);

  // 메시지 전송
  const sendMessage = (content: string) => {
    if (!ws || !isConnected) return;

    ws.send(JSON.stringify({
      type: 'chat_message',
      content
    }));
  };

  // 타이핑 상태 전송
  const sendTyping = (isTyping: boolean) => {
    if (!ws || !isConnected) return;

    ws.send(JSON.stringify({
      type: 'typing',
      is_typing: isTyping
    }));
  };

  return {
    isConnected,
    members,
    typingUsers,
    sendMessage,
    sendTyping
  };
};
```

### 5.2 WebSocket 인증 처리

**문제**: WebSocket 연결 시 JWT 토큰을 어떻게 전달하나?

**해결책**: URL 쿼리 파라미터 또는 첫 메시지로 전달

**백엔드 미들웨어** ([middleware.py](backend/apps/chat/middleware.py)):
```python
class JWTAuthMiddleware:
    """WebSocket 연결 시 JWT 토큰 검증"""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        # 쿼리 파라미터에서 토큰 추출
        query_string = scope.get('query_string', b'').decode()
        token = None
        for param in query_string.split('&'):
            if param.startswith('token='):
                token = param.split('=')[1]
                break

        if token:
            try:
                # JWT 토큰 검증
                validated_token = AccessToken(token)
                user_id = validated_token['user_id']
                user = await get_user_by_id(user_id)
                scope['user'] = user
            except Exception:
                scope['user'] = AnonymousUser()
        else:
            scope['user'] = AnonymousUser()

        return await self.app(scope, receive, send)
```

---

## 6. 기술 스택 선택 근거

### 6.1 프론트엔드 프레임워크: Next.js

**선택 이유**:

1. **SSR (Server-Side Rendering)** 지원
   - 초기 로딩 속도 개선
   - SEO 최적화 (검색 엔진 노출)
   - 소셜 미디어 공유 시 메타 태그 제공

2. **파일 기반 라우팅**
   - `pages/` 디렉토리에 파일 추가만으로 라우팅 자동 생성
   - 직관적이고 간단한 구조
   - 예: `pages/planner.tsx` → `/planner`

3. **API Routes**
   - 백엔드 없이도 간단한 API 엔드포인트 작성 가능
   - 프록시 서버로 활용 가능

4. **빌트인 최적화**
   - 자동 코드 스플리팅 (페이지별 번들 분리)
   - 이미지 최적화 (`next/image`)
   - 폰트 최적화

5. **개발 경험**
   - Hot Module Replacement (HMR)
   - Fast Refresh (상태 유지하며 리로드)
   - TypeScript 지원

**대안 고려**:
- **Create React App (CRA)**: SSR 미지원, 최적화 부족
- **Vite + React**: 빠른 빌드지만 SSR 설정 복잡
- **Gatsby**: 정적 사이트에 최적화, 동적 콘텐츠 불리

---

### 6.2 UI 라이브러리: Material-UI (MUI)

**선택 이유**:

1. **프로페셔널한 디자인**
   - Google Material Design 가이드 준수
   - 일관된 UI/UX

2. **풍부한 컴포넌트**
   - 200+ 컴포넌트 제공
   - Dialog, Snackbar, DatePicker 등 즉시 사용 가능

3. **접근성 (Accessibility)**
   - ARIA 속성 자동 적용
   - 키보드 네비게이션 지원

4. **커스터마이징**
   - 테마 시스템으로 브랜드 색상 적용 가능
   - `sx` prop으로 스타일 오버라이드

5. **TypeScript 지원**
   - 타입 안전성 보장

**대안 고려**:
- **Ant Design**: 중국 시장 초점, 한국 사용자에게 덜 익숙
- **Chakra UI**: 가벼우나 컴포넌트 수 적음
- **Tailwind CSS**: 유틸리티 클래스 기반, 학습 곡선 있음

---

### 6.3 상태 관리: useState + Custom Hooks

**선택 이유**:

1. **단순함**
   - Redux 대비 보일러플레이트 코드 최소화
   - 빠른 개발 속도

2. **적절한 규모**
   - 중소 규모 프로젝트에 적합
   - 전역 상태가 많지 않음 (user, trips만)

3. **React 내장 기능**
   - 추가 라이브러리 불필요
   - 번들 사이즈 감소

4. **WebSocket 우선**
   - 실시간 데이터는 WebSocket으로 동기화
   - 클라이언트 상태는 서버의 복사본

**대안 고려**:
- **Redux**: 전역 상태가 복잡한 대규모 앱에 적합
- **Zustand**: 가벼운 대안, 하지만 이 프로젝트에는 과함
- **Recoil**: Facebook 개발, 아직 실험적

---

### 6.4 HTTP 클라이언트: Axios

**선택 이유**:

1. **인터셉터**
   - Request/Response 가로채기
   - 자동 토큰 갱신 구현 가능
   - 에러 처리 중앙화

2. **자동 JSON 변환**
   - `JSON.stringify()/parse()` 불필요

3. **취소 토큰**
   - 요청 취소 기능 (페이지 이동 시 유용)

4. **브라우저 호환성**
   - IE11 지원 (필요 시)

5. **커뮤니티**
   - 풍부한 예제 및 플러그인

**대안 고려**:
- **fetch API**: 브라우저 내장, 하지만 인터셉터 없음
- **SWR/React Query**: 캐싱 기능 강력, 하지만 학습 곡선

---

### 6.5 TypeScript

**선택 이유**:

1. **타입 안전성**
   - 컴파일 타임 오류 검출
   - 런타임 에러 감소

2. **IDE 지원**
   - 자동완성
   - 리팩토링 지원
   - 문서화 역할

3. **코드 품질**
   - 명시적 타입으로 가독성 향상
   - 팀 협업 시 인터페이스 명확화

4. **Next.js 완벽 지원**
   - Zero-config TypeScript

**대안 고려**:
- **JavaScript**: 빠른 프로토타이핑에는 유리, 하지만 유지보수 어려움

---

## 7. 아키텍처 의사결정 기록 (ADR)

### ADR-001: 백엔드/프론트엔드 분리

**상태**: 승인됨 (Accepted)

**컨텍스트**:
- 백엔드 (Django)와 프론트엔드 (Next.js)를 분리할지, Django 템플릿으로 통합할지 결정 필요

**결정**:
- **분리된 아키텍처** 채택 (REST API + SPA)

**근거**:
1. **독립적 배포**: 백엔드/프론트엔드 각각 배포 가능
2. **기술 선택 자유**: 최신 프론트엔드 프레임워크 사용
3. **모바일 앱 확장**: 동일한 API를 iOS/Android에서 재사용 가능
4. **팀 분업**: 백엔드/프론트엔드 개발자 병렬 작업

**결과**:
- API 서버 (Django) + SPA (Next.js)
- Nginx를 리버스 프록시로 사용

---

### ADR-002: WebSocket 서버 분리

**상태**: 승인됨 (Accepted)

**컨텍스트**:
- WebSocket 서버를 HTTP API 서버와 동일 프로세스에서 실행할지, 분리할지 결정

**결정**:
- **분리된 WebSocket 서버** (Daphne on port 8001)

**근거**:
1. **스케일링**: WebSocket 연결은 long-lived, HTTP는 stateless
2. **격리**: WebSocket 장애가 HTTP API에 영향 주지 않음
3. **리소스 관리**: WebSocket은 메모리 집약적, 별도 프로세스로 제한
4. **Django Channels 권장사항**: ASGI 서버 (Daphne) 분리 권장

**결과**:
- API 서버: Gunicorn (WSGI) on port 8000
- WebSocket 서버: Daphne (ASGI) on port 8001

---

### ADR-003: Redis를 Channel Layer로 사용

**상태**: 승인됨 (Accepted)

**컨텍스트**:
- Django Channels의 Channel Layer 백엔드 선택

**결정**:
- **Redis** 사용 (channels-redis)

**근거**:
1. **Pub/Sub 지원**: 실시간 메시지 브로드캐스트에 최적
2. **성능**: 인메모리 DB로 빠른 속도
3. **확장성**: 멀티 서버 환경에서 메시지 공유 가능
4. **검증됨**: Django Channels 공식 권장

**대안 고려**:
- **InMemoryChannelLayer**: 개발용만 가능, 프로덕션 불가
- **RabbitMQ**: 과도한 복잡성

---

### ADR-004: 초대 코드 기반 멤버 추가

**상태**: 승인됨 (Accepted)

**컨텍스트**:
- 여행 멤버 추가 방식 선택 (이메일 초대 vs 링크 공유)

**결정**:
- **초대 코드 (6자리) + 이메일 초대** 모두 지원

**근거**:
1. **사용자 편의성**: 간단한 코드 공유로 참여 가능
2. **보안**: 만료 시간 설정 (24시간)
3. **접근성**: 이메일 없이도 참여 가능
4. **유연성**: 상황에 따라 방법 선택

**구현**:
- 코드: 대문자 + 숫자 6자리 (예: `ABC123`)
- 만료: 생성 후 24시간
- URL: `/planner/ABC123`

---

### ADR-005: 실시간 플래너 동기화

**상태**: 승인됨 (Accepted)

**컨텍스트**:
- 멀티 유저 환경에서 플래너 데이터 동기화 방법

**결정**:
- **WebSocket + Redis Pub/Sub** 사용

**근거**:
1. **실시간성**: WebSocket으로 즉시 알림
2. **효율성**: 변경 사항만 전파 (전체 데이터 재전송 불필요)
3. **사용자 경험**: Google Docs 같은 협업 경험
4. **기존 인프라 활용**: 채팅용 WebSocket 재사용

**동작 방식**:
1. 사용자 A가 플래너 수정
2. ViewSet에서 Redis Pub/Sub으로 메시지 발행
3. 모든 WebSocket Consumer가 수신
4. 연결된 모든 클라이언트에 `planner_updated` 이벤트 전송
5. 클라이언트에서 데이터 리로드

---

### ADR-006: Apache Airflow for ETL

**상태**: 승인됨 (Accepted)

**컨텍스트**:
- 날씨/환율 정보 자동 수집 방법

**결정**:
- **Apache Airflow** 사용

**근거**:
1. **스케줄링**: Cron보다 강력한 스케줄 표현
2. **모니터링**: Web UI로 작업 상태 확인
3. **재시도**: 실패 시 자동 재시도
4. **확장성**: DAG 추가로 새 작업 손쉽게 추가
5. **산업 표준**: 데이터 엔지니어링 표준 툴

**대안 고려**:
- **Celery Beat**: Django 통합은 쉬우나 모니터링 부족
- **Cron**: 너무 단순, 관리 어려움

---

### ADR-007: pgvector for AI Features

**상태**: 승인됨 (Accepted)

**컨텍스트**:
- AI 추천 기능을 위한 벡터 검색 구현

**결정**:
- **pgvector** 확장 사용 (PostgreSQL에 추가)

**근거**:
1. **통합**: 별도 Vector DB 불필요, PostgreSQL 내에서 해결
2. **성능**: HNSW 인덱스로 빠른 유사도 검색
3. **간편함**: SQL 쿼리로 벡터 검색 가능
4. **비용**: 추가 인프라 불필요

**대안 고려**:
- **Pinecone**: 클라우드 전용, 비용 발생
- **Weaviate**: 별도 서버 필요, 복잡도 증가

---

## 📌 요약

### 전체 아키텍처 특징

1. **마이크로서비스 지향**
   - Frontend, Backend API, WebSocket, Airflow 독립 실행
   - Docker Compose로 오케스트레이션

2. **실시간 협업**
   - WebSocket + Redis Pub/Sub
   - Google Docs 스타일 동시 편집

3. **확장 가능한 설계**
   - 각 서비스 독립 스케일링 가능
   - API 서버 추가 배포 용이

4. **개발자 친화적**
   - Hot Reload (프론트엔드)
   - Docker로 환경 일관성
   - TypeScript로 타입 안전성

5. **프로덕션 준비**
   - Nginx 리버스 프록시
   - JWT 인증
   - Rate Limiting
   - 로깅 및 모니터링

---

**작성자**: Claude Code (AI Assistant)
**최종 업데이트**: 2025-01-20
**총 페이지**: Part 1 + Part 2 + Part 3

---

## 📚 참고 자료

- [Next.js 공식 문서](https://nextjs.org/docs)
- [Django Channels 문서](https://channels.readthedocs.io/)
- [Material-UI 문서](https://mui.com/)
- [Apache Airflow 문서](https://airflow.apache.org/docs/)
- [pgvector GitHub](https://github.com/pgvector/pgvector)
