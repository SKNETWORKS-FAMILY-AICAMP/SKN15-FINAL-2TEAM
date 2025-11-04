"""
Serializers for User authentication
"""
from rest_framework import serializers
from .models import User


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model"""

    class Meta:
        model = User
        fields = ['user_idx', 'email', 'status', 'tz', 'is_staff', 'is_superuser', 'created_at']
        read_only_fields = ['user_idx', 'is_staff', 'is_superuser', 'created_at']


class RegisterSerializer(serializers.ModelSerializer):
    """Serializer for user registration"""
    password = serializers.CharField(write_only=True, min_length=6)
    password_confirm = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = ['email', 'password', 'password_confirm']
    
    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({
                'password': 'Passwords do not match'
            })
        return data
    
    def create(self, validated_data):
        # Remove password_confirm from validated_data
        validated_data.pop('password_confirm')
        
        # Create user with active status
        user = User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            status='active'
        )
        return user
