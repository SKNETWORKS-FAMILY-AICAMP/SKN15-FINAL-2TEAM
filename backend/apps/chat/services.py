"""
Chat services including OpenAI bot integration
"""
import os
import json
from typing import Optional, Dict, Any
from openai import OpenAI
from django.conf import settings


class ChatBotService:
    """
    OpenAI-powered chatbot service for travel planning assistance
    """

    def __init__(self):
        self.client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'))
        self.model = os.environ.get('OPENAI_MODEL', 'gpt-4o-mini')
        self.system_prompt = """당신은 여행 계획을 도와주는 친절한 AI 어시스턴트입니다.

사용자들이 여행 계획을 세울 때 다음과 같은 도움을 제공합니다:
- 여행지 추천 및 정보 제공
- 일정 계획 조언
- 숙박, 교통, 관광지에 대한 정보
- 예산 계획 및 팁
- 날씨, 문화, 주의사항 안내

항상 친절하고 구체적으로 답변하며, 실용적인 조언을 제공하세요.
여러 사용자가 함께 대화하는 채팅방이므로, 모든 참여자를 배려하며 답변하세요."""

    async def get_bot_response(
        self,
        user_message: str,
        conversation_history: Optional[list] = None,
        trip_context: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Get chatbot response using OpenAI API

        Args:
            user_message: User's message
            conversation_history: Recent conversation history
            trip_context: Trip plan context (destination, dates, etc.)

        Returns:
            Bot's response text
        """
        try:
            # Build messages for OpenAI
            messages = [
                {"role": "system", "content": self.system_prompt}
            ]

            # Add trip context if available
            if trip_context:
                context_msg = self._build_trip_context_message(trip_context)
                messages.append({"role": "system", "content": context_msg})

            # Add conversation history
            if conversation_history:
                for msg in conversation_history[-10:]:  # Last 10 messages
                    role = "assistant" if msg.get('is_bot') else "user"
                    content = msg.get('content', '')
                    if content:
                        messages.append({"role": role, "content": content})

            # Add current user message
            messages.append({"role": "user", "content": user_message})

            # Call OpenAI API
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.7,
                max_tokens=500,
            )

            return response.choices[0].message.content

        except Exception as e:
            print(f"OpenAI API error: {e}")
            return "죄송합니다. 일시적으로 응답할 수 없습니다. 잠시 후 다시 시도해주세요."

    def _build_trip_context_message(self, trip_context: Dict[str, Any]) -> str:
        """Build context message from trip plan data"""
        context_parts = ["현재 계획 중인 여행 정보:"]

        if trip_context.get('destination'):
            context_parts.append(f"- 목적지: {trip_context['destination']}")

        if trip_context.get('start_date') and trip_context.get('end_date'):
            context_parts.append(
                f"- 여행 기간: {trip_context['start_date']} ~ {trip_context['end_date']}"
            )

        if trip_context.get('travelers'):
            context_parts.append(f"- 여행 인원: {trip_context['travelers']}")

        if trip_context.get('budget'):
            context_parts.append(f"- 예산: {trip_context['budget']}")

        return "\n".join(context_parts)


# Singleton instance
_bot_service = None

def get_bot_service() -> ChatBotService:
    """Get or create bot service singleton"""
    global _bot_service
    if _bot_service is None:
        _bot_service = ChatBotService()
    return _bot_service
