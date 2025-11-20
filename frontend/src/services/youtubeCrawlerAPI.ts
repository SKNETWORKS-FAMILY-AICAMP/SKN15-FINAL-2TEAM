import api from './api';

export interface YouTubeCrawlerJob {
  job_idx: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  location: string | null;
  total_urls: number;
  processed_count: number;
  success_count: number;
  fail_count: number;
  progress_percent: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  duration_seconds: number | null;
  created_by: string | null;
  file_path?: string;
}

const youtubeCrawlerAPI = {
  /**
   * 모든 크롤링 작업 목록 조회
   */
  getJobs: async (): Promise<YouTubeCrawlerJob[]> => {
    const response = await api.get('/api/plans/youtube-crawler/');
    return response.data.jobs;
  },

  /**
   * 특정 작업 상세 조회
   */
  getJob: async (jobIdx: number): Promise<YouTubeCrawlerJob> => {
    const response = await api.get(`/api/plans/youtube-crawler/${jobIdx}/`);
    return response.data.job;
  },

  /**
   * 파일 업로드 및 크롤링 작업 시작
   */
  uploadFile: async (file: File): Promise<{ job: YouTubeCrawlerJob; message: string }> => {
    const formData = new FormData();
    formData.append('data_file', file);

    const response = await api.post('/api/plans/youtube-crawler/upload/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return {
      job: response.data.job,
      message: response.data.message,
    };
  },

  /**
   * 작업 중지
   */
  cancelJob: async (jobIdx: number): Promise<{ success: boolean; message: string }> => {
    const response = await api.post(`/api/plans/youtube-crawler/${jobIdx}/cancel/`);
    return response.data;
  },

  /**
   * 크롤링된 데이터 조회
   */
  getCollectedData: async (params: {
    location?: string;
    page?: number;
    page_size?: number;
  }): Promise<{
    data: Array<{
      id: number;
      video_id: string;
      title: string;
      channel: string;
      url: string;
      location: string;
      country: string | null;
      province: string | null;
      city: string | null;
      district: string | null;
      upload_year: number | null;
      upload_month: number | null;
      views: number | null;
      has_parsed_data: boolean;
      created_at: string;
    }>;
    pagination: {
      total: number;
      page: number;
      page_size: number;
      total_pages: number;
    };
  }> => {
    const response = await api.get('/api/plans/youtube-crawler/collected_data/', { params });
    return response.data;
  },
};

export default youtubeCrawlerAPI;
