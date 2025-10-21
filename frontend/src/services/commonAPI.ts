import api from './api';

export interface Country {
  country_idx: number;
  country_code: number;
  iso2: string;
  country_name: string;
  name_local?: string;
}

export interface Region1 {
  region1_idx: number;
  country_code: number;
  city_code: number;
  city_name: string;
}

const commonAPI = {
  // Get all countries
  getCountries: async (): Promise<Country[]> => {
    const response = await api.get('/api/common/countries/');
    return response.data.results || response.data;
  },

  // Get all cities (Region1)
  getCities: async (): Promise<Region1[]> => {
    const response = await api.get('/api/common/regions1/');
    return response.data.results || response.data;
  },

  // Get cities by country
  getCitiesByCountry: async (countryCode: number): Promise<Region1[]> => {
    const response = await api.get(`/api/common/regions1/?country_code=${countryCode}`);
    return response.data.results || response.data;
  },
};

export default commonAPI;
