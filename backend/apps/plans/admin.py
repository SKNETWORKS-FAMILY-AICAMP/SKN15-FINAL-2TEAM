from django.contrib import admin
from .models import TripPlan, TripDay, TripItem, TripMember


@admin.register(TripPlan)
class TripPlanAdmin(admin.ModelAdmin):
    """TripPlan admin configuration"""
    list_display = ('trip_idx', 'title', 'owner_user_idx', 'start_date', 'end_date',
                    'party_size', 'status', 'user_satisfaction', 'created_at')
    list_filter = ('status', 'user_satisfaction', 'created_at')
    search_fields = ('title', 'owner_user_idx__email', 'invite_code')
    date_hierarchy = 'created_at'
    ordering = ('-created_at',)

    fieldsets = (
        ('Basic Info', {
            'fields': ('title', 'owner_user_idx', 'status')
        }),
        ('Trip Details', {
            'fields': ('start_date', 'end_date', 'party_size', 'budget_currency', 'budget_amount')
        }),
        ('Location', {
            'fields': ('country_idx', 'region1_idx', 'region2_idx')
        }),
        ('Invite Code', {
            'fields': ('invite_code', 'invite_code_expires_at'),
            'classes': ('collapse',)
        }),
        ('User Feedback', {
            'fields': ('user_satisfaction',)
        }),
        ('Dates', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    readonly_fields = ('created_at', 'updated_at')


@admin.register(TripDay)
class TripDayAdmin(admin.ModelAdmin):
    """TripDay admin configuration"""
    list_display = ('day_idx', 'trip_idx', 'day_no', 'date')
    list_filter = ('date',)
    search_fields = ('trip_idx__title',)
    ordering = ('trip_idx', 'day_no')


@admin.register(TripItem)
class TripItemAdmin(admin.ModelAdmin):
    """TripItem admin configuration"""
    list_display = ('item_idx', 'day_idx', 'title', 'item_type', 'start_time',
                    'order_in_day', 'lock_flag')
    list_filter = ('item_type', 'lock_flag')
    search_fields = ('title', 'notes')
    ordering = ('day_idx', 'order_in_day')

    fieldsets = (
        ('Basic Info', {
            'fields': ('day_idx', 'item_type', 'title', 'place_idx')
        }),
        ('Time', {
            'fields': ('start_time', 'end_time')
        }),
        ('Details', {
            'fields': ('notes', 'estimated_cost', 'order_in_day', 'lock_flag')
        }),
    )


@admin.register(TripMember)
class TripMemberAdmin(admin.ModelAdmin):
    """TripMember admin configuration"""
    list_display = ('trip_member_idx', 'trip_idx', 'user_idx', 'role')
    list_filter = ('role',)
    search_fields = ('trip_idx__title', 'user_idx__email')
    ordering = ('trip_idx', 'role')
