"""
WebSocket JWT Authentication Middleware
"""
from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import TokenError
from urllib.parse import parse_qs

User = get_user_model()


@database_sync_to_async
def get_user_from_token(token_string):
    """Get user from JWT token"""
    import logging
    logger = logging.getLogger(__name__)
    try:
        # Decode token
        access_token = AccessToken(token_string)
        user_id = access_token['user_id']

        # Get user
        user = User.objects.get(user_idx=user_id)
        logger.info(f"✅ Token decoded successfully: user_id={user_id}, email={user.email}")
        return user
    except TokenError as e:
        logger.error(f"❌ JWT Token error: {e}")
        return AnonymousUser()
    except User.DoesNotExist as e:
        logger.error(f"❌ User not found: {e}")
        return AnonymousUser()
    except KeyError as e:
        logger.error(f"❌ KeyError in token: {e}")
        return AnonymousUser()
    except Exception as e:
        logger.error(f"❌ Unexpected error decoding token: {e}")
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    """
    Custom middleware to authenticate WebSocket connections using JWT tokens.
    Token can be passed via query parameter: ?token=<jwt_token>
    """

    async def __call__(self, scope, receive, send):
        # Get token from query string
        query_string = scope.get('query_string', b'').decode()
        query_params = parse_qs(query_string)
        token = query_params.get('token', [None])[0]

        # Authenticate user
        if token:
            user = await get_user_from_token(token)
            scope['user'] = user
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"🔐 WebSocket auth: token={'present' if token else 'missing'}, user={user.email if hasattr(user, 'email') else 'anonymous'}, is_authenticated={user.is_authenticated if hasattr(user, 'is_authenticated') else False}")
        else:
            scope['user'] = AnonymousUser()
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"⚠️ WebSocket: No token provided in query string")

        return await super().__call__(scope, receive, send)
