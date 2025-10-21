from django.db import models
from apps.common.models import Country, Region1


class WorldTime(models.Model):
    """
    World time model - stores timezone information for cities around the world.
    Maps to the world_time table in the database.
    """

    world_time_idx = models.AutoField(primary_key=True, db_column='world_time_idx')
    country_code = models.ForeignKey(
        Country,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='country_code',
        to_field='country_code',
        related_name='world_times'
    )
    city_code = models.ForeignKey(
        Region1,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='city_code',
        to_field='city_code',
        related_name='world_times'
    )
    continent = models.CharField(max_length=50)
    city_time = models.CharField(max_length=50)
    time_difference = models.CharField(max_length=6, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'world_time'
        verbose_name = 'World Time'
        verbose_name_plural = 'World Times'

    def __str__(self):
        return f"{self.city_time} - {self.continent} (UTC{self.time_difference or ''})"
