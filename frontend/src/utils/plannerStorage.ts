/**
 * Planner Session Storage Helper
 *
 * 플래너의 임시 데이터를 sessionStorage에 저장하고 관리합니다.
 * - 탭을 닫으면 자동으로 데이터가 삭제됩니다
 * - 새로고침 시 데이터를 복원할 수 있습니다
 * - 챗봇/에이전트가 접근할 수 있도록 모든 플래너 정보 저장
 */

import { TripData } from '../types/planner';

const STORAGE_KEY_PREFIX = 'triplan_session_';

interface PlannerSessionData {
  // 기본 여행 정보
  tripId: number | null;
  tripData: TripData;
  startDate: string | null;
  endDate: string | null;
  travelers: string;
  selectedDestination: string;

  // 위치 정보
  selectedCountry: number | null;
  selectedRegion1: number | null;

  // 현재 상태
  activeStep: number;
  viewMode: 'card' | 'timeline';
  selectedDay: number | null;

  // 추가 메타데이터
  lastModified: number;
  isDirty: boolean;
}

/**
 * sessionStorage에 플래너 데이터 저장 (모든 정보)
 */
export const savePlannerSession = (
  tripId: number | null,
  data: {
    tripData: TripData;
    startDate: Date | null;
    endDate: Date | null;
    travelers: string;
    selectedDestination: string;
    selectedCountry?: number | null;
    selectedRegion1?: number | null;
    activeStep?: number;
    viewMode?: 'card' | 'timeline';
    selectedDay?: number | null;
    isDirty?: boolean;
  }
): void => {
  try {
    const sessionData: PlannerSessionData = {
      tripId,
      tripData: data.tripData,
      startDate: data.startDate?.toISOString() || null,
      endDate: data.endDate?.toISOString() || null,
      travelers: data.travelers,
      selectedDestination: data.selectedDestination,
      selectedCountry: data.selectedCountry ?? null,
      selectedRegion1: data.selectedRegion1 ?? null,
      activeStep: data.activeStep ?? 1,
      viewMode: data.viewMode ?? 'timeline',
      selectedDay: data.selectedDay ?? null,
      lastModified: Date.now(),
      isDirty: data.isDirty ?? false,
    };

    const key = `${STORAGE_KEY_PREFIX}${tripId || 'demo'}`;
    sessionStorage.setItem(key, JSON.stringify(sessionData));

    console.log('✅ Session data saved:', key);
  } catch (error) {
    console.error('❌ Failed to save session data:', error);
  }
};

/**
 * sessionStorage에서 플래너 데이터 불러오기
 */
export const loadPlannerSession = (
  tripId: number | null
): PlannerSessionData | null => {
  try {
    const key = `${STORAGE_KEY_PREFIX}${tripId || 'demo'}`;
    const data = sessionStorage.getItem(key);

    if (!data) {
      console.log('ℹ️ No session data found for:', key);
      return null;
    }

    const sessionData: PlannerSessionData = JSON.parse(data);
    console.log('✅ Session data loaded:', key);

    return sessionData;
  } catch (error) {
    console.error('❌ Failed to load session data:', error);
    return null;
  }
};

/**
 * sessionStorage에서 플래너 데이터 삭제
 */
export const clearPlannerSession = (tripId: number | null): void => {
  try {
    const key = `${STORAGE_KEY_PREFIX}${tripId || 'demo'}`;
    sessionStorage.removeItem(key);
    console.log('✅ Session data cleared:', key);
  } catch (error) {
    console.error('❌ Failed to clear session data:', error);
  }
};

/**
 * sessionStorage에 저장된 데이터가 있는지 확인
 */
export const hasPlannerSession = (tripId: number | null): boolean => {
  try {
    const key = `${STORAGE_KEY_PREFIX}${tripId || 'demo'}`;
    return sessionStorage.getItem(key) !== null;
  } catch (error) {
    console.error('❌ Failed to check session data:', error);
    return false;
  }
};

/**
 * 세션 데이터의 마지막 수정 시간 가져오기
 */
export const getSessionLastModified = (tripId: number | null): number | null => {
  try {
    const sessionData = loadPlannerSession(tripId);
    return sessionData?.lastModified || null;
  } catch (error) {
    console.error('❌ Failed to get session last modified:', error);
    return null;
  }
};

/**
 * 챗봇/에이전트가 사용할 수 있는 플래너 정보 요약 (JSON 형식)
 */
export const getPlannerSummaryForAgent = (tripId: number | null): string | null => {
  try {
    const sessionData = loadPlannerSession(tripId);
    if (!sessionData) return null;

    const summary = {
      trip_info: {
        destination: sessionData.selectedDestination,
        start_date: sessionData.startDate,
        end_date: sessionData.endDate,
        travelers: sessionData.travelers,
        country_idx: sessionData.selectedCountry,
        region1_idx: sessionData.selectedRegion1,
      },
      current_state: {
        active_step: sessionData.activeStep,
        view_mode: sessionData.viewMode,
        selected_day: sessionData.selectedDay,
      },
      itinerary: sessionData.tripData,
      metadata: {
        last_modified: sessionData.lastModified,
        has_unsaved_changes: sessionData.isDirty,
      },
    };

    return JSON.stringify(summary, null, 2);
  } catch (error) {
    console.error('❌ Failed to generate planner summary:', error);
    return null;
  }
};

/**
 * localStorage에도 백업 저장 (탭 닫혀도 유지)
 */
export const backupToLocalStorage = (tripId: number | null): void => {
  try {
    const sessionData = loadPlannerSession(tripId);
    if (!sessionData) return;

    const key = `${STORAGE_KEY_PREFIX}backup_${tripId || 'demo'}`;
    localStorage.setItem(key, JSON.stringify(sessionData));
    console.log('✅ Backup saved to localStorage:', key);
  } catch (error) {
    console.error('❌ Failed to backup to localStorage:', error);
  }
};

/**
 * localStorage에서 백업 복원
 */
export const restoreFromLocalStorage = (tripId: number | null): PlannerSessionData | null => {
  try {
    const key = `${STORAGE_KEY_PREFIX}backup_${tripId || 'demo'}`;
    const data = localStorage.getItem(key);

    if (!data) {
      console.log('ℹ️ No backup found in localStorage:', key);
      return null;
    }

    const sessionData: PlannerSessionData = JSON.parse(data);
    console.log('✅ Backup restored from localStorage:', key);

    return sessionData;
  } catch (error) {
    console.error('❌ Failed to restore from localStorage:', error);
    return null;
  }
};

/**
 * localStorage 백업 삭제
 */
export const clearLocalStorageBackup = (tripId: number | null): void => {
  try {
    const key = `${STORAGE_KEY_PREFIX}backup_${tripId || 'demo'}`;
    localStorage.removeItem(key);
    console.log('✅ Backup cleared from localStorage:', key);
  } catch (error) {
    console.error('❌ Failed to clear localStorage backup:', error);
  }
};

/**
 * 모든 플래너 관련 저장소 데이터 조회 (디버깅용)
 */
export const getAllPlannerStorage = (): { [key: string]: any } => {
  const result: { [key: string]: any } = {};

  try {
    // sessionStorage
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
        const value = sessionStorage.getItem(key);
        if (value) {
          result[`session:${key}`] = JSON.parse(value);
        }
      }
    }

    // localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
        const value = localStorage.getItem(key);
        if (value) {
          result[`local:${key}`] = JSON.parse(value);
        }
      }
    }

    return result;
  } catch (error) {
    console.error('❌ Failed to get all planner storage:', error);
    return {};
  }
};
