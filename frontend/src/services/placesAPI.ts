import api from './api';

// Place interfaces
export interface Place {
  place_idx: number;
  place_id: string;
  name: string;
  ko_name?: string;
  country: string;
  region1: string;
  region2?: string;
  address: string;
  latitude: number;
  longitude: number;
  rating?: string;
  user_ratings_total: number;
  types: string;
}

export interface PlaceDetail extends Place {
  google_maps_uri?: string;
  website_uri?: string;
  phone?: string;
  photos?: Photo[];
  created_at: string;
  updated_at: string;
}

export interface Photo {
  photo_idx: number;
  is_primary: boolean;
  width: number;
  height: number;
  local_path?: string;
  remote_uri?: string;
  attributions?: string;
}

export interface PlacesListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Place[];
}

const placesAPI = {
  // Get all places with filters
  getPlaces: async (params?: {
    region1?: string;
    region2?: string;
    country?: string;
    type?: string;
    min_rating?: number;
    search?: string;
    limit?: number;
    page?: number;
  }): Promise<PlacesListResponse> => {
    const queryParams = new URLSearchParams();

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });
    }

    const response = await api.get(`/api/places/places/?${queryParams.toString()}`);
    return response.data;
  },

  // Get single place by ID
  getPlace: async (placeIdx: number): Promise<PlaceDetail> => {
    const response = await api.get(`/api/places/places/${placeIdx}/`);
    return response.data;
  },

  // Search places by keyword
  searchPlaces: async (query: string): Promise<Place[]> => {
    const response = await api.get(`/api/places/places/search/?q=${encodeURIComponent(query)}`);
    return response.data;
  },

  // Get nearby places
  getNearbyPlaces: async (lat: number, lng: number, radius: number = 5): Promise<Place[]> => {
    const response = await api.get(
      `/api/places/places/nearby/?lat=${lat}&lng=${lng}&radius=${radius}`
    );
    return response.data;
  },

  // Get popular places
  getPopularPlaces: async (limit: number = 10): Promise<Place[]> => {
    const response = await api.get(`/api/places/places/popular/?limit=${limit}`);
    return response.data;
  },
};

export default placesAPI;
