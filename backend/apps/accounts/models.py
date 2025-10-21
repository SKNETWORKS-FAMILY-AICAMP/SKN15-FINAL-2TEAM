from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    """Custom manager for User model."""

    def create_user(self, email, password=None, **extra_fields):
        """
        Create and save a regular user with the given email and password.
        """
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        """
        Create and save a superuser with the given email and password.
        """
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('status', 'active')

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom User model that uses email as the username field.
    Maps to the user_users table in the database.
    """

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('active', 'Active'),
        ('suspended', 'Suspended'),
        ('deleted', 'Deleted'),
    ]

    user_idx = models.AutoField(primary_key=True, db_column='user_idx')
    email = models.EmailField(unique=True, max_length=255, db_column='email')
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        db_column='status'
    )
    # Note: AbstractBaseUser provides 'password' field automatically
    # Database column is 'password_hash' but we'll handle this via migration
    tz = models.CharField(
        max_length=50,
        default='UTC',
        db_column='tz',
        help_text='User timezone'
    )
    created_at = models.DateTimeField(default=timezone.now, db_column='created_at')
    updated_at = models.DateTimeField(auto_now=True, db_column='updated_at')

    # Additional fields required for Django admin
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    class Meta:
        db_table = 'user_users'
        verbose_name = 'User'
        verbose_name_plural = 'Users'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['email'], name='idx_user_email'),
            models.Index(fields=['status'], name='idx_user_status'),
            models.Index(fields=['created_at'], name='idx_user_created_at'),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(status__in=['pending', 'active', 'suspended', 'deleted']),
                name='user_users_status_check'
            ),
        ]

    def __str__(self):
        return self.email

    def save(self, *args, **kwargs):
        """Override save to handle password hashing."""
        # Password is already stored in the 'password' field
        # which maps to 'password_hash' column in the database
        super().save(*args, **kwargs)


class UserIdentity(models.Model):
    """
    Model to store OAuth/external provider identities linked to users.
    Maps to the user_identities table in the database.
    """

    identity_idx = models.AutoField(primary_key=True, db_column='identity_idx')
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='identities',
        db_column='user_idx'
    )
    provider = models.CharField(
        max_length=50,
        db_column='provider',
        help_text='OAuth provider name (e.g., google, github, facebook)'
    )
    provider_uid = models.CharField(
        max_length=255,
        db_column='provider_uid',
        help_text='Unique identifier from the provider'
    )

    class Meta:
        db_table = 'user_identities'
        verbose_name = 'User Identity'
        verbose_name_plural = 'User Identities'
        unique_together = [('provider', 'provider_uid')]
        indexes = [
            models.Index(fields=['user'], name='idx_identity_user'),
            models.Index(fields=['provider', 'provider_uid'], name='idx_identity_provider_uid'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['provider', 'provider_uid'],
                name='user_identities_provider_uid_key'
            ),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.provider}"
