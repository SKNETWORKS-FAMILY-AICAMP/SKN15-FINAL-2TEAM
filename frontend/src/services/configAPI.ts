/**
 * Configuration API - Get frontend configuration from backend
 */

import api from './api';

export interface FrontendConfig {
  kakaoMapApiKey: string;
}

const configAPI = {
  /**
   * Get frontend configuration including API keys
   */
  getConfig: async (): Promise<FrontendConfig> => {
    const response = await api.get('/api/config/');
    return response.data;
  },
};

export default configAPI;
