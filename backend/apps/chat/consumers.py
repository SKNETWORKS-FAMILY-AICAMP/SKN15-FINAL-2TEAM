import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from .models import ChatRoom, ChatMessage
from .services import get_bot_service
from .agent import get_agent
import logging

User = get_user_model()
logger = logging.getLogger(__name__)


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

        # Get current user's member info
        current_member = await self.get_current_member_info()

        # 입장 알림 브로드캐스트 (to all users in the room)
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'user_joined',
                'user_email': self.user.email,
                'user_idx': self.user.user_idx,
                'member': current_member  # Include full member info
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

        # 챗봇 트리거 확인 (1대1 채팅에서는 항상, 단체 채팅에서는 @봇 멘션 시)
        if await self.should_trigger_bot(content):
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
                'type': 'member_joined',  # Changed to match frontend expectation
                'user_email': event['user_email'],
                'user_idx': event['user_idx'],
                'member': event.get('member', {
                    'user_idx': event['user_idx'],
                    'email': event['user_email'],
                    'role': 'member',
                    'is_online': True,
                    'is_typing': False
                })
            }))
        except Exception:
            # Connection already closed, ignore
            pass

    async def user_left(self, event):
        """사용자 퇴장 알림"""
        try:
            await self.send(text_data=json.dumps({
                'type': 'member_left',  # Changed to match frontend expectation
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

    async def planner_updated(self, event):
        """플래너 데이터 업데이트 알림 (실시간 동기화)"""
        try:
            await self.send(text_data=json.dumps({
                'type': 'planner_updated',
                'updated_by': event.get('updated_by'),
                'update_type': event.get('update_type', 'trip'),  # 'trip', 'day', 'item'
                'trip_idx': event.get('trip_idx'),
                'message': event.get('message', '플래너가 업데이트되었습니다.')
            }))
        except Exception:
            # Connection already closed, ignore
            pass

    async def map_search(self, event):
        """지도 검색 명령 (AI가 지도에서 장소 검색하도록 지시)"""
        try:
            await self.send(text_data=json.dumps({
                'type': 'map_search',
                'keyword': event.get('keyword'),
                'region': event.get('region'),
                'message': event.get('message', '지도에서 검색 중...')
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

    @database_sync_to_async
    def get_room_member_count(self):
        """채팅방의 멤버 수 가져오기"""
        try:
            room = ChatRoom.objects.select_related('trip_idx').get(room_idx=self.room_id)
            trip = room.trip_idx
            if trip:
                return trip.members.count()
            return 0
        except Exception as e:
            logger.error(f"❌ Error getting member count: {e}")
            return 0

    async def should_trigger_bot(self, content):
        """챗봇을 트리거해야 하는지 확인"""
        # 멤버 수 확인
        member_count = await self.get_room_member_count()

        # 1대1 채팅 (멤버가 1명): 항상 봇 응답
        if member_count <= 1:
            return True

        # 단체 채팅: @봇 또는 @bot 멘션이 있을 때만 응답
        return '@봇' in content or '@bot' in content.lower()

    async def trigger_chatbot(self, user_message):
        """챗봇 응답 생성 (LangChain Agent 연동)"""
        try:
            # Get trip_id from room
            trip_id = await self.get_trip_id_from_room()

            if not trip_id:
                error_message = "여행 정보를 찾을 수 없습니다."
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
                return

            logger.info(f"🤖 Triggering agent for room={self.room_id}, trip={trip_id}")

            # Run agent in thread pool (agent is sync, not async)
            import asyncio
            bot_response = await asyncio.to_thread(
                self.run_agent_sync,
                int(self.room_id),
                trip_id,
                user_message
            )

            logger.info(f"✅ Agent response received: {bot_response[:100]}...")

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

            # Check if agent modified planner - send update notification
            # (Agent returns success messages or uses keywords like "성공적으로", "추가했습니다" etc)
            success_indicators = ['✅', '성공적으로', '완료', '추가했습니다', '삭제했습니다', '변경했습니다', '수정했습니다', '이동했습니다', '생성되었습니다', '설정했습니다']
            action_keywords = ['추가', '수정', '삭제', '변경', '이동', '생성', '설정']

            if any(indicator in bot_response for indicator in success_indicators) and any(keyword in bot_response for keyword in action_keywords):
                logger.info("📡 Agent modified planner - sending update notification")

                # 날짜 변경 감지
                update_type = 'item'
                if ('날짜' in bot_response or 'Day' in bot_response) and any(word in bot_response for word in ['변경', '설정', '생성']):
                    update_type = 'dates_changed'
                    logger.info("📅 Date change detected - frontend will reload trip data")

                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'planner_updated',
                        'updated_by': 'Agent',
                        'update_type': update_type,
                        'trip_idx': trip_id,
                        'message': bot_response
                    }
                )

        except Exception as e:
            logger.error(f"❌ Agent error: {e}", exc_info=True)
            # Send error message if bot fails
            error_message = f"죄송합니다. 오류가 발생했습니다: {str(e)}"
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

    def run_agent_sync(self, room_id: int, trip_id: int, user_message: str) -> str:
        """Run agent synchronously in thread pool"""
        agent = get_agent(room_id, trip_id)
        return agent.run(user_message)

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
    def get_current_member_info(self):
        """현재 사용자의 멤버 정보 가져오기"""
        try:
            room = ChatRoom.objects.select_related('trip_idx').get(room_idx=self.room_id)
            trip = room.trip_idx
            if trip:
                member = trip.members.filter(user_idx=self.user).first()
                if member:
                    return {
                        'user_idx': member.user_idx.user_idx,
                        'email': member.user_idx.email,
                        'role': member.role,
                        'is_online': True,
                        'is_typing': False
                    }
            return {
                'user_idx': self.user.user_idx,
                'email': self.user.email,
                'role': 'member',
                'is_online': True,
                'is_typing': False
            }
        except Exception as e:
            logger.error(f"Error getting current member info: {e}")
            return {
                'user_idx': self.user.user_idx,
                'email': self.user.email,
                'role': 'member',
                'is_online': True,
                'is_typing': False
            }

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

    @database_sync_to_async
    def get_trip_id_from_room(self):
        """채팅방에서 trip_id 가져오기"""
        try:
            room = ChatRoom.objects.select_related('trip_idx').get(room_idx=self.room_id)
            if room.trip_idx:
                return room.trip_idx.trip_idx
            return None
        except Exception as e:
            logger.error(f"❌ Error getting trip_id: {e}")
            return None
