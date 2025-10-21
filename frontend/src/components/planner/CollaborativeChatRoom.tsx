'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  TextField,
  IconButton,
  Typography,
  Avatar,
  Chip,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Send as SendIcon,
  SmartToy as BotIcon,
  Person as PersonIcon,
  Circle as CircleIcon,
} from '@mui/icons-material';
import { useCollaborativeChat, ChatMessage, ChatMember } from '@/hooks/useCollaborativeChat';

interface CollaborativeChatRoomProps {
  roomId: number;
  tripTitle: string;
}

export default function CollaborativeChatRoom({ roomId, tripTitle }: CollaborativeChatRoomProps) {
  const [inputMessage, setInputMessage] = useState('');
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    isConnected,
    messages,
    members,
    sendMessage,
    sendTyping,
  } = useCollaborativeChat({
    roomId,
    onMessage: (message) => {
      console.log('New message:', message);
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle typing indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value);

    // Send typing indicator
    sendTyping(true);

    // Clear existing timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }

    // Set new timeout to stop typing indicator
    const timeout = setTimeout(() => {
      sendTyping(false);
    }, 1000);
    setTypingTimeout(timeout);
  };

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    // Check if message mentions bot
    const mentionsBot = inputMessage.includes('@봇') || inputMessage.includes('@bot');
    const msgType = mentionsBot ? 'bot' : 'text';

    sendMessage(inputMessage, msgType);
    setInputMessage('');
    sendTyping(false);

    // Clear typing timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }

    // Focus back on input
    inputRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTypingMembers = () => {
    return members.filter(m => m.is_typing);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper
        sx={{
          p: 2,
          borderRadius: 0,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'primary.main',
          color: 'white',
        }}
      >
        <Typography variant="h6" gutterBottom>
          {tripTitle} - 협업 채팅방
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          {!isConnected && (
            <Chip
              icon={<CircularProgress size={16} sx={{ color: 'white !important' }} />}
              label="연결 중..."
              size="small"
              sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
            />
          )}
          {isConnected && (
            <Chip
              icon={<CircleIcon sx={{ fontSize: 12, color: '#4caf50' }} />}
              label="연결됨"
              size="small"
              sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
            />
          )}
          <Typography variant="caption" sx={{ opacity: 0.9 }}>
            참여자 {members.length}명
          </Typography>
          {members.map((member) => (
            <Tooltip key={member.user_idx} title={`${member.email} (${member.role})`}>
              <Avatar
                sx={{
                  width: 28,
                  height: 28,
                  bgcolor: member.is_online ? 'success.main' : 'grey.500',
                  fontSize: 14,
                }}
              >
                {member.email[0].toUpperCase()}
              </Avatar>
            </Tooltip>
          ))}
        </Box>
      </Paper>

      {/* Messages Area */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: 2,
          bgcolor: '#f5f5f5',
        }}
      >
        <List sx={{ p: 0 }}>
          {messages.map((message, index) => (
            <ListItem
              key={message.message_idx || index}
              alignItems="flex-start"
              sx={{
                px: 0,
                py: 1,
                flexDirection: message.is_bot ? 'row' : 'row',
              }}
            >
              <ListItemAvatar>
                <Avatar
                  sx={{
                    bgcolor: message.is_bot ? 'secondary.main' : 'primary.main',
                  }}
                >
                  {message.is_bot ? <BotIcon /> : <PersonIcon />}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography variant="subtitle2" fontWeight="bold">
                      {message.is_bot ? 'AI 봇' : message.user?.email || '알 수 없음'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatMessageTime(message.created_at)}
                    </Typography>
                    {message.msg_type === 'bot' && (
                      <Chip label="AI 응답" size="small" color="secondary" sx={{ height: 20 }} />
                    )}
                  </Box>
                }
                secondary={
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.5,
                      bgcolor: message.is_bot ? 'secondary.light' : 'white',
                      borderRadius: 2,
                      mt: 0.5,
                      maxWidth: '80%',
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {message.content}
                    </Typography>
                    {message.payload_json && (
                      <Box sx={{ mt: 1, p: 1, bgcolor: 'rgba(0,0,0,0.05)', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          {JSON.stringify(message.payload_json, null, 2)}
                        </Typography>
                      </Box>
                    )}
                  </Paper>
                }
              />
            </ListItem>
          ))}
        </List>

        {/* Typing Indicators */}
        {getTypingMembers().length > 0 && (
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="caption" color="text.secondary" fontStyle="italic">
              {getTypingMembers().map(m => m.email).join(', ')}님이 입력 중...
            </Typography>
          </Box>
        )}

        <div ref={messagesEndRef} />
      </Box>

      <Divider />

      {/* Input Area */}
      <Paper
        elevation={3}
        sx={{
          p: 2,
          borderRadius: 0,
          bgcolor: 'white',
        }}
      >
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
          <TextField
            inputRef={inputRef}
            fullWidth
            multiline
            maxRows={4}
            value={inputMessage}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="메시지를 입력하세요... (@봇 으로 AI에게 질문)"
            disabled={!isConnected}
            variant="outlined"
            size="small"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />
          <IconButton
            color="primary"
            onClick={handleSendMessage}
            disabled={!isConnected || !inputMessage.trim()}
            sx={{
              bgcolor: 'primary.main',
              color: 'white',
              '&:hover': {
                bgcolor: 'primary.dark',
              },
              '&.Mui-disabled': {
                bgcolor: 'grey.300',
              },
            }}
          >
            <SendIcon />
          </IconButton>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Tip: @봇 또는 @bot을 입력하면 AI 챗봇이 응답합니다
        </Typography>
      </Paper>
    </Box>
  );
}
