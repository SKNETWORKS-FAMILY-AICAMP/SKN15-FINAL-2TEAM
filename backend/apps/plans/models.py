from django.db import models
from django.core.validators import MinValueValidator
from django.utils import timezone
from datetime import timedelta
import random
import string
from apps.accounts.models import User
from apps.common.models import Country, Region1, Region2
from apps.places.models import Place


class TripPlan(models.Model):
    """
    Trip plan model - represents a travel itinerary.
    Maps to the trip_plans table in the database.
    """

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('confirmed', 'Confirmed'),
        ('archived', 'Archived'),
    ]

    trip_idx = models.AutoField(primary_key=True, db_column='trip_idx')
    owner_user_idx = models.ForeignKey(
        User,
        on_delete=models.RESTRICT,
        db_column='owner_user_idx',
        related_name='owned_trips'
    )
    title = models.TextField()
    country_idx = models.ForeignKey(
        Country,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='country_idx',
        related_name='trip_plans'
    )
    region1_idx = models.ForeignKey(
        Region1,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='region1_idx',
        related_name='trip_plans'
    )
    region2_idx = models.ForeignKey(
        Region2,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='region2_idx',
        related_name='trip_plans'
    )
    start_date = models.DateField()
    end_date = models.DateField()
    party_size = models.IntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1)]
    )
    budget_currency = models.TextField(null=True, blank=True)
    budget_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft'
    )
    # Invitation code for easy trip sharing
    invite_code = models.CharField(
        max_length=10,
        unique=True,
        null=True,
        blank=True,
        db_index=True,
        help_text='6-character invite code for joining trip'
    )
    invite_code_expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Expiration time for invite code'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'trip_plans'
        verbose_name = 'Trip Plan'
        verbose_name_plural = 'Trip Plans'
        constraints = [
            models.CheckConstraint(
                check=models.Q(party_size__isnull=True) | models.Q(party_size__gte=1),
                name='trip_plans_party_size_check'
            ),
            models.CheckConstraint(
                check=models.Q(status__in=['draft', 'confirmed', 'archived']),
                name='trip_plans_status_check'
            ),
        ]

    def __str__(self):
        return f"{self.title} ({self.start_date} - {self.end_date})"

    def generate_invite_code(self, expiry_hours=24):
        """Generate a unique 6-character invite code"""
        while True:
            # Generate random 6-character code (uppercase letters and numbers)
            code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
            # Check if code already exists
            if not TripPlan.objects.filter(invite_code=code).exists():
                self.invite_code = code
                self.invite_code_expires_at = timezone.now() + timedelta(hours=expiry_hours)
                self.save(update_fields=['invite_code', 'invite_code_expires_at'])
                return code

    def is_invite_code_valid(self):
        """Check if invite code is still valid"""
        if not self.invite_code or not self.invite_code_expires_at:
            return False
        return timezone.now() < self.invite_code_expires_at


class TripDay(models.Model):
    """
    Trip day model - represents a single day in a trip plan.
    Maps to the trip_days table in the database.
    """

    day_idx = models.AutoField(primary_key=True, db_column='day_idx')
    trip_idx = models.ForeignKey(
        TripPlan,
        on_delete=models.CASCADE,
        db_column='trip_idx',
        related_name='days'
    )
    day_no = models.IntegerField()
    date = models.DateField()

    class Meta:
        db_table = 'trip_days'
        verbose_name = 'Trip Day'
        verbose_name_plural = 'Trip Days'
        unique_together = [
            ['trip_idx', 'date'],
            ['trip_idx', 'day_no'],
        ]

    def __str__(self):
        return f"{self.trip_idx.title} - Day {self.day_no} ({self.date})"


class TripItem(models.Model):
    """
    Trip item model - represents an activity or place in a trip day.
    Maps to the trip_items table in the database.
    """

    ITEM_TYPE_CHOICES = [
        ('place', 'Place'),
        ('meal', 'Meal'),
        ('activity', 'Activity'),
        ('transfer', 'Transfer'),
        ('rest', 'Rest'),
        ('custom', 'Custom'),
    ]

    item_idx = models.AutoField(primary_key=True, db_column='item_idx')
    day_idx = models.ForeignKey(
        TripDay,
        on_delete=models.CASCADE,
        db_column='day_idx',
        related_name='items'
    )
    item_type = models.CharField(
        max_length=20,
        choices=ITEM_TYPE_CHOICES
    )
    place_idx = models.ForeignKey(
        Place,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='place_idx',
        related_name='trip_items'
    )
    title = models.TextField(null=True, blank=True)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    estimated_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True
    )
    lock_flag = models.BooleanField(default=False)
    notes = models.TextField(null=True, blank=True)
    order_in_day = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'trip_items'
        verbose_name = 'Trip Item'
        verbose_name_plural = 'Trip Items'
        ordering = ['order_in_day']
        constraints = [
            models.CheckConstraint(
                check=models.Q(item_type__in=['place', 'meal', 'activity', 'transfer', 'rest', 'custom']),
                name='trip_items_item_type_check'
            ),
        ]

    def __str__(self):
        return f"{self.title or self.item_type} - Day {self.day_idx.day_no}"


class TripMember(models.Model):
    """
    Trip member model - represents a user's membership in a trip plan.
    Maps to the trip_members table in the database.
    """

    ROLE_CHOICES = [
        ('owner', 'Owner'),
        ('editor', 'Editor'),
        ('commenter', 'Commenter'),
        ('viewer', 'Viewer'),
    ]

    trip_member_idx = models.AutoField(primary_key=True, db_column='trip_member_idx')
    trip_idx = models.ForeignKey(
        TripPlan,
        on_delete=models.CASCADE,
        db_column='trip_idx',
        related_name='members'
    )
    user_idx = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        db_column='user_idx',
        related_name='trip_memberships'
    )
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default='editor'
    )

    class Meta:
        db_table = 'trip_members'
        verbose_name = 'Trip Member'
        verbose_name_plural = 'Trip Members'
        unique_together = [['trip_idx', 'user_idx']]
        constraints = [
            models.CheckConstraint(
                check=models.Q(role__in=['owner', 'editor', 'commenter', 'viewer']),
                name='trip_members_role_check'
            ),
        ]

    def __str__(self):
        return f"{self.user_idx.email} - {self.trip_idx.title} ({self.role})"
