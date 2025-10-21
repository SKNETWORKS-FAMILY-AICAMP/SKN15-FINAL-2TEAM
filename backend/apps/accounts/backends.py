"""
Custom authentication backend for User model
"""
from django.contrib.auth.backends import ModelBackend
from .models import User


class EmailBackend(ModelBackend):
    """
    Custom authentication backend that uses email instead of username
    """

    def authenticate(self, request, username=None, password=None, **kwargs):
        try:
            # username field contains email
            user = User.objects.get(email=username)
        except User.DoesNotExist:
            return None

        if user.check_password(password):
            return user

        return None

    def get_user(self, user_id):
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None
