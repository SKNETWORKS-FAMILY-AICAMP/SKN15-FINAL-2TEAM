import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '../../types/planner';

interface Position {
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
}

const ChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [position, setPosition] = useState<Position>({ bottom: 20, right: 20 });
  const [iconPosition, setIconPosition] = useState<Position | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);
  const [transformOrigin, setTransformOrigin] = useState('bottom right');
  const [isMinimizing, setIsMinimizing] = useState(false);
  const [lastWidgetRect, setLastWidgetRect] = useState<DOMRect | null>(null);

  const widgetRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const currentDragTarget = useRef<'widget' | 'icon' | null>(null);

  // Add welcome messages on mount
  useEffect(() => {
    const now = new Date();
    const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    setMessages([
      {
        text: '안녕하세요! 👋 여행 계획을 도와드릴게요. 궁금한 것이 있으시면 언제든 물어보세요!',
        type: 'bot',
        time: timeString
      },
      {
        text: '현재 선택하신 여행 정보를 바탕으로 맞춤 추천을 해드릴 수 있어요. 어떤 도움이 필요하신가요? 🌟',
        type: 'bot',
        time: timeString
      }
    ]);
  }, []);

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

  const startDragWidgetTouch = (e: React.TouchEvent) => {
    if (!widgetRef.current) return;

    setIsDragging(true);
    setHasDragged(false);
    currentDragTarget.current = 'widget';

    const rect = widgetRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    dragOffset.current = {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
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

  const startDragIconTouch = (e: React.TouchEvent) => {
    if (!iconRef.current) return;

    setIsDragging(true);
    setHasDragged(false);
    currentDragTarget.current = 'icon';

    const rect = iconRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    dragOffset.current = {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
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

    // Keep within viewport bounds
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

    // Update widget position or icon position separately
    if (currentDragTarget.current === 'widget') {
      setPosition(newPosition);

      // Update transform origin for widget
      const centerX = constrainedX + target.offsetWidth / 2;
      const centerY = constrainedY + target.offsetHeight / 2;
      const screenCenterX = window.innerWidth / 2;
      const screenCenterY = window.innerHeight / 2;

      const isLeft = centerX < screenCenterX;
      const isTop = centerY < screenCenterY;

      const origin = `${isLeft ? '0' : '100'}% ${isTop ? '0' : '100'}%`;
      setTransformOrigin(origin);
    } else {
      // Only update icon position when dragging icon
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
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleDrag(e.touches[0].clientX, e.touches[0].clientY);
        e.preventDefault();
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', stopDrag);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', stopDrag);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', stopDrag);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', stopDrag);
      };
    }
  }, [isDragging]);

  const toggleChat = () => {
    if (hasDragged) {
      setHasDragged(false);
      return;
    }

    if (isOpen) {
      // Save widget position before minimizing
      if (widgetRef.current) {
        setLastWidgetRect(widgetRef.current.getBoundingClientRect());
      }
      // Minimize animation
      setIsMinimizing(true);
      setTimeout(() => {
        setIsOpen(false);
        setIsMinimizing(false);
      }, 300);
    } else {
      // Open animation - position should already be preserved
      setIsOpen(true);
    }
  };

  const handleIconClick = () => {
    if (!hasDragged) {
      // Reset icon position when opening widget
      setIconPosition(null);
      toggleChat();
    }
    setHasDragged(false);
  };

  const addMessage = (text: string, type: 'bot' | 'user') => {
    const now = new Date();
    const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    setMessages(prev => [...prev, { text, type, time: timeString }]);
  };

  const sendMessage = () => {
    const message = inputValue.trim();
    if (!message) return;

    addMessage(message, 'user');
    setInputValue('');

    // Mock AI response based on keywords
    setTimeout(() => {
      let response = '';

      if (message.includes('관광지')) {
        response = '추천 관광지를 알려드릴게요! 현재 선택하신 목적지의 인기 명소들을 정리해드리겠습니다. 🗺️';
      } else if (message.includes('맛집')) {
        response = '현지 맛집 정보를 찾아보겠습니다! 미슐랭 가이드와 현지인 추천 맛집을 알려드릴게요. 🍽️';
      } else if (message.includes('교통편')) {
        response = '교통편 정보를 안내해드릴게요! 가장 효율적인 이동 방법을 찾아드리겠습니다. 🚗';
      } else {
        const responses = [
          '좋은 질문이에요! 선택하신 여행지에 대한 정보를 찾아보겠습니다. 🔍',
          '그 지역은 정말 아름다운 곳이에요! 추천 명소를 알려드릴게요. ✨',
          '예산에 맞는 최적의 옵션들을 찾아보겠습니다. 💰',
          '현재 입력하신 정보를 바탕으로 맞춤 추천을 해드릴게요! 🎯'
        ];
        response = responses[Math.floor(Math.random() * responses.length)];
      }

      addMessage(response, 'bot');
    }, 1000);
  };

  const handleSuggestionClick = (suggestion: string) => {
    addMessage(suggestion, 'user');

    setTimeout(() => {
      let response = '';

      if (suggestion.includes('관광지')) {
        response = '추천 관광지를 알려드릴게요! 현재 선택하신 목적지의 인기 명소들을 정리해드리겠습니다. 🗺️';
      } else if (suggestion.includes('맛집')) {
        response = '현지 맛집 정보를 찾아보겠습니다! 미슐랭 가이드와 현지인 추천 맛집을 알려드릴게요. 🍽️';
      } else if (suggestion.includes('교통편')) {
        response = '교통편 정보를 안내해드릴게요! 가장 효율적인 이동 방법을 찾아드리겠습니다. 🚗';
      }

      addMessage(response, 'bot');
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
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
    // If icon was dragged manually, use that position
    if (iconPosition && iconPosition.left !== undefined) {
      return {
        left: `${iconPosition.left}px`,
        top: `${iconPosition.top}px`,
        transition: isDragging && currentDragTarget.current === 'icon' ? 'none' : 'all 0.3s ease'
      };
    }

    // Otherwise calculate position based on widget location
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

      // Keep within bounds
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

  return (
    <>
      {/* Chat Widget */}
      <div
        ref={widgetRef}
        className={`chat-widget ${isOpen ? 'open' : 'hidden'} ${isMinimizing ? 'minimizing' : ''}`}
        style={getPositionStyle()}
      >
        <div
          className="chat-header"
          onMouseDown={startDragWidget}
          onTouchStart={startDragWidgetTouch}
        >
          <div className="chat-header-content">
            <div className="bot-avatar">🤖</div>
            <div className="chat-title">
              <div className="chat-name">여행 도우미</div>
              <div className="chat-status">온라인</div>
            </div>
          </div>
          <button className="chat-minimize" onClick={toggleChat}>
            −
          </button>
        </div>

        <div className="chat-messages" ref={messagesRef}>
          {messages.map((message, index) => (
            <div key={index} className={`message ${message.type}-message`}>
              <div className="message-content">{message.text}</div>
              <div className="message-time">{message.time}</div>
            </div>
          ))}
        </div>

        <div className="chat-suggestions">
          <div
            className="suggestion-chip"
            onClick={() => handleSuggestionClick('🗺️ 관광지 추천')}
          >
            🗺️ 관광지 추천
          </div>
          <div
            className="suggestion-chip"
            onClick={() => handleSuggestionClick('🍽️ 맛집 추천')}
          >
            🍽️ 맛집 추천
          </div>
          <div
            className="suggestion-chip"
            onClick={() => handleSuggestionClick('🚗 교통편 안내')}
          >
            🚗 교통편 안내
          </div>
        </div>

        <div className="chat-input-area">
          <input
            type="text"
            className="chat-input-field"
            placeholder="메시지를 입력하세요..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <button className="chat-send-button" onClick={sendMessage}>
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
        onTouchStart={startDragIconTouch}
        onClick={handleIconClick}
      >
        💬
      </div>
    </>
  );
};

export default ChatWidget;
