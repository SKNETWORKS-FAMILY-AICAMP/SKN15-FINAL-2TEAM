from django.db import models


class Country(models.Model):
    """Country information"""
    country_idx = models.AutoField(primary_key=True)
    country_code = models.IntegerField(unique=True)
    iso2 = models.CharField(max_length=2)
    country_name = models.TextField()
    name_local = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'common_country'
        verbose_name = 'Country'
        verbose_name_plural = 'Countries'

    def __str__(self):
        return f"{self.country_name} ({self.iso2})"


class Region1(models.Model):
    """First-level administrative division (City)"""
    region1_idx = models.AutoField(primary_key=True)
    country_code = models.ForeignKey(
        Country,
        on_delete=models.CASCADE,
        db_column='country_code',
        to_field='country_idx'
    )
    city_code = models.IntegerField(unique=True)
    city_name = models.TextField()

    class Meta:
        db_table = 'common_region1'
        unique_together = [['country_code', 'city_code']]
        verbose_name = 'Region 1 (City)'
        verbose_name_plural = 'Region 1 (Cities)'

    def __str__(self):
        return f"{self.city_name}"


class Region2(models.Model):
    """Second-level administrative division (District)"""
    region2_idx = models.AutoField(primary_key=True)
    region1_idx = models.ForeignKey(
        Region1,
        on_delete=models.CASCADE,
        db_column='region1_idx'
    )
    region2_code = models.IntegerField()
    region2_name = models.TextField()

    class Meta:
        db_table = 'common_region2'
        unique_together = [['region1_idx', 'region2_code']]
        verbose_name = 'Region 2 (District)'
        verbose_name_plural = 'Region 2 (Districts)'

    def __str__(self):
        return f"{self.region2_name}"


class PlacesCategory(models.Model):
    """Place category"""
    category_idx = models.AutoField(primary_key=True)
    category_id = models.IntegerField(unique=True)
    text_code = models.TextField(unique=True)
    name_ko = models.TextField()
    name_en = models.TextField(null=True, blank=True)
    parent_idx = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='parent_idx'
    )
    description = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'common_places_category'
        verbose_name = 'Place Category'
        verbose_name_plural = 'Place Categories'

    def __str__(self):
        return f"{self.name_ko} ({self.text_code})"


class CountryElectric(models.Model):
    """Country electrical information (voltage, plug type, etc.)"""
    id = models.AutoField(primary_key=True)
    country_name = models.CharField(max_length=50)
    hz = models.CharField(max_length=10, null=True, blank=True)
    voltage = models.CharField(max_length=20, null=True, blank=True)
    plug_type = models.CharField(max_length=50, null=True, blank=True)
    plug_image = models.CharField(max_length=255, null=True, blank=True)
    use_yn = models.CharField(max_length=1, default='N')
    country_code = models.ForeignKey(
        Country,
        on_delete=models.CASCADE,
        db_column='country_code',
        to_field='country_code',
        null=True,
        blank=True
    )

    class Meta:
        db_table = 'country_electric'
        verbose_name = 'Country Electric Info'
        verbose_name_plural = 'Country Electric Info'

    def __str__(self):
        return f"{self.country_name} - {self.voltage}V {self.hz}Hz"
