import api from './api';

export interface Country {
  country_idx: number;
  country_code: number;
  iso2: string;
  country_name: string;
  name_local?: string;
}

export interface Province {
  province_idx: number;
  country: number;
  country_name?: string;
  country_iso2?: string;
  code: string;
  name: string;
  short_name?: string;
  name_en?: string;
  short_name_en?: string;
  grid_x?: number;
  grid_y?: number;
  latitude?: string;
  longitude?: string;
  level: number;
}

export interface City {
  city_idx: number;
  province: number;
  province_name?: string;
  country_name?: string;
  code: string;
  name: string;
  short_name?: string;
  name_en?: string;
  short_name_en?: string;
  grid_x?: number;
  grid_y?: number;
  latitude?: string;
  longitude?: string;
  level: number;
}

export interface District {
  district_idx: number;
  city: number;
  city_name?: string;
  province_name?: string;
  code: string;
  name: string;
  short_name?: string;
  name_en?: string;
  short_name_en?: string;
  grid_x?: number;
  grid_y?: number;
  latitude?: string;
  longitude?: string;
  level: number;
  full_address?: string;
}

const commonAPI = {
  // Get all countries
  getCountries: async (): Promise<Country[]> => {
    const response = await api.get('/api/common/countries/');
    return response.data.results || response.data;
  },

  // Get all provinces (시/도)
  getProvinces: async (): Promise<Province[]> => {
    const response = await api.get('/api/common/provinces/');
    return response.data.results || response.data;
  },

  // Get provinces by country
  getProvincesByCountry: async (countryIdx: number): Promise<Province[]> => {
    const response = await api.get(`/api/common/provinces/?country=${countryIdx}`);
    return response.data.results || response.data;
  },

  // Get all cities (시/군/구)
  getCities: async (): Promise<City[]> => {
    const response = await api.get('/api/common/cities/');
    return response.data.results || response.data;
  },

  // Get cities by province
  getCitiesByProvince: async (provinceIdx: number): Promise<City[]> => {
    const response = await api.get(`/api/common/cities/?province=${provinceIdx}`);
    return response.data.results || response.data;
  },

  // Get all districts (읍/면/동)
  getDistricts: async (): Promise<District[]> => {
    const response = await api.get('/api/common/districts/');
    return response.data.results || response.data;
  },

  // Get districts by city
  getDistrictsByCity: async (cityIdx: number): Promise<District[]> => {
    const response = await api.get(`/api/common/districts/?city=${cityIdx}`);
    return response.data.results || response.data;
  },
};

export default commonAPI;
