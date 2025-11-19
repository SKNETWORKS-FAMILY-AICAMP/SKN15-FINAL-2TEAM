import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './useAuth';

export interface ChatMessage {
  message_idx?: number;
  user?: {
    user_idx: number;
    email: string;
  };
  is_bot: boolean;
  msg_type: 'text' | 'system' | 'bot';
  content: string;
  payload_json?: any;
  created_at: string;
}

export interface ChatMember {
  user_idx: number;
  email: string;
  role: string;
  is_online?: boolean;
  is_typing?: boolean;
}

interface UseCollaborativeChatOptions {
  roomId: number;
  onMessage?: (message: ChatMessage) => void;
  onMemberUpdate?: (members: ChatMember[]) => void;
  onTypingUpdate?: (userId: number, isTyping: boolean) => void;
  onPlannerUpdate?: (data: { updated_by: string; update_type: string; trip_idx: number; message: string }) => void;
  onMapSearch?: (keyword: string, region?: string) => void;
  onRagRecommendations?: (data: { query: string; rag_results: any[]; refined_plan: any; trip_idx: number; message: string }) => void;
  onTripDatesUpdated?: (data: { trip_idx: number; start_date: string; end_date: string; total_days: number; message: string }) => void;
}

export function useCollaborativeChat({
  roomId,
  onMessage,
  onMemberUpdate,
  onTypingUpdate,
  onPlannerUpdate,
  onMapSearch,
  onRagRecommendations,
  onTripDatesUpdated,
}: UseCollaborativeChatOptions) {
  const { token, user } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<ChatMember[]>([]);
  const pendingMessagesRef = useRef<Set<string>>(new Set());

  // Connect to WebSocket
  const connect = useCallback(() => {
    // Only connect if we have a valid token and roomId > 0
    if (!token || !roomId || roomId <= 0) {
      console.log('Skipping WebSocket connection - missing token or invalid roomId:', { token: !!token, roomId });
      return;
    }

    // Close existing connection
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      wsRef.current.close();
      return; // Wait for onclose to trigger reconnect
    }

    // Use the correct WebSocket URL (through nginx) with JWT token
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Always use port 80 (nginx) for WebSocket, not 3000
    const host = window.location.hostname; // hostname without port
    const wsUrl = `${protocol}//${host}/ws/chat/${roomId}/?token=${token}`;
    console.log('Connecting to WebSocket:', wsUrl.replace(token, 'TOKEN'));
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      // Clear any pending reconnection attempts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = undefined;
      }
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'chat_message':
        case 'bot_message':
          const msgData = data.message || data;
          const messageId = msgData.content; // Use content as temporary ID for deduplication

          // Skip if this is a pending message we already added optimistically
          if (pendingMessagesRef.current.has(messageId)) {
            console.log('⚠️ Skipping pending message (already added optimistically):', messageId.substring(0, 50));
            pendingMessagesRef.current.delete(messageId);

            // Update the temporary message with the real message_idx from server
            setMessages(prev => prev.map(m =>
              m.content === messageId && typeof m.message_idx === 'number' && m.message_idx > 1000000000000 // Find optimistic message (has timestamp as ID)
                ? { ...m, message_idx: msgData.message_idx, created_at: msgData.created_at } // Update with real data
                : m
            ));
            break;
          }

          const newMessage: ChatMessage = {
            message_idx: msgData.message_idx,
            user: msgData.user_idx ? { user_idx: msgData.user_idx, email: msgData.user_email } : undefined,
            is_bot: msgData.user_idx === null || msgData.user_idx === undefined,
            msg_type: msgData.msg_type,
            content: msgData.content,
            payload_json: msgData.payload_json,
            created_at: msgData.created_at,
          };

          // 중복 체크: message_idx 또는 content가 이미 존재하면 추가하지 않음
          setMessages(prev => {
            // message_idx가 있고, 이미 존재하는 경우 중복으로 간주
            if (newMessage.message_idx && prev.some(m => m.message_idx === newMessage.message_idx)) {
              console.log('⚠️ Duplicate message detected (by message_idx), skipping:', newMessage.message_idx, newMessage.content.substring(0, 50));
              return prev;
            }
            // content와 is_bot 상태가 같고, 1초 이내에 추가된 메시지는 중복으로 간주
            const isDuplicateContent = prev.some(m => {
              if (m.content !== newMessage.content) return false;
              if (m.is_bot !== newMessage.is_bot) return false;
              const timeDiff = Math.abs(new Date(m.created_at).getTime() - new Date(newMessage.created_at).getTime());
              return timeDiff < 1000; // 1초 이내
            });
            if (isDuplicateContent) {
              console.log('⚠️ Duplicate message detected (by content), skipping:', newMessage.content.substring(0, 50));
              return prev;
            }
            console.log('✅ Adding new message:', newMessage.message_idx, 'is_bot:', newMessage.is_bot, newMessage.content.substring(0, 50));
            return [...prev, newMessage];
          });

          if (onMessage) onMessage(newMessage);
          break;

        case 'member_list':
          console.log('📋 Member list received:', data.members.length, 'members');
          setMembers(data.members);
          if (onMemberUpdate) onMemberUpdate(data.members);
          break;

        case 'member_joined':
        case 'member_left':
          console.log('📢 Member event:', data.type, data);
          console.log('📢 Event data:', JSON.stringify(data, null, 2));
          // Update member list with FORCED re-render
          setMembers(prev => {
            console.log('📊 Current members before update:', prev.length, prev);
            console.log('📊 Previous array:', prev);

            if (data.type === 'member_joined') {
              // Check if member already exists to prevent duplicates
              const exists = prev.some((m: ChatMember) => m.user_idx === data.member.user_idx);
              if (exists) {
                console.log('⚠️ Member already exists, skipping add');
                // IMPORTANT: Return prev (same reference) to avoid unnecessary re-render
                return prev;
              }
              console.log('✅ Adding new member:', data.member.email);
              // FORCE new array creation to trigger re-render
              const newMembers = [...prev, data.member];
              console.log('📊 Members after add:', newMembers.length, newMembers);
              console.log('📊 Array reference changed:', prev !== newMembers);
              return newMembers;
            } else {
              console.log('👋 Removing member:', data.user_idx);
              // FORCE new array creation to trigger re-render
              const newMembers = prev.filter((m: ChatMember) => m.user_idx !== data.user_idx);
              console.log('📊 Members after remove:', newMembers.length);
              console.log('📊 Array reference changed:', prev !== newMembers);
              return newMembers;
            }
          });
          // Force update callback
          if (onMemberUpdate) {
            onMemberUpdate(data.members || []);
          }
          break;

        case 'typing':
          if (onTypingUpdate) onTypingUpdate(data.user_idx, data.is_typing);
          setMembers(prev => prev.map((m: ChatMember) =>
            m.user_idx === data.user_idx
              ? { ...m, is_typing: data.is_typing }
              : m
          ));
          break;

        case 'planner_updated':
          console.log('📢 Planner updated:', data);
          if (onPlannerUpdate) {
            onPlannerUpdate({
              updated_by: data.updated_by,
              update_type: data.update_type,
              trip_idx: data.trip_idx,
              message: data.message
            });
          }
          break;

        case 'map_search':
          console.log('🗺️ Map search requested:', data);
          if (onMapSearch) {
            onMapSearch(data.keyword, data.region);
          }
          break;

        case 'rag_recommendations':
          console.log('✨ RAG recommendations received:', data);
          if (onRagRecommendations) {
            onRagRecommendations({
              query: data.query,
              rag_results: data.rag_results,
              refined_plan: data.refined_plan,
              trip_idx: data.trip_idx,
              message: data.message
            });
          }
          break;

        case 'trip_dates_updated':
          console.log('📅 Trip dates updated:', data);
          if (onTripDatesUpdated) {
            onTripDatesUpdated({
              trip_idx: data.trip_idx,
              start_date: data.start_date,
              end_date: data.end_date,
              total_days: data.total_days,
              message: data.message
            });
          }
          break;

        case 'error':
          console.error('WebSocket error:', data.message);
          break;
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);

      // Clear any existing reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      // Attempt to reconnect after 3 seconds (only if token and roomId are still valid)
      if (token && roomId && roomId > 0) {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect...');
          connect();
        }, 3000);
      }
    };

    wsRef.current = ws;
  }, [token, roomId]); // Remove callback dependencies to prevent reconnection loops

  // Send message
  const sendMessage = useCallback((content: string, msgType: 'text' | 'bot' = 'text') => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected');
      return;
    }

    // Optimistic UI update - add message immediately
    const optimisticMessage: ChatMessage = {
      message_idx: Date.now(), // Temporary ID
      user: user ? { user_idx: user.user_idx, email: user.email } : undefined,
      is_bot: false,
      msg_type: msgType,
      content: content,
      created_at: new Date().toISOString(),
    };

    // Add to pending messages set to prevent duplicate when server echoes back
    pendingMessagesRef.current.add(content);

    // Add message to UI immediately
    setMessages(prev => [...prev, optimisticMessage]);

    // Send to server
    wsRef.current.send(JSON.stringify({
      type: 'chat_message',
      msg_type: msgType,
      content: content,
    }));

    // Clean up pending message after timeout (in case server never responds)
    setTimeout(() => {
      pendingMessagesRef.current.delete(content);
    }, 5000);
  }, [user]);

  // Send typing indicator
  const sendTyping = useCallback((isTyping: boolean) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    wsRef.current.send(JSON.stringify({
      type: 'typing',
      is_typing: isTyping,
    }));
  }, []);

  // Load message history from REST API
  const loadHistory = useCallback(async (limit: number = 50, offset: number = 0) => {
    if (!roomId || !token) {
      console.log('Cannot load history: missing roomId or token');
      return;
    }

    console.log(`Loading message history for room ${roomId}...`);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ''}/api/chat/rooms/${roomId}/messages/?limit=${limit}&offset=${offset}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log(`Loaded ${data.length} messages`);
        // Reverse messages since backend returns newest first
        const reversedMessages = data.reverse();
        setMessages(reversedMessages);
        return reversedMessages;
      } else {
        console.error('Failed to load messages:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Failed to load message history:', error);
    }
  }, [roomId, token]);

  // Connect on mount
  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  // Load history when connected
  useEffect(() => {
    if (isConnected && roomId && token) {
      loadHistory();
    }
  }, [isConnected]); // Only depend on isConnected to avoid infinite loop

  // Debug: Track members state changes
  useEffect(() => {
    console.log('🔍 [useCollaborativeChat] members state changed!');
    console.log('🔍 [useCollaborativeChat] New members count:', members.length);
    console.log('🔍 [useCollaborativeChat] Members:', members);
  }, [members]);

  return {
    isConnected,
    messages,
    members,
    sendMessage,
    sendTyping,
    loadHistory,
  };
}
