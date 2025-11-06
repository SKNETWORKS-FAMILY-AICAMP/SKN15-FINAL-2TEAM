import React, { useState, useEffect, useRef } from 'react';
import { useCollaborativeChat, ChatMessage as WsChatMessage, ChatMember } from '../../hooks/useCollaborativeChat';
import { useAuth } from '../../hooks/useAuth';
import { useVoiceRecognitionLocal } from '../../hooks/useVoiceRecognitionLocal';
import chatAPI from '../../services/chatAPI';
import tripAPI from '../../services/tripAPI';
import InviteCodeModal from './InviteCodeModal';

interface Position {
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
}

interface UnifiedChatWidgetProps {
  tripId: number | null;
  tripTitle?: string;
  onMessage?: (message: any) => void;
  onPlannerUpdate?: (data: { updated_by: string; update_type: string; trip_idx: number; message: string }) => void;
  onMapSearch?: (keyword: string, region?: string) => void;
}

const UnifiedChatWidget: React.FC<UnifiedChatWidgetProps> = ({ tripId, tripTitle = '여행 계획', onMessage, onPlannerUpdate, onMapSearch }) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(true);
  const [roomId, setRoomId] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [position, setPosition] = useState<Position>({ bottom: 20, right: 20 });
  const [iconPosition, setIconPosition] = useState<Position | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);
  const [transformOrigin, setTransformOrigin] = useState('bottom right');
  const [isMinimizing, setIsMinimizing] = useState(false);
  const [lastWidgetRect, setLastWidgetRect] = useState<DOMRect | null>(null);
  const [showMemberList, setShowMemberList] = useState(false);
  const [isLoadingRoom, setIsLoadingRoom] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [isBotTyping, setIsBotTyping] = useState(false);

  // 크기 조절
  const [chatSize, setChatSize] = useState({ width: 380, height: 550 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string>('');
  const [cursorStyle, setCursorStyle] = useState('default');
  const resizeRef = useRef({
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    direction: '',
    startLeft: 0,
    startTop: 0
  });

  const widgetRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const currentDragTarget = useRef<'widget' | 'icon' | null>(null);

  // Initialize chat room and load trip info
  useEffect(() => {
    const initRoom = async () => {
      if (!tripId) {
        // Demo mode - no real trip
        setIsLoadingRoom(false);
        setRoomId(null);
        return;
      }

      try {
        setIsLoadingRoom(true);
        const room = await chatAPI.createRoomForTrip(tripId);
        setRoomId(room.room_idx);

        // Load trip info to get invite code
        const trip = await tripAPI.getTrip(tripId);
        setInviteCode(trip.invite_code || null);
      } catch (error) {
        console.error('Failed to initialize chat room:', error);
      } finally {
        setIsLoadingRoom(false);
      }
    };

    initRoom();
  }, [tripId]);

  // Use collaborative chat hook (only when roomId is available)
  const {
    isConnected,
    messages,
    members,
    sendMessage: wsSendMessage,
    sendTyping,
  } = useCollaborativeChat({
    roomId: roomId || 0,
    onMessage: (message) => {
      console.log('New message:', message);

      // 봇 메시지가 오면 타이핑 상태 해제
      if (message.is_bot) {
        setIsBotTyping(false);
      }

      // 상위 컴포넌트로 메시지 전달
      if (onMessage) {
        onMessage(message);
      }
    },
    onPlannerUpdate: (data) => {
      console.log('🔄 Planner update received in UnifiedChatWidget:', data);
      if (onPlannerUpdate) {
        onPlannerUpdate(data);
      }
    },
    onMapSearch: (keyword, region) => {
      console.log('🗺️ Map search received in UnifiedChatWidget:', { keyword, region });
      if (onMapSearch) {
        onMapSearch(keyword, region);
      }
    },
  });

  // Check if this is a group chat (more than 1 member)
  const isGroupChat = members.length > 1;

  // Voice recognition hook (로컬 STT 모델 사용)
  const {
    isSupported: isVoiceSupported,
    isListening,
    isRecording,
    isTranscribing,
    recordingTime,
    startListening,
    stopListening,
    reset: resetVoice,
  } = useVoiceRecognitionLocal({
    onResult: (text) => {
      // 음성인식 결과를 입력창에 추가
      setInputValue(prev => prev + text + ' ');
    },
    onError: (error) => {
      alert(error);
    },
  });

  // Debug: Log when members change
  useEffect(() => {
    console.log('🎯 [UnifiedChatWidget] members changed:', members.length, members);
    console.log('🎯 [UnifiedChatWidget] isGroupChat:', isGroupChat);
  }, [members, isGroupChat]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  // Convert initial position to left-top coordinates on mount
  useEffect(() => {
    if (isOpen && widgetRef.current && position.left === undefined) {
      const rect = widgetRef.current.getBoundingClientRect();
      setPosition({
        left: rect.left,
        top: rect.top,
        right: undefined,
        bottom: undefined
      });
    }
  }, [isOpen]);

  // Drag event handlers
  const startDragWidget = (e: React.MouseEvent) => {
    if (!widgetRef.current) return;
    setIsDragging(true);
    setHasDragged(false);
    currentDragTarget.current = 'widget';
    const rect = widgetRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    e.preventDefault();
  };

  const startDragIcon = (e: React.MouseEvent) => {
    if (!iconRef.current) return;
    setIsDragging(true);
    setHasDragged(false);
    currentDragTarget.current = 'icon';
    const rect = iconRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    e.preventDefault();
  };

  const handleDrag = (clientX: number, clientY: number) => {
    if (!isDragging || !currentDragTarget.current) return;
    setHasDragged(true);
    const target = currentDragTarget.current === 'widget' ? widgetRef.current : iconRef.current;
    if (!target) return;

    const x = clientX - dragOffset.current.x;
    const y = clientY - dragOffset.current.y;
    const padding = 10;
    const maxX = window.innerWidth - target.offsetWidth - padding;
    const maxY = window.innerHeight - target.offsetHeight - padding;
    const constrainedX = Math.max(padding, Math.min(x, maxX));
    const constrainedY = Math.max(padding, Math.min(y, maxY));

    const newPosition = {
      left: constrainedX,
      top: constrainedY,
      right: undefined,
      bottom: undefined
    };

    if (currentDragTarget.current === 'widget') {
      setPosition(newPosition);
      const centerX = constrainedX + target.offsetWidth / 2;
      const centerY = constrainedY + target.offsetHeight / 2;
      const screenCenterX = window.innerWidth / 2;
      const screenCenterY = window.innerHeight / 2;
      const isLeft = centerX < screenCenterX;
      const isTop = centerY < screenCenterY;
      const origin = `${isLeft ? '0' : '100'}% ${isTop ? '0' : '100'}%`;
      setTransformOrigin(origin);
    } else {
      setIconPosition(newPosition);
    }
  };

  const stopDrag = () => {
    if (isDragging) {
      setIsDragging(false);
      currentDragTarget.current = null;
    }
  };

  // Global event listeners for dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => handleDrag(e.clientX, e.clientY);
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', stopDrag);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', stopDrag);
      };
    }
  }, [isDragging]);

  const toggleChat = () => {
    if (hasDragged) {
      setHasDragged(false);
      return;
    }
    if (isOpen) {
      if (widgetRef.current) {
        setLastWidgetRect(widgetRef.current.getBoundingClientRect());
      }
      setIsMinimizing(true);
      setTimeout(() => {
        setIsOpen(false);
        setIsMinimizing(false);
      }, 300);
    } else {
      setIsOpen(true);
    }
  };

  const handleIconClick = () => {
    if (!hasDragged) {
      setIconPosition(null);
      toggleChat();
    }
    setHasDragged(false);
  };

  const sendMessage = () => {
    const message = inputValue.trim();
    if (!message || !roomId) return;

    // Check if message mentions bot or is in 1-on-1 chat (auto-bot response)
    const mentionsBot = message.includes('@봇') || message.includes('@bot');
    const willTriggerBot = mentionsBot || !isGroupChat;
    const msgType = mentionsBot ? 'bot' : 'text';

    // 봇이 응답할 것이면 타이핑 상태 시작
    if (willTriggerBot) {
      setIsBotTyping(true);
    }

    wsSendMessage(message, msgType);
    setInputValue('');
    sendTyping(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    sendTyping(true);
    // Auto-stop typing after 1 second
    setTimeout(() => sendTyping(false), 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  const handleShareTrip = async () => {
    if (!inviteCode) {
      alert('초대 코드가 생성되지 않았습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    // Generate shareable URL
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/planner/${inviteCode}`;

    // Copy to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert(`공유 링크가 복사되었습니다!\n\n${shareUrl}\n\n이 링크를 친구들과 공유하세요.`);
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        alert(`공유 링크가 복사되었습니다!\n\n${shareUrl}\n\n이 링크를 친구들과 공유하세요.`);
      } catch (err) {
        alert(`링크 복사에 실패했습니다. 링크: ${shareUrl}`);
      }
      document.body.removeChild(textArea);
    }
  };

  // 크기 조절 - 테두리 감지
  const getResizeDirection = (e: React.MouseEvent): string => {
    if (!widgetRef.current) return '';

    const rect = widgetRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const edgeSize = 8; // 테두리 감지 영역 크기

    const isLeft = x < edgeSize;
    const isRight = x > rect.width - edgeSize;
    const isTop = y < edgeSize;
    const isBottom = y > rect.height - edgeSize;

    // 코너 우선
    if (isTop && isLeft) return 'nw';
    if (isTop && isRight) return 'ne';
    if (isBottom && isLeft) return 'sw';
    if (isBottom && isRight) return 'se';

    // 변
    if (isTop) return 'n';
    if (isBottom) return 's';
    if (isLeft) return 'w';
    if (isRight) return 'e';

    return '';
  };

  const getCursorForDirection = (direction: string): string => {
    const cursors: { [key: string]: string } = {
      'n': 'ns-resize',
      's': 'ns-resize',
      'e': 'ew-resize',
      'w': 'ew-resize',
      'ne': 'nesw-resize',
      'sw': 'nesw-resize',
      'nw': 'nwse-resize',
      'se': 'nwse-resize'
    };
    return cursors[direction] || 'default';
  };

  const handleWidgetMouseMove = (e: React.MouseEvent) => {
    if (isResizing || isDragging) return;

    const direction = getResizeDirection(e);
    const cursor = getCursorForDirection(direction);
    setCursorStyle(cursor);
  };

  const handleWidgetMouseDown = (e: React.MouseEvent) => {
    const direction = getResizeDirection(e);

    if (direction) {
      // 크기 조절 시작
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      setResizeDirection(direction);

      const rect = widgetRef.current!.getBoundingClientRect();
      resizeRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startWidth: chatSize.width,
        startHeight: chatSize.height,
        direction: direction,
        startLeft: position.left || 0,
        startTop: position.top || 0
      };
    } else if (e.currentTarget === e.target || (e.target as HTMLElement).classList.contains('chat-header')) {
      // 헤더 영역 드래그
      startDragWidget(e);
    }
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeRef.current.startX;
      const deltaY = e.clientY - resizeRef.current.startY;
      const direction = resizeRef.current.direction;

      let newWidth = resizeRef.current.startWidth;
      let newHeight = resizeRef.current.startHeight;
      let newLeft = resizeRef.current.startLeft;
      let newTop = resizeRef.current.startTop;

      // 방향에 따라 크기 계산
      if (direction.includes('e')) {
        newWidth = resizeRef.current.startWidth + deltaX;
      }
      if (direction.includes('w')) {
        newWidth = resizeRef.current.startWidth - deltaX;
        newLeft = resizeRef.current.startLeft + deltaX;
      }
      if (direction.includes('s')) {
        newHeight = resizeRef.current.startHeight + deltaY;
      }
      if (direction.includes('n')) {
        newHeight = resizeRef.current.startHeight - deltaY;
        newTop = resizeRef.current.startTop + deltaY;
      }

      // 최소/최대 크기 제한
      const constrainedWidth = Math.max(300, Math.min(800, newWidth));
      const constrainedHeight = Math.max(400, Math.min(800, newHeight));

      // 크기가 제한에 걸린 경우 위치 조정 안함
      if (direction.includes('w') && constrainedWidth !== newWidth) {
        newLeft = resizeRef.current.startLeft + (resizeRef.current.startWidth - constrainedWidth);
      }
      if (direction.includes('n') && constrainedHeight !== newHeight) {
        newTop = resizeRef.current.startTop + (resizeRef.current.startHeight - constrainedHeight);
      }

      setChatSize({ width: constrainedWidth, height: constrainedHeight });

      // 왼쪽이나 위쪽으로 리사이즈할 때 위치도 업데이트
      if (direction.includes('w') || direction.includes('n')) {
        setPosition({
          left: newLeft,
          top: newTop,
          right: undefined,
          bottom: undefined
        });
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setResizeDirection('');
      setCursorStyle('default');
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const getPositionStyle = (): React.CSSProperties => {
    const style: React.CSSProperties = {
      transformOrigin,
      transition: isDragging ? 'none' : 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)'
    };

    if (position.left !== undefined) {
      style.left = `${position.left}px`;
      style.top = `${position.top}px`;
      style.right = 'auto';
      style.bottom = 'auto';
    } else {
      style.bottom = `${position.bottom}px`;
      style.right = `${position.right}px`;
    }
    return style;
  };

  const getIconPositionStyle = (): React.CSSProperties => {
    if (iconPosition && iconPosition.left !== undefined) {
      return {
        left: `${iconPosition.left}px`,
        top: `${iconPosition.top}px`,
        transition: isDragging && currentDragTarget.current === 'icon' ? 'none' : 'all 0.3s ease'
      };
    }

    if (!isOpen && lastWidgetRect) {
      const widget = lastWidgetRect;
      const centerX = widget.left + widget.width / 2;
      const centerY = widget.top + widget.height / 2;
      const screenCenterX = window.innerWidth / 2;
      const screenCenterY = window.innerHeight / 2;
      const isLeft = centerX < screenCenterX;
      const isTop = centerY < screenCenterY;

      let iconLeft: number, iconTop: number;
      if (isLeft && isTop) {
        iconLeft = widget.left;
        iconTop = widget.top;
      } else if (!isLeft && isTop) {
        iconLeft = widget.right - 60;
        iconTop = widget.top;
      } else if (isLeft && !isTop) {
        iconLeft = widget.left;
        iconTop = widget.bottom - 60;
      } else {
        iconLeft = widget.right - 60;
        iconTop = widget.bottom - 60;
      }

      const maxIconLeft = window.innerWidth - 60;
      const maxIconTop = window.innerHeight - 60;
      iconLeft = Math.max(10, Math.min(iconLeft, maxIconLeft));
      iconTop = Math.max(10, Math.min(iconTop, maxIconTop));

      return {
        left: `${iconLeft}px`,
        top: `${iconTop}px`,
        transition: isDragging && currentDragTarget.current === 'icon' ? 'none' : 'all 0.3s ease'
      };
    }

    if (position.left !== undefined) {
      return {
        left: `${position.left}px`,
        top: `${position.top}px`,
        transition: isDragging && currentDragTarget.current === 'icon' ? 'none' : 'all 0.3s ease'
      };
    }

    return {
      bottom: `${position.bottom}px`,
      right: `${position.right}px`,
      transition: isDragging && currentDragTarget.current === 'icon' ? 'none' : 'all 0.3s ease'
    };
  };

  // Don't render chat in demo mode (no tripId)
  if (!tripId) {
    return null;
  }

  if (isLoadingRoom) {
    return (
      <div className="chat-icon-floating" style={{ bottom: '20px', right: '20px' }}>
        ⏳
      </div>
    );
  }

  return (
    <>
      {/* Chat Widget */}
      <div
        ref={widgetRef}
        className={`chat-widget ${isOpen ? 'open' : 'hidden'} ${isMinimizing ? 'minimizing' : ''}`}
        style={{
          ...getPositionStyle(),
          width: `${chatSize.width}px`,
          height: `${chatSize.height}px`,
          cursor: cursorStyle,
        }}
        onMouseMove={handleWidgetMouseMove}
        onMouseDown={handleWidgetMouseDown}
      >
        <div
          className="chat-header"
        >
          <div className="chat-header-content">
            <div className="bot-avatar">{isGroupChat ? '👥' : '🤖'}</div>
            <div className="chat-title">
              <div className="chat-name">
                {isGroupChat ? `${tripTitle} 그룹채팅` : 'AI 여행 도우미'}
              </div>
              <div className="chat-status">
                {isConnected ? (
                  <>
                    <span className="status-dot online"></span>
                    온라인 {isGroupChat && `· ${members.length}명`}
                  </>
                ) : (
                  <>
                    <span className="status-dot offline"></span>
                    연결 중...
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="chat-header-actions">
            <button
              className="chat-members-button"
              onClick={() => setShowMemberList(!showMemberList)}
              title="참여자 목록 및 초대"
            >
              👥 {members.length}
            </button>
            <button
              className="chat-share-button"
              onClick={handleShareTrip}
              title="여행 공유 링크 복사"
            >
              🔗
            </button>
            <button className="chat-minimize" onClick={toggleChat}>
              −
            </button>
          </div>
        </div>

        {/* Members List */}
        {showMemberList && (
          <div className="chat-members-list">
            <div className="members-header">
              <span>참여자 ({members.length})</span>
              <button
                className="invite-button"
                onClick={handleShareTrip}
              >
                + 초대
              </button>
            </div>
            <div className="members-body">
              {members.map((member) => (
                <div key={member.user_idx} className="member-item">
                  <div className="member-avatar">{member.email[0].toUpperCase()}</div>
                  <div className="member-info">
                    <div className="member-email">{member.email}</div>
                    <div className="member-role">{member.role}</div>
                  </div>
                  {member.is_online && <span className="status-dot online"></span>}
                </div>
              ))}
              <div className="member-item bot-member">
                <div className="member-avatar">🤖</div>
                <div className="member-info">
                  <div className="member-email">AI 봇</div>
                  <div className="member-role">도우미</div>
                </div>
                <span className="status-dot online"></span>
              </div>
            </div>
          </div>
        )}

        <div className="chat-messages" ref={messagesRef}>
          {messages.length === 0 && (
            <div className="welcome-message">
              <div className="message bot-message">
                <div className="message-content">
                  {isGroupChat
                    ? `👋 ${tripTitle} 그룹 채팅방에 오신 것을 환영합니다!\n\n동행자들과 함께 여행 계획을 상의하세요. @봇을 입력하면 AI가 도와드립니다!`
                    : '안녕하세요! 👋 AI 여행 도우미입니다.\n\n여행 계획을 도와드릴게요. 궁금한 것이 있으시면 언제든 물어보세요!\n\n동행자를 초대하면 그룹 채팅방으로 전환됩니다.'
                  }
                </div>
                <div className="message-time">방금</div>
              </div>
            </div>
          )}

          {messages.map((message, index) => {
            // 추천 장소 메시지는 UI 패널로만 표시하고 채팅창에서는 숨김
            if (message.is_bot && message.content) {
              // 마크다운 리스트 패턴 확인
              const hasRecommendationPattern = /\d+\.\s*\*\*[^*]+\*\*/.test(message.content);
              // JSON 배열 패턴 확인
              const hasJsonPattern = /\[\s*\{[\s\S]*"name"[\s\S]*\}\s*\]/.test(message.content);

              if (hasRecommendationPattern || hasJsonPattern) {
                console.log('🚫 추천 메시지 필터링: 채팅창에 표시하지 않음');
                return null;
              }
            }

            // Determine if this is my message
            const isMyMessage = !message.is_bot && message.user && user && message.user.user_idx === user.user_idx;
            const messageClass = message.is_bot ? 'bot-message' : (isMyMessage ? 'my-message' : 'user-message');

            return (
              <div key={message.message_idx || index} className={`message ${messageClass}`}>
                {isGroupChat && !message.is_bot && !isMyMessage && (
                  <div className="message-sender">
                    {message.user?.email || '알 수 없음'}
                  </div>
                )}
                <div className="message-content">
                  {message.is_bot && <span className="bot-badge">🤖 AI</span>}
                  {message.content}
                </div>
                <div className="message-time">{formatTime(message.created_at)}</div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {members.filter(m => m.is_typing).length > 0 && (
            <div className="typing-indicator">
              {members.filter(m => m.is_typing).map(m => m.email).join(', ')}님이 입력 중
              <span className="typing-dots">
                <span>.</span><span>.</span><span>.</span>
              </span>
            </div>
          )}

          {/* Bot typing indicator */}
          {isBotTyping && (
            <div className="message bot-message">
              <div className="message-content bot-typing">
                <span className="bot-badge">🤖 AI</span>
                <span className="typing-dots">
                  <span>.</span><span>.</span><span>.</span>
                </span>
              </div>
            </div>
          )}
        </div>


        <div className="chat-input-area">
          <input
            type="text"
            className="chat-input-field"
            placeholder={
              isRecording ? `녹음 중... (${recordingTime}초)` :
              isTranscribing ? "음성 인식 중..." :
              isGroupChat ? "메시지를 입력하세요... (@봇 으로 AI 호출)" : "메시지를 입력하세요..."
            }
            value={inputValue}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            disabled={!isConnected || isListening}
          />

          {/* Voice input button */}
          {isVoiceSupported && (
            <button
              className={`chat-voice-button ${isListening ? 'listening' : ''}`}
              onClick={isListening ? stopListening : startListening}
              disabled={!isConnected}
              title={isListening ? '음성인식 중지' : '음성인식 시작'}
            >
              {isListening ? (
                // 녹음 중 아이콘 (빨간 원)
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="8" fill="#ef4444" />
                  <circle cx="12" cy="12" r="4" fill="white" className="pulse" />
                </svg>
              ) : (
                // 마이크 아이콘
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 1C10.34 1 9 2.34 9 4V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V4C15 2.34 13.66 1 12 1ZM12 13C11.45 13 11 12.55 11 12V4C11 3.45 11.45 3 12 3C12.55 3 13 3.45 13 4V12C13 12.55 12.55 13 12 13ZM17 11C17 14 14.76 16.43 12 16.93V20H14C14.55 20 15 20.45 15 21C15 21.55 14.55 22 14 22H10C9.45 22 9 21.55 9 21C9 20.45 9.45 20 10 20H12V16.93C9.24 16.43 7 14 7 11H5C5 14.53 7.61 17.43 11 17.93V20H10C9.45 20 9 20.45 9 21C9 21.55 9.45 22 10 22H14C14.55 22 15 21.55 15 21C15 20.45 14.55 20 14 20H13V17.93C16.39 17.43 19 14.53 19 11H17Z"
                    fill="currentColor"
                  />
                </svg>
              )}
            </button>
          )}

          <button
            className="chat-send-button"
            onClick={sendMessage}
            disabled={!isConnected || !inputValue.trim()}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M2 21L23 12L2 3V10L17 12L2 14V21Z" fill="currentColor" />
            </svg>
          </button>
        </div>
      </div>

      {/* Floating Chat Icon (when minimized) */}
      <div
        ref={iconRef}
        className={`chat-icon-floating ${isOpen ? 'hidden' : ''}`}
        style={getIconPositionStyle()}
        onMouseDown={startDragIcon}
        onClick={handleIconClick}
      >
        {isGroupChat ? '👥' : '💬'}
        {!isConnected && <span className="connecting-badge">⏳</span>}
      </div>

      {/* Invite Code Modal */}
      <InviteCodeModal
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        tripId={tripId || 0}
        tripTitle={tripTitle}
      />
    </>
  );
};

export default UnifiedChatWidget;
