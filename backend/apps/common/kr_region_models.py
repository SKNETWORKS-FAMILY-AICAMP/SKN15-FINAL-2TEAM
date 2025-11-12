from django.db import models


class KRProvince(models.Model):
    """한국 시/도 (Province) - 1단계 행정구역"""
    province_idx = models.AutoField(primary_key=True)
    code = models.CharField(max_length=12, unique=True, help_text="기상청 시/도 코드 (12자리)")
    name = models.CharField(max_length=50, help_text="시/도명 (예: 서울특별시)")
    short_name = models.CharField(max_length=50, null=True, blank=True)
    name_en = models.CharField(max_length=100, null=True, blank=True)
    short_name_en = models.CharField(max_length=100, null=True, blank=True)

    # 좌표 정보 (시/도는 일반적으로 좌표 없음)
    grid_x = models.IntegerField(null=True, blank=True, help_text="기상청 격자 X")
    grid_y = models.IntegerField(null=True, blank=True, help_text="기상청 격자 Y")
    latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)

    level = models.IntegerField(default=1, help_text="행정구역 레벨 (1=시/도)")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'kr_province'
        verbose_name = '시/도'
        verbose_name_plural = '시/도'
        ordering = ['code']
        indexes = [
            models.Index(fields=['code']),
            models.Index(fields=['name']),
        ]

    def __str__(self):
        return f"{self.name} ({self.code})"


class KRCity(models.Model):
    """한국 시/군/구 (City) - 2단계 행정구역"""
    city_idx = models.AutoField(primary_key=True)
    province = models.ForeignKey(
        KRProvince,
        on_delete=models.CASCADE,
        db_column='province_idx',
        related_name='cities',
        help_text="상위 시/도"
    )
    code = models.CharField(max_length=12, unique=True, help_text="기상청 시/군/구 코드 (10자리)")
    name = models.CharField(max_length=50, help_text="시/군/구명 (예: 강남구)")
    short_name = models.CharField(max_length=50, null=True, blank=True)
    name_en = models.CharField(max_length=100, null=True, blank=True)
    short_name_en = models.CharField(max_length=100, null=True, blank=True)

    # 좌표 정보
    grid_x = models.IntegerField(null=True, blank=True, help_text="기상청 격자 X")
    grid_y = models.IntegerField(null=True, blank=True, help_text="기상청 격자 Y")
    latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)

    level = models.IntegerField(default=2, help_text="행정구역 레벨 (2=시/군/구)")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'kr_city'
        verbose_name = '시/군/구'
        verbose_name_plural = '시/군/구'
        ordering = ['code']
        indexes = [
            models.Index(fields=['code']),
            models.Index(fields=['province', 'name']),
            models.Index(fields=['grid_x', 'grid_y']),
        ]

    def __str__(self):
        return f"{self.province.name} {self.name} ({self.code})"


class KRDistrict(models.Model):
    """한국 읍/면/동 (District) - 3단계 행정구역"""
    district_idx = models.AutoField(primary_key=True)
    city = models.ForeignKey(
        KRCity,
        on_delete=models.CASCADE,
        db_column='city_idx',
        related_name='districts',
        help_text="상위 시/군/구"
    )
    code = models.CharField(max_length=12, unique=True, help_text="기상청 읍/면/동 코드")
    name = models.CharField(max_length=50, help_text="읍/면/동명 (예: 역삼동)")
    short_name = models.CharField(max_length=50, null=True, blank=True)
    name_en = models.CharField(max_length=100, null=True, blank=True)
    short_name_en = models.CharField(max_length=100, null=True, blank=True)

    # 좌표 정보 (읍/면/동은 격자 좌표 있음)
    grid_x = models.IntegerField(null=True, blank=True, help_text="기상청 격자 X")
    grid_y = models.IntegerField(null=True, blank=True, help_text="기상청 격자 Y")
    latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)

    level = models.IntegerField(default=3, help_text="행정구역 레벨 (3=읍/면/동)")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'kr_district'
        verbose_name = '읍/면/동'
        verbose_name_plural = '읍/면/동'
        ordering = ['code']
        indexes = [
            models.Index(fields=['code']),
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
