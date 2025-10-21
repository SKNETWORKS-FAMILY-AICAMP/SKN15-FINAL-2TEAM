import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from .models import ChatRoom, ChatMessage
from .services import get_bot_service

User = get_user_model()


class TripChatConsumer(AsyncWebsocketConsumer):
    """
    실시간 협업 채팅 WebSocket Consumer
    여행 동행자들과 챗봇이 함께 대화할 수 있는 채팅방
    """

    async def connect(self):
        """WebSocket 연결"""
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f'trip_chat_{self.room_id}'
        self.user = self.scope.get('user')

        # 인증되지 않은 사용자 거부
        if not self.user or not self.user.is_authenticated:
            await self.close()
            return

        # 채팅방 접근 권한 확인
        has_access = await self.check_room_access()
        if not has_access:
            await self.close()
            return

        # Redis 채널 그룹에 참여
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

        # Send member list to newly connected user
        members = await self.get_room_members()
        await self.send(text_data=json.dumps({
            'type': 'member_list',
            'members': members
        }))

        # 입장 알림 브로드캐스트
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'user_joined',
                'user_email': self.user.email,
                'user_idx': self.user.user_idx
            }
        )

    async def disconnect(self, close_code):
        """WebSocket 연결 해제"""
        if hasattr(self, 'room_group_name') and hasattr(self, 'user') and self.user.is_authenticated:
            # 퇴장 알림
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'user_left',
                    'user_email': self.user.email,
                    'user_idx': self.user.user_idx
                }
            )

            # Redis 채널 그룹에서 제거
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

    async def receive(self, text_data):
        """클라이언트로부터 메시지 수신"""
        try:
            data = json.loads(text_data)
            message_type = data.get('type', 'chat_message')

            if message_type == 'chat_message':
                await self.handle_chat_message(data)
            elif message_type == 'typing':
                await self.handle_typing(data)
        except Exception as e:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': str(e)
            }))

    async def handle_chat_message(self, data):
        """채팅 메시지 처리"""
        content = data.get('content', '')

        if not content.strip():
            return

        # DB에 메시지 저장
        message = await self.save_message(
            content=content,
            msg_type='text'
        )

        # 모든 참가자에게 브로드캐스트
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message': {
                    'message_idx': message.message_idx,
                    'user_idx': self.user.user_idx,
                    'user_email': self.user.email,
                    'content': message.content,
                    'msg_type': message.msg_type,
                    'created_at': message.created_at.isoformat()
                }
            }
        )

        # 챗봇 트리거 확인 (@봇 멘션 또는 특정 키워드)
        if self.should_trigger_bot(content):
            await self.trigger_chatbot(content)

    async def handle_typing(self, data):
        """타이핑 상태 브로드캐스트"""
        is_typing = data.get('is_typing', False)

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'typing_status',
                'user_idx': self.user.user_idx,
                'user_email': self.user.email,
                'is_typing': is_typing
            }
        )

    async def chat_message(self, event):
        """채팅 메시지를 클라이언트로 전송"""
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': event['message']
        }))

    async def user_joined(self, event):
        """사용자 입장 알림"""
        try:
            await self.send(text_data=json.dumps({
                'type': 'user_joined',
                'user_email': event['user_email'],
                'user_idx': event['user_idx']
            }))
        except Exception:
            # Connection already closed, ignore
            pass

    async def user_left(self, event):
        """사용자 퇴장 알림"""
        try:
            await self.send(text_data=json.dumps({
                'type': 'user_left',
                'user_email': event['user_email'],
                'user_idx': event['user_idx']
            }))
        except Exception:
            # Connection already closed, ignore
            pass

    async def typing_status(self, event):
        """타이핑 상태 전송"""
        # 자신의 타이핑 상태는 전송하지 않음
        if event['user_idx'] != self.user.user_idx:
            await self.send(text_data=json.dumps({
                'type': 'typing_status',
                'user_email': event['user_email'],
                'user_idx': event['user_idx'],
                'is_typing': event['is_typing']
            }))

    async def bot_message(self, event):
        """챗봇 메시지 전송"""
        await self.send(text_data=json.dumps({
            'type': 'bot_message',
            'message': event['message']
        }))

    async def member_added(self, event):
        """새 멤버 추가 알림"""
        try:
            await self.send(text_data=json.dumps({
                'type': 'member_added',
                'member': event['member'],
                'invited_by': event['invited_by']
            }))
        except Exception:
            # Connection already closed, ignore
            pass

    # Helper methods

    @database_sync_to_async
    def check_room_access(self):
        """채팅방 접근 권한 확인"""
        try:
            room = ChatRoom.objects.get(room_idx=self.room_id)
            # TripMember를 통해 권한 확인
            return room.trip_idx.members.filter(user_idx=self.user).exists()
        except ChatRoom.DoesNotExist:
            return False

    @database_sync_to_async
    def save_message(self, content, msg_type='text', payload_json=None):
        """메시지를 DB에 저장"""
        room = ChatRoom.objects.get(room_idx=self.room_id)
        message = ChatMessage.objects.create(
            room_idx=room,
            user_idx=self.user,
            msg_type=msg_type,
            content=content,
            payload_json=payload_json
        )
        return message

    def should_trigger_bot(self, content):
        """챗봇을 트리거해야 하는지 확인"""
        # @봇 또는 @bot 멘션이 있을 때만 응답
        return '@봇' in content or '@bot' in content.lower()

    async def trigger_chatbot(self, user_message):
        """챗봇 응답 생성 (OpenAI API 연동)"""
        try:
            # Get conversation history for context
            conversation_history = await self.get_recent_messages()

            # Get trip context
            trip_context = await self.get_trip_context()

            # Get bot service and generate response
            bot_service = get_bot_service()
            bot_response = await bot_service.get_bot_response(
                user_message=user_message,
                conversation_history=conversation_history,
                trip_context=trip_context
            )

            # 챗봇 메시지 저장
            message = await self.save_bot_message(bot_response)

            # 브로드캐스트
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'bot_message',
                    'message': {
                        'message_idx': message.message_idx,
                        'user_idx': None,
                        'content': message.content,
                        'msg_type': message.msg_type,
                        'created_at': message.created_at.isoformat()
                    }
                }
            )
        except Exception as e:
            # Send error message if bot fails
            error_message = "죄송합니다. 일시적으로 응답할 수 없습니다."
            message = await self.save_bot_message(error_message)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'bot_message',
                    'message': {
                        'message_idx': message.message_idx,
                        'user_idx': None,
                        'content': message.content,
                        'msg_type': message.msg_type,
                        'created_at': message.created_at.isoformat()
                    }
                }
            )

    @database_sync_to_async
    def save_bot_message(self, content, payload_json=None):
        """챗봇 메시지 저장 (user_idx = null)"""
        room = ChatRoom.objects.get(room_idx=self.room_id)
        message = ChatMessage.objects.create(
            room_idx=room,
            user_idx=None,  # 챗봇은 user_idx가 null
            msg_type='text',
            content=content,
            payload_json=payload_json
        )
        return message

    @database_sync_to_async
    def get_room_members(self):
        """채팅방 참여 멤버 목록 가져오기"""
        try:
            room = ChatRoom.objects.select_related('trip_idx').get(room_idx=self.room_id)
            trip = room.trip_idx
            if trip:
                members = trip.members.all()
                return [{
                    'user_idx': member.user_idx.user_idx,
                    'email': member.user_idx.email,
                    'role': member.role,
                    'is_online': False,  # TODO: track online status
                    'is_typing': False
                } for member in members]
            return []
        except Exception as e:
            print(f"Error getting room members: {e}")
            return []

    @database_sync_to_async
    def get_recent_messages(self, limit=10):
        """최근 메시지 가져오기 (대화 컨텍스트용)"""
        room = ChatRoom.objects.get(room_idx=self.room_id)
        messages = room.messages.select_related('user_idx').order_by('-created_at')[:limit]

        result = []
        for msg in reversed(list(messages)):
            result.append({
                'content': msg.content,
                'is_bot': msg.user_idx is None,
                'created_at': msg.created_at.isoformat()
            })
        return result

    @database_sync_to_async
    def get_trip_context(self):
        """여행 계획 정보 가져오기"""
        try:
            room = ChatRoom.objects.select_related('trip_idx').get(room_idx=self.room_id)
            trip = room.trip_idx

            return {
                'destination': trip.title,
                'start_date': trip.start_date.isoformat() if trip.start_date else None,
                'end_date': trip.end_date.isoformat() if trip.end_date else None,
                'travelers': trip.members.count(),
            }
        except Exception:
            return {}
