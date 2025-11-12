import api from './api';

// Exchange Rate API
export interface ExchangeRate {
  rate_idx: number;
  country_code?: number;
  country_name?: string;
  currency_code: string;
  bank: string;
  buy?: number;
  sell?: number;
  timestamp: string;
  created_at: string;
}

// Weather API
export interface WeatherDaily {
  weather_daily_idx: number;
  country_code?: number;
  country_name?: string;
  province_idx?: number;
  province_name?: string;
  city_idx?: number;
  city_name?: string;
  district_idx?: number;
  district_name?: string;
  forecast_date: string;
  weather_am?: string;
  weather_pm?: string;
  temp_min_c?: number;
  temp_max_c?: number;
  precipitation_am?: number;
  precipitation_pm?: number;
  weather?: string;
  rainfall_mm?: number;
  created_at: string;
  updated_at?: string;
}

// Travel Alert API
export interface TripAlert {
  alert_idx?: number;
  country_code?: number;
  country_name?: string;
  level: string;
  url?: string;
  created_at?: string;
}

const travelInfoAPI = {
  // Exchange Rates
  getExchangeRateByCountry: async (countryCode: number): Promise<ExchangeRate[]> => {
    const response = await api.get(`/api/exchange/rates/by-country/${countryCode}/`);
    return response.data;
  },

  getExchangeRateByCurrency: async (currencyCode: string): Promise<ExchangeRate> => {
    const response = await api.get(`/api/exchange/rates/by-currency/${currencyCode}/`);
    return response.data;
  },

  // Weather
  getWeatherByCity: async (cityCode: number): Promise<WeatherDaily[]> => {
    const response = await api.get(`/api/weather/daily/by-city/${cityCode}/`);
    return response.data;
  },

  getWeatherByDateRange: async (
    cityCode: number,
    startDate: string,
    endDate: string
  ): Promise<WeatherDaily[]> => {
    const response = await api.get('/api/weather/daily/by-date-range/', {
      params: { city_code: cityCode, start_date: startDate, end_date: endDate },
    });
    return response.data;
  },

  getWeatherByLocation: async (
    provinceIdx?: number,
    cityIdx?: number,
    districtIdx?: number,
    startDate?: string,
    endDate?: string
  ): Promise<WeatherDaily[]> => {
    const params: Record<string, any> = {};
    if (provinceIdx) params.province_idx = provinceIdx;
    if (cityIdx) params.city_idx = cityIdx;
    if (districtIdx) params.district_idx = districtIdx;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    const response = await api.get('/api/weather/daily/by-location/', { params });
    return response.data;
  },

  // Travel Alerts
  getTravelAlertByCountry: async (countryCode: number): Promise<TripAlert> => {
    const response = await api.get(`/api/alerts/travel/by-country/${countryCode}/`);
    return response.data;
  },
};

export default travelInfoAPI;
