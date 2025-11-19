// Planner Types and Interfaces

export interface TravelInfo {
  time: string;
  distance: string;
  method: string;
}

export interface ScheduleItem {
  time: string;
  location: string;
  description: string;
  icon: string;
  travel?: TravelInfo;
  // RAG/Kakao에서 가져온 좌표 (마커 표시용)
  latitude?: number;
  longitude?: number;
}

export interface DayPlan {
  dayNumber: number;
  dayIdx: number; // DB의 day_idx
  date: string;
  schedules: ScheduleItem[];
  weather?: WeatherData;
  budget?: number;
}

export interface WeatherData {
  current: {
    icon: string;
    temp: number;
    description: string;
    feelsLike: number;
  };
  forecast: ForecastDay[];
}

export interface ForecastDay {
  day: string;
  icon: string;
  temp: string;
}

export interface Location {
  name: string;
  description: string;
  city: string;
  icon?: string;
  rating?: number;
  reviews?: number;
  placeData?: any; // Original place data from API
}

export interface Accommodation {
  name: string;
  description: string;
  city: string;
  price: string;
  budget: 'low' | 'mid' | 'high';
  type: string;
}

export interface DestinationInfo {
  name: string;
  timezone: string;
  language: string;
  location: string;
  voltage: string;
  plugType: string;
  currency: string;
  exchangeRate: string;
  weather: WeatherData;
  tips: TravelTip[];
}

export interface TravelTip {
  icon: string;
  text: string;
}

export interface TripData {
  [dayNumber: number]: ScheduleItem[];
}

export interface ChatMessage {
  text: string;
  type: 'bot' | 'user';
  time: string;
}

export type SearchType = 'location' | 'accommodation';
export type BudgetFilter = 'all' | 'low' | 'mid' | 'high';
export type ViewMode = 'card' | 'timeline';
