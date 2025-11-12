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


class Province(models.Model):
    """1단계 행정구역 (Province/State) - 시/도, 주, 광역시 등"""
    province_idx = models.AutoField(primary_key=True)
    country = models.ForeignKey(
        Country,
        on_delete=models.CASCADE,
        db_column='country_idx',
        related_name='provinces',
        help_text="국가"
    )
    code = models.CharField(max_length=20, help_text="행정구역 코드 (국가별 상이)")
    name = models.CharField(max_length=100, help_text="행정구역명 (현지어)")
    short_name = models.CharField(max_length=100, null=True, blank=True)
    name_en = models.CharField(max_length=100, null=True, blank=True, help_text="영문명")
    short_name_en = models.CharField(max_length=100, null=True, blank=True)

    # 좌표 정보
    grid_x = models.IntegerField(null=True, blank=True, help_text="격자 X (국가 기상청 기준)")
    grid_y = models.IntegerField(null=True, blank=True, help_text="격자 Y (국가 기상청 기준)")
    latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)

    level = models.IntegerField(default=1, help_text="행정구역 레벨")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'common_province'
        verbose_name = 'Province'
        verbose_name_plural = 'Provinces'
        ordering = ['country', 'code']
        unique_together = [['country', 'code']]
        indexes = [
            models.Index(fields=['country', 'code']),
            models.Index(fields=['country', 'name']),
        ]

    def __str__(self):
        return f"{self.country.iso2} - {self.name} ({self.code})"


class City(models.Model):
    """2단계 행정구역 (City/District) - 시/군/구 등"""
    city_idx = models.AutoField(primary_key=True)
    province = models.ForeignKey(
        Province,
        on_delete=models.CASCADE,
        db_column='province_idx',
        related_name='cities',
        help_text="상위 행정구역"
    )
    code = models.CharField(max_length=20, help_text="행정구역 코드")
    name = models.CharField(max_length=100, help_text="행정구역명 (현지어)")
    short_name = models.CharField(max_length=100, null=True, blank=True)
    name_en = models.CharField(max_length=100, null=True, blank=True, help_text="영문명")
    short_name_en = models.CharField(max_length=100, null=True, blank=True)

    # 좌표 정보
    grid_x = models.IntegerField(null=True, blank=True, help_text="격자 X")
    grid_y = models.IntegerField(null=True, blank=True, help_text="격자 Y")
    latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)

    level = models.IntegerField(default=2, help_text="행정구역 레벨")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'common_city'
        verbose_name = 'City'
        verbose_name_plural = 'Cities'
        ordering = ['province', 'code']
        unique_together = [['province', 'code']]
        indexes = [
            models.Index(fields=['province', 'code']),
            models.Index(fields=['province', 'name']),
            models.Index(fields=['grid_x', 'grid_y']),
        ]

    def __str__(self):
        return f"{self.province.name} {self.name} ({self.code})"


class District(models.Model):
    """3단계 행정구역 (District/Town) - 읍/면/동 등"""
    district_idx = models.AutoField(primary_key=True)
    city = models.ForeignKey(
        City,
        on_delete=models.CASCADE,
        db_column='city_idx',
        related_name='districts',
        help_text="상위 행정구역"
    )
    code = models.CharField(max_length=20, help_text="행정구역 코드")
    name = models.CharField(max_length=100, help_text="행정구역명 (현지어)")
    short_name = models.CharField(max_length=100, null=True, blank=True)
    name_en = models.CharField(max_length=100, null=True, blank=True, help_text="영문명")
    short_name_en = models.CharField(max_length=100, null=True, blank=True)

    # 좌표 정보
    grid_x = models.IntegerField(null=True, blank=True, help_text="격자 X")
    grid_y = models.IntegerField(null=True, blank=True, help_text="격자 Y")
    latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)

    level = models.IntegerField(default=3, help_text="행정구역 레벨")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'common_district'
        verbose_name = 'District'
        verbose_name_plural = 'Districts'
        ordering = ['city', 'code']
        unique_together = [['city', 'code']]
        indexes = [
            models.Index(fields=['city', 'code']),
            models.Index(fields=['city', 'name']),
            models.Index(fields=['grid_x', 'grid_y']),
            models.Index(fields=['city', 'grid_x', 'grid_y']),
        ]

    def __str__(self):
        return f"{self.city.province.name} {self.city.name} {self.name} ({self.code})"

    @property
    def full_address(self):
        """전체 주소 반환"""
        return f"{self.city.province.name} {self.city.name} {self.name}"
