from django.contrib import admin
from .models import Country, Region1, Region2, PlacesCategory, CountryElectric


@admin.register(Country)
class CountryAdmin(admin.ModelAdmin):
    list_display = ['country_idx', 'country_code', 'country_name', 'iso2', 'created_at']
    search_fields = ['country_name', 'iso2']
    list_filter = ['created_at']


@admin.register(Region1)
class Region1Admin(admin.ModelAdmin):
    list_display = ['region1_idx', 'country_code', 'city_code', 'city_name']
    search_fields = ['city_name']
    list_filter = ['country_code']


@admin.register(Region2)
class Region2Admin(admin.ModelAdmin):
    list_display = ['region2_idx', 'region1_idx', 'region2_code', 'region2_name']
    search_fields = ['region2_name']
    list_filter = ['region1_idx']


@admin.register(PlacesCategory)
class PlacesCategoryAdmin(admin.ModelAdmin):
    list_display = ['category_idx', 'category_id', 'text_code', 'name_ko', 'name_en', 'parent_idx']
    search_fields = ['name_ko', 'name_en', 'text_code']
    list_filter = ['parent_idx']


@admin.register(CountryElectric)
class CountryElectricAdmin(admin.ModelAdmin):
    list_display = ['id', 'country_name', 'voltage', 'hz', 'plug_type', 'use_yn', 'country_code']
    search_fields = ['country_name', 'plug_type']
    list_filter = ['use_yn', 'country_code']
    list_editable = ['use_yn']
