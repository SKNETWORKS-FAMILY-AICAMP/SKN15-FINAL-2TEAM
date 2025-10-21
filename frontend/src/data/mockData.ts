import { Location, Accommodation, DestinationInfo, ScheduleItem } from '../types/planner';

export const mockLocations: Record<string, Location[]> = {
  '도쿄': [
    { name: '센소지', description: '도쿄에서 가장 오래된 절', city: '도쿄', icon: '⛩️' },
    { name: '도쿄 스카이트리', description: '634m 높이의 전망대', city: '도쿄', icon: '🗼' },
    { name: '시부야 스크램블', description: '세계에서 가장 붐비는 교차로', city: '도쿄', icon: '🚶' },
    { name: '메이지 신궁', description: '도심 속 평화로운 신사', city: '도쿄', icon: '⛩️' },
    { name: '츠키지 시장', description: '신선한 해산물 시장', city: '도쿄', icon: '🐟' },
  ],
  '파리': [
    { name: '에펠탑', description: '파리의 상징', city: '파리', icon: '🗼' },
    { name: '루브르 박물관', description: '세계 최대 박물관', city: '파리', icon: '🏛️' },
    { name: '노트르담', description: '고딕 양식의 대성당', city: '파리', icon: '⛪' },
    { name: '샹젤리제 거리', description: '파리의 대표 거리', city: '파리', icon: '🛍️' },
    { name: '몽마르트', description: '예술가들의 언덕', city: '파리', icon: '🎨' },
  ],
  '제주도': [
    { name: '한라산', description: '제주도의 중심 화산', city: '제주도', icon: '⛰️' },
    { name: '성산일출봉', description: '유네스코 세계문화유산', city: '제주도', icon: '🌄' },
    { name: '우도', description: '아름다운 작은 섬', city: '제주도', icon: '🏝️' },
    { name: '만장굴', description: '세계적인 용암동굴', city: '제주도', icon: '🕳️' },
    { name: '협재 해수욕장', description: '에메랄드빛 해변', city: '제주도', icon: '🏖️' },
  ],
};

export const mockAccommodations: Record<string, Accommodation[]> = {
  '도쿄': [
    { name: '호텔 그라시아 시부야', description: '시부야역 도보 3분', city: '도쿄', price: '₩150,000/박', budget: 'mid', type: '호텔' },
    { name: '아사쿠사 게스트하우스', description: '전통 게스트하우스', city: '도쿄', price: '₩40,000/박', budget: 'low', type: '게스트하우스' },
    { name: '신주쿠 그란벨 호텔', description: '신주쿠 중심가', city: '도쿄', price: '₩180,000/박', budget: 'mid', type: '호텔' },
    { name: '긴자 럭셔리 스위트', description: '최고급 편의시설', city: '도쿄', price: '₩450,000/박', budget: 'high', type: '럭셔리 호텔' },
    { name: '우에노 비즈니스 호텔', description: '합리적인 가격', city: '도쿄', price: '₩80,000/박', budget: 'low', type: '비즈니스 호텔' },
  ],
  '파리': [
    { name: '호텔 드 루브르', description: '루브르 박물관 인근', city: '파리', price: '€200/박', budget: 'high', type: '부티크 호텔' },
    { name: '몽마르트 호스텔', description: '배낭 여행객 추천', city: '파리', price: '€35/박', budget: 'low', type: '호스텔' },
    { name: '에펠 가든 호텔', description: '에펠탑 전망', city: '파리', price: '€180/박', budget: 'mid', type: '호텔' },
    { name: '샹젤리제 스위트', description: '샹젤리제 거리', city: '파리', price: '€350/박', budget: 'high', type: '럭셔리 호텔' },
    { name: '마레 지구 아파트', description: '편안한 아파트', city: '파리', price: '€120/박', budget: 'mid', type: '에어비앤비' },
  ],
  '제주도': [
    { name: '제주 오션뷰 리조트', description: '바다가 보이는 리조트', city: '제주도', price: '₩200,000/박', budget: 'high', type: '리조트' },
    { name: '서귀포 게스트하우스', description: '가성비 좋은 숙소', city: '제주도', price: '₩50,000/박', budget: 'low', type: '게스트하우스' },
    { name: '한라산 펜션', description: '자연 속 힐링', city: '제주도', price: '₩120,000/박', budget: 'mid', type: '펜션' },
    { name: '애월 럭셔리 풀빌라', description: '프라이빗 수영장', city: '제주도', price: '₩450,000/박', budget: 'high', type: '풀빌라' },
    { name: '제주시 비즈니스 호텔', description: '편리한 위치', city: '제주도', price: '₩80,000/박', budget: 'mid', type: '호텔' },
  ],
};

export const destinationData: Record<string, DestinationInfo> = {
  '도쿄': {
    name: '도쿄',
    timezone: 'UTC+9 (한국과 동일)',
    language: '일본어',
    location: '일본 혼슈 간토 지방',
    voltage: '100V',
    plugType: 'A형 (플러그 어댑터 필요)',
    currency: '엔화 (¥)',
    exchangeRate: '₩1,000 = ¥108',
    weather: {
      current: {
        icon: '☀️',
        temp: 18,
        description: '맑음',
        feelsLike: 16,
      },
      forecast: [
        { day: '내일', icon: '⛅', temp: '20°/14°' },
        { day: '모레', icon: '🌧️', temp: '17°/12°' },
        { day: '3일 후', icon: '☀️', temp: '22°/15°' },
      ],
    },
    tips: [
      { icon: '🍱', text: '편의점 도시락이 훌륭해요!' },
      { icon: '🚇', text: 'JR 패스를 미리 구매하면 경제적이에요' },
      { icon: '🔌', text: '플러그 어댑터(A형)를 꼭 준비하세요' },
      { icon: '🌊', text: '날씨 변화가 심하니 여벌 옷을 준비하세요' },
    ],
  },
  '파리': {
    name: '파리',
    timezone: 'UTC+1 (한국보다 8시간 늦음)',
    language: '프랑스어',
    location: '프랑스 일드프랑스',
    voltage: '220V',
    plugType: 'C/E형',
    currency: '유로 (€)',
    exchangeRate: '₩1,000 = €0.72',
    weather: {
      current: {
        icon: '⛅',
        temp: 15,
        description: '구름 조금',
        feelsLike: 13,
      },
      forecast: [
        { day: '내일', icon: '🌧️', temp: '14°/10°' },
        { day: '모레', icon: '⛅', temp: '16°/11°' },
        { day: '3일 후', icon: '☀️', temp: '18°/12°' },
      ],
    },
    tips: [
      { icon: '🥐', text: '아침 일찍 빵집을 방문해보세요!' },
      { icon: '🎫', text: '박물관 패스로 줄서기를 피하세요' },
      { icon: '👮', text: '소매치기를 주의하세요' },
      { icon: '🌧️', text: '우산을 항상 준비하세요' },
    ],
  },
  '제주도': {
    name: '제주도',
    timezone: 'UTC+9',
    language: '한국어',
    location: '대한민국 제주특별자치도',
    voltage: '220V',
    plugType: 'C형',
    currency: '원화 (₩)',
    exchangeRate: '-',
    weather: {
      current: {
        icon: '☀️',
        temp: 22,
        description: '맑음',
        feelsLike: 21,
      },
      forecast: [
        { day: '내일', icon: '☀️', temp: '23°/17°' },
        { day: '모레', icon: '⛅', temp: '21°/16°' },
        { day: '3일 후', icon: '🌧️', temp: '19°/15°' },
      ],
    },
    tips: [
      { icon: '🚗', text: '렌터카로 여행하는 것이 편리해요' },
      { icon: '🐎', text: '말고기와 흑돼지를 맛보세요' },
      { icon: '🌊', text: '해녀 박물관을 방문해보세요' },
      { icon: '☔', text: '변덕스러운 날씨, 우비를 준비하세요' },
    ],
  },
};

export const sampleTripData: Record<number, ScheduleItem[]> = {
  1: [
    {
      time: '09:00',
      location: '호텔 출발',
      description: '아침 식사 후 출발',
      icon: '🏨',
    },
    {
      time: '10:30',
      location: '센소지 방문',
      description: '도쿄에서 가장 오래된 절 관람',
      icon: '⛩️',
      travel: { time: '30분', distance: '5km', method: '지하철' },
    },
    {
      time: '12:00',
      location: '점심 식사',
      description: '현지 라멘 맛집',
      icon: '🍜',
      travel: { time: '15분', distance: '1km', method: '도보' },
    },
    {
      time: '14:00',
      location: '도쿄 스카이트리',
      description: '전망대에서 도쿄 시내 조망',
      icon: '🗼',
      travel: { time: '20분', distance: '3km', method: '택시' },
    },
    {
      time: '17:00',
      location: '아사쿠사 거리 산책',
      description: '기념품 쇼핑',
      icon: '🛍️',
      travel: { time: '10분', distance: '800m', method: '도보' },
    },
    {
      time: '19:00',
      location: '저녁 식사 및 호텔 귀환',
      description: '현지 이자카야',
      icon: '🍱',
      travel: { time: '25분', distance: '4km', method: '지하철' },
    },
  ],
  2: [
    {
      time: '08:30',
      location: '호텔 조식',
      description: '호텔에서 조식',
      icon: '🏨',
    },
    {
      time: '10:00',
      location: '메이지 신궁',
      description: '평화로운 신사 방문',
      icon: '⛩️',
      travel: { time: '35분', distance: '6km', method: '지하철' },
    },
    {
      time: '12:30',
      location: '하라주쿠 거리',
      description: '젊음의 거리 탐방 및 쇼핑',
      icon: '🛍️',
      travel: { time: '5분', distance: '500m', method: '도보' },
    },
    {
      time: '14:00',
      location: '점심 식사',
      description: '크레페와 간식',
      icon: '🍰',
    },
    {
      time: '16:00',
      location: '시부야 스크램블',
      description: '유명한 교차로 체험',
      icon: '🚶',
      travel: { time: '10분', distance: '2km', method: '지하철' },
    },
    {
      time: '18:30',
      location: '저녁 & 호텔',
      description: '시부야에서 저녁식사',
      icon: '🍜',
      travel: { time: '20분', distance: '3km', method: '지하철' },
    },
  ],
  3: [
    {
      time: '09:00',
      location: '츠키지 시장',
      description: '신선한 해산물 아침',
      icon: '🐟',
      travel: { time: '30분', distance: '5km', method: '지하철' },
    },
    {
      time: '12:00',
      location: '긴자 거리',
      description: '고급 쇼핑 지구 탐방',
      icon: '🛍️',
      travel: { time: '15분', distance: '2km', method: '도보' },
    },
  ],
};
