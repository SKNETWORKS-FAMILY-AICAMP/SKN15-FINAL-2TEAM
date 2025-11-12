from django.db import models
from apps.common.models import Country, Province, City, District, PlacesCategory


class Place(models.Model):
    """Place model - represents a physical location/place"""
    place_idx = models.AutoField(primary_key=True)
    place_id = models.TextField(unique=True)
    name = models.TextField(null=True, blank=True)
    ko_name = models.TextField(null=True, blank=True)
    country_idx = models.ForeignKey(
        Country,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='country_idx'
    )
    province_idx = models.ForeignKey(
        Province,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='province_idx'
    )
    city_idx = models.ForeignKey(
        City,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='city_idx'
    )
    district_idx = models.ForeignKey(
        District,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='district_idx'
    )
    types = models.TextField(null=True, blank=True)
    address = models.TextField(null=True, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    google_maps_uri = models.TextField(null=True, blank=True)
    website_uri = models.TextField(null=True, blank=True)
    phone = models.TextField(null=True, blank=True)
    rating = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True)
    user_ratings_total = models.IntegerField(null=True, blank=True)
    api_key_idx = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'place_places'
        verbose_name = 'Place'
        verbose_name_plural = 'Places'
        indexes = [
            models.Index(fields=['place_id']),
            models.Index(fields=['latitude', 'longitude']),
        ]

    def __str__(self):
        return f"{self.ko_name or self.name or self.place_id}"


class Photo(models.Model):
    """Photo model - represents photos associated with places"""
    photo_idx = models.AutoField(primary_key=True)
    place_idx = models.ForeignKey(
        Place,
        on_delete=models.CASCADE,
        db_column='place_idx',
        related_name='photos'
    )
    is_primary = models.BooleanField(default=False)
    width = models.IntegerField(null=True, blank=True)
    height = models.IntegerField(null=True, blank=True)
    attributions = models.TextField(null=True, blank=True)
    local_path = models.TextField(null=True, blank=True)
    remote_uri = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'place_photos'
        verbose_name = 'Photo'
        verbose_name_plural = 'Photos'
        indexes = [
            models.Index(fields=['place_idx', 'is_primary']),
        ]

    def __str__(self):
        primary_str = " (Primary)" if self.is_primary else ""
        return f"Photo {self.photo_idx} for {self.place_idx}{primary_str}"


class PlaceCategory(models.Model):
    """PlaceCategory model - junction table linking places to categories"""
    place_category_idx = models.AutoField(primary_key=True)
    place_idx = models.ForeignKey(
        Place,
        on_delete=models.CASCADE,
        db_column='place_idx',
        related_name='place_categories'
    )
    category_idx = models.ForeignKey(
        PlacesCategory,
        on_delete=models.RESTRICT,
        db_column='category_idx',
        related_name='place_categories'
    )

    class Meta:
        db_table = 'place_place_categories'
        verbose_name = 'Place Category'
        verbose_name_plural = 'Place Categories'
        unique_together = [['place_idx', 'category_idx']]
        indexes = [
            models.Index(fields=['place_idx']),
            models.Index(fields=['category_idx']),
        ]

    def __str__(self):
        return f"{self.place_idx} - {self.category_idx}"
