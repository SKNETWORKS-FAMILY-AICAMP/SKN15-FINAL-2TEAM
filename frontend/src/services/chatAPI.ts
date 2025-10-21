import api from './api';

export interface ChatRoom {
  room_idx: number;
  trip_idx: number;
  title?: string;
  created_at: string;
}

export interface ChatMember {
  user_idx: number;
  email: string;
  role: string;
}

export interface CreateRoomForTripRequest {
  trip_id: number;
}

// Chat Room APIs
export const chatAPI = {
  // Get all chat rooms for current user
  getRooms: async (): Promise<ChatRoom[]> => {
    const response = await api.get('/api/chat/rooms/');
    return response.data;
  },

  // Get specific chat room
  getRoom: async (roomId: number): Promise<ChatRoom> => {
    const response = await api.get(`/api/chat/rooms/${roomId}/`);
    return response.data;
  },

  // Create or get chat room for a trip
  createRoomForTrip: async (tripId: number): Promise<ChatRoom> => {
    const response = await api.post('/api/chat/rooms/create_for_trip/', {
      trip_id: tripId,
    });
    return response.data;
  },

  // Get chat messages
  getMessages: async (roomId: number, limit: number = 50, offset: number = 0) => {
    const response = await api.get(`/api/chat/rooms/${roomId}/messages/`, {
      params: { limit, offset },
    });
    return response.data;
  },

  // Send message via REST (fallback)
  sendMessage: async (roomId: number, content: string, msgType: string = 'text') => {
    const response = await api.post(`/api/chat/rooms/${roomId}/send_message/`, {
      content,
      msg_type: msgType,
    });
    return response.data;
  },

  // Get members of a trip (used for inviting)
  getTripMembers: async (tripId: number): Promise<ChatMember[]> => {
    const response = await api.get(`/api/plans/trips/${tripId}/members/`);
    return response.data;
  },

  // Invite member to trip
  inviteMember: async (tripId: number, email: string, role: string = 'editor') => {
    const response = await api.post(`/api/plans/trips/${tripId}/invite/`, {
      email,
      role
    });
    return response.data;
  },

  // Remove member from trip
  removeMember: async (tripId: number, userIdx: number) => {
    const response = await api.post(`/api/plans/trips/${tripId}/remove_member/`, {
      user_idx: userIdx
    });
    return response.data;
  },

  // Update member role
  updateMemberRole: async (tripId: number, userIdx: number, role: string) => {
    const response = await api.post(`/api/plans/trips/${tripId}/update_role/`, {
      user_idx: userIdx,
      role
    });
    return response.data;
  },

  // Leave trip
  leaveTrip: async (tripId: number) => {
    const response = await api.post(`/api/plans/trips/${tripId}/leave/`);
    return response.data;
  },
};

export default chatAPI;
