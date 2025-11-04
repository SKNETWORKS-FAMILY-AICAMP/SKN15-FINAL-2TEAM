from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """User admin configuration"""
    list_display = ('user_idx', 'email', 'status', 'is_staff', 'is_superuser', 'created_at')
    list_filter = ('status', 'is_staff', 'is_superuser', 'is_active')
    search_fields = ('email',)
    ordering = ('-created_at',)

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal Info', {'fields': ('tz',)}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Status', {'fields': ('status',)}),
        ('Important dates', {'fields': ('created_at', 'updated_at')}),
    )

    readonly_fields = ('created_at', 'updated_at')

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'password1', 'password2', 'status', 'is_staff', 'is_superuser'),
        }),
    )
