import api from './api';

export interface WeatherDaily {
  weather_daily_idx: number;
  forecast_date: string;
  weather_am: string | null;
  weather_pm: string | null;
  temp_min_c: number | null;
  temp_max_c: number | null;
  precipitation_am: number | null;
  precipitation_pm: number | null;
}

const weatherAPI = {
  /**
   * 위치 기반 날씨 조회
   */
  getWeatherByLocation: async (params: {
    province_idx?: number;
    city_idx?: number;
    district_idx?: number;
    start_date?: string;
    end_date?: string;
  }): Promise<WeatherDaily[]> => {
    const response = await api.get('/api/weather/daily/by-location/', { params });
    return response.data;
  },

  /**
   * Province 기준 날씨 조회
   */
  getWeatherByProvince: async (
    province_idx: number,
    start_date?: string,
    end_date?: string
  ): Promise<WeatherDaily[]> => {
    const response = await api.get(`/api/weather/daily/by-province/${province_idx}/`, {
      params: { start_date, end_date },
    });
    return response.data;
  },

  /**
   * City 기준 날씨 조회
   */
  getWeatherByCity: async (
    city_idx: number,
    start_date?: string,
    end_date?: string
  ): Promise<WeatherDaily[]> => {
    const response = await api.get(`/api/weather/daily/by-city/${city_idx}/`, {
      params: { start_date, end_date },
    });
    return response.data;
  },

  /**
   * District 기준 날씨 조회
   */
  getWeatherByDistrict: async (
    district_idx: number,
    start_date?: string,
    end_date?: string
  ): Promise<WeatherDaily[]> => {
    const response = await api.get(`/api/weather/daily/by-district/${district_idx}/`, {
      params: { start_date, end_date },
    });
    return response.data;
  },
};

export default weatherAPI;
