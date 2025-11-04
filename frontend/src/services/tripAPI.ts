import api from './api';

// Trip Plan API
export interface TripPlan {
  trip_idx: number;
  owner_user_idx: number;
  title: string;
  country_idx?: number;
  region1_idx?: number;
  region2_idx?: number;
  country_name?: string;
  region1_name?: string;
  region2_name?: string;
  start_date: string;
  end_date: string;
  party_size?: number;
  budget_currency?: string;
  budget_amount?: number;
  status: 'draft' | 'confirmed' | 'archived';
  invite_code?: string;
  invite_code_expires_at?: string;
  user_satisfaction?: 'like' | 'dislike' | null;
  created_at: string;
  updated_at: string;
}

export interface TripDay {
  day_idx: number;
  trip_idx: number;
  day_no: number;
  date: string;
}

export interface TripItem {
  item_idx: number;
  day_idx: number;
  item_type: 'place' | 'meal' | 'activity' | 'transfer' | 'rest' | 'custom';
  place_idx?: number;
  title?: string;
  start_time?: string;
  end_time?: string;
  estimated_cost?: number;
  lock_flag: boolean;
  notes?: string;
  order_in_day: number;
  created_at: string;
  updated_at: string;
}

export interface TripMember {
  trip_member_idx: number;
  trip_idx: number;
  user_idx: number;
  role: 'owner' | 'editor' | 'commenter' | 'viewer';
}

const tripAPI = {
  // Get all trips for current user
  getTrips: async (): Promise<TripPlan[]> => {
    const response = await api.get('/api/plans/trips/');
    // Backend returns paginated response with results array
    return response.data.results || response.data;
  },

  // Get single trip by ID (deprecated - use getTripByCode instead)
  getTrip: async (tripId: number): Promise<TripPlan> => {
    const response = await api.get(`/api/plans/trips/${tripId}/`);
    return response.data;
  },

  // Get trip by invite code (recommended)
  getTripByCode: async (inviteCode: string): Promise<TripPlan> => {
    const response = await api.get(`/api/plans/trips/by-code/${inviteCode.toUpperCase()}/`);
    return response.data;
  },

  // Create new trip
  createTrip: async (data: Partial<TripPlan>): Promise<TripPlan> => {
    const response = await api.post('/api/plans/trips/', data);
    return response.data;
  },

  // Update trip
  updateTrip: async (tripId: number, data: Partial<TripPlan>): Promise<TripPlan> => {
    const response = await api.patch(`/api/plans/trips/${tripId}/`, data);
    return response.data;
  },

  // Delete trip
  deleteTrip: async (tripId: number): Promise<void> => {
    await api.delete(`/api/plans/trips/${tripId}/`);
  },

  // Get trip members
  getMembers: async (tripId: number): Promise<TripMember[]> => {
    const response = await api.get(`/api/plans/trips/${tripId}/members/`);
    return response.data;
  },

  // Invite member
  inviteMember: async (tripId: number, email: string, role: string = 'editor'): Promise<any> => {
    const response = await api.post(`/api/plans/trips/${tripId}/invite/`, {
      email,
      role,
    });
    return response.data;
  },

  // Remove member
  removeMember: async (tripId: number, userIdx: number): Promise<any> => {
    const response = await api.post(`/api/plans/trips/${tripId}/remove_member/`, {
      user_idx: userIdx,
    });
    return response.data;
  },

  // Leave trip
  leaveTrip: async (tripId: number): Promise<any> => {
    const response = await api.post(`/api/plans/trips/${tripId}/leave/`);
    return response.data;
  },

  // Update member role
  updateMemberRole: async (tripId: number, userIdx: number, role: string): Promise<any> => {
    const response = await api.post(`/api/plans/trips/${tripId}/update_role/`, {
      user_idx: userIdx,
      role,
    });
    return response.data;
  },

  // Get trip days
  getDays: async (tripId: number): Promise<TripDay[]> => {
    try {
      const response = await api.get(`/api/plans/days/?trip_idx=${tripId}`);
      console.log('🔍 getDays response:', response);
      console.log('🔍 getDays response.data:', response.data);
      const days = response.data?.results || response.data || [];
      console.log('🔍 getDays returning:', days);
      return days;
    } catch (error) {
      console.error('❌ getDays error:', error);
      return [];
    }
  },

  // Create trip day
  createDay: async (data: Partial<TripDay>): Promise<TripDay> => {
    const response = await api.post('/api/plans/days/', data);
    return response.data;
  },

  // Delete trip day
  deleteDay: async (dayId: number): Promise<void> => {
    await api.delete(`/api/plans/days/${dayId}/`);
  },

  // Get trip items
  getItems: async (dayId: number): Promise<TripItem[]> => {
    const response = await api.get(`/api/plans/items/?day_idx=${dayId}`);
    // Backend returns paginated response with results array
    return response.data.results || response.data;
  },

  // Create trip item
  createItem: async (data: Partial<TripItem>): Promise<TripItem> => {
    const response = await api.post('/api/plans/items/', data);
    return response.data;
  },

  // Update trip item
  updateItem: async (itemId: number, data: Partial<TripItem>): Promise<TripItem> => {
    const response = await api.patch(`/api/plans/items/${itemId}/`, data);
    return response.data;
  },

  // Delete trip item
  deleteItem: async (itemId: number): Promise<void> => {
    await api.delete(`/api/plans/items/${itemId}/`);
  },

  // Generate invite code for trip
  generateInviteCode: async (tripId: number, expiryHours: number = 24): Promise<{
    invite_code: string;
    expires_at: string;
    trip_id: number;
    trip_title: string;
  }> => {
    const response = await api.post(`/api/plans/trips/${tripId}/generate_invite_code/`, {
      expiry_hours: expiryHours,
    });
    return response.data;
  },

  // Join trip using invite code
  joinByCode: async (inviteCode: string): Promise<{
    success: boolean;
    message: string;
    trip_id: number;
    trip_title: string;
    member: any;
  }> => {
    const response = await api.post('/api/plans/trips/join_by_code/', {
      invite_code: inviteCode.toUpperCase(),
    });
    return response.data;
  },

  // Submit user satisfaction
  submitSatisfaction: async (tripId: number, satisfaction: 'like' | 'dislike'): Promise<{
    success: boolean;
    message: string;
    satisfaction: string;
  }> => {
    const response = await api.post(`/api/plans/trips/${tripId}/submit_satisfaction/`, {
      satisfaction,
    });
    return response.data;
  },
};

export default tripAPI;
