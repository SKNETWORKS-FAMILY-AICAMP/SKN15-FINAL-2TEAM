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
}

export function useCollaborativeChat({
  roomId,
  onMessage,
  onMemberUpdate,
  onTypingUpdate,
}: UseCollaborativeChatOptions) {
  const { token } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<ChatMember[]>([]);

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
          const newMessage: ChatMessage = {
            message_idx: msgData.message_idx,
            user: msgData.user_idx ? { user_idx: msgData.user_idx, email: msgData.user_email } : undefined,
            is_bot: msgData.user_idx === null || msgData.user_idx === undefined,
            msg_type: msgData.msg_type,
            content: msgData.content,
            payload_json: msgData.payload_json,
            created_at: msgData.created_at,
          };
          setMessages(prev => [...prev, newMessage]);
          if (onMessage) onMessage(newMessage);
          break;

        case 'member_list':
          setMembers(data.members);
          if (onMemberUpdate) onMemberUpdate(data.members);
          break;

        case 'member_joined':
        case 'member_left':
          // Update member list
          setMembers(prev => {
            if (data.type === 'member_joined') {
              return [...prev, data.member];
            } else {
              return prev.filter(m => m.user_idx !== data.user_idx);
            }
          });
          break;

        case 'typing':
          if (onTypingUpdate) onTypingUpdate(data.user_idx, data.is_typing);
          setMembers(prev => prev.map(m =>
            m.user_idx === data.user_idx
              ? { ...m, is_typing: data.is_typing }
              : m
          ));
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

    wsRef.current.send(JSON.stringify({
      type: 'chat_message',
      msg_type: msgType,
      content: content,
    }));
  }, []);

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

  return {
    isConnected,
    messages,
    members,
    sendMessage,
    sendTyping,
    loadHistory,
  };
}
