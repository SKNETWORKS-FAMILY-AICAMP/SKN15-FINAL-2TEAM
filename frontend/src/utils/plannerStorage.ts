/**
 * Planner Session Storage Helper
 *
 * 플래너의 임시 데이터를 sessionStorage에 저장하고 관리합니다.
 * - 탭을 닫으면 자동으로 데이터가 삭제됩니다
 * - 새로고침 시 데이터를 복원할 수 있습니다
 */

import { TripData } from '../types/planner';

const STORAGE_KEY_PREFIX = 'triplan_session_';

interface PlannerSessionData {
  tripData: TripData;
  startDate: string | null;
  endDate: string | null;
  travelers: string;
  selectedDestination: string;
  lastModified: number;
}

/**
 * sessionStorage에 플래너 데이터 저장
 */
export const savePlannerSession = (
  tripId: number | null,
  data: {
    tripData: TripData;
    startDate: Date | null;
    endDate: Date | null;
    travelers: string;
    selectedDestination: string;
  }
): void => {
  try {
    const sessionData: PlannerSessionData = {
      tripData: data.tripData,
      startDate: data.startDate?.toISOString() || null,
      endDate: data.endDate?.toISOString() || null,
      travelers: data.travelers,
      selectedDestination: data.selectedDestination,
      lastModified: Date.now(),
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
