#!/usr/bin/env python3
"""
Import places data from SQL dump files into Django models
"""
import os
import sys
import django
import re
from datetime import datetime
from decimal import Decimal

# Setup Django
sys.path.insert(0, '/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from apps.places.models import Place
from apps.common.models import Country, Region1, Region2
from django.db import transaction

def parse_sql_file(filepath):
    """Parse SQL INSERT statements and extract data"""
    print(f"📂 Parsing {filepath}...")

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find all INSERT statements
    pattern = r"INSERT INTO public\.places.*?VALUES\s*(.*?);"
    matches = re.findall(pattern, content, re.DOTALL)

    places_data = []
    for match in matches:
        # Split by '),\n\t (' to get individual rows
        rows = re.split(r'\),\s*\n\s*\(', match)
        for row in rows:
            row = row.strip('()')
            places_data.append(row)

    print(f"✅ Found {len(places_data)} place records")
    return places_data

def parse_row(row_str):
    """Parse a single row of values"""
    # This is a simplified parser - might need adjustment for complex data
    values = []
    current = ''
    in_quotes = False

    i = 0
    while i < len(row_str):
        char = row_str[i]

        if char == "'" and (i == 0 or row_str[i-1] != '\\'):
            in_quotes = not in_quotes
        elif char == ',' and not in_quotes:
            values.append(current.strip())
            current = ''
            i += 1
            continue

        current += char
        i += 1

    if current:
        values.append(current.strip())

    return values

def clean_value(value):
    """Clean and convert SQL value to Python value"""
    value = value.strip()

    if value == 'NULL':
        return None

    # Remove quotes
    if value.startswith("'") and value.endswith("'"):
        value = value[1:-1]
        # Unescape quotes
        value = value.replace("''", "'")
        return value

    # Boolean
    if value.lower() == 'true':
        return True
    if value.lower() == 'false':
        return False

    return value

def get_or_create_country(name):
    """Get or create country by name"""
    if not name or name == 'NULL':
        return None

    # Try to find existing country
    country = Country.objects.filter(country_name=name).first()
    if not country:
        # Create new country with default values
        country_code = Country.objects.count() + 1
        iso2 = name[:2].upper()
        country = Country.objects.create(
            country_code=country_code,
            country_name=name,
            iso2=iso2
        )
    return country

def get_or_create_region1(name, country):
    """Get or create region1 by name"""
    if not name or name == 'NULL' or not country:
        return None

    # Try to find existing region1
    region1 = Region1.objects.filter(city_name=name, country_code=country).first()
    if not region1:
        # Create new region1
        city_code = Region1.objects.filter(country_code=country).count() + 1
        region1 = Region1.objects.create(
            country_code=country,
            city_code=city_code,
            city_name=name
        )
    return region1

def get_or_create_region2(name, region1):
    """Get or create region2 by name"""
    if not name or name == 'NULL' or not region1:
        return None

    # Try to find existing region2
    region2 = Region2.objects.filter(region2_name=name, region1_idx=region1).first()
    if not region2:
        # Create new region2
        region2_code = Region2.objects.filter(region1_idx=region1).count() + 1
        region2 = Region2.objects.create(
            region1_idx=region1,
            region2_code=region2_code,
            region2_name=name
        )
    return region2

def import_places(places_data):
    """Import places data into database"""
    print(f"📥 Importing {len(places_data)} places...")

    imported = 0
    skipped = 0
    errors = 0

    batch_size = 100
    for i in range(0, len(places_data), batch_size):
        batch = places_data[i:i+batch_size]

        with transaction.atomic():
            for row_str in batch:
                try:
                    values = parse_row(row_str)

                    if len(values) < 27:
                        print(f"⚠️  Skipping row with insufficient values: {len(values)}")
                        skipped += 1
                        continue

                    # Map columns
                    place_id = clean_value(values[0])
                    name = clean_value(values[1])
                    ko_name = clean_value(values[2])
                    country_name = clean_value(values[3])
                    region1_name = clean_value(values[4])
                    region2_name = clean_value(values[5])
                    types = clean_value(values[6])
                    address = clean_value(values[7])
                    latitude = clean_value(values[8])
                    longitude = clean_value(values[9])
                    google_maps_uri = clean_value(values[10])
                    website_uri = clean_value(values[11])
                    national_phone = clean_value(values[12])
                    intl_phone = clean_value(values[13])
                    rating = clean_value(values[20])
                    total_reviews = clean_value(values[21])

                    # Get or create foreign keys
                    country = get_or_create_country(country_name)
                    region1 = get_or_create_region1(region1_name, country)
                    region2 = get_or_create_region2(region2_name, region1)

                    # Convert types
                    if latitude:
                        latitude = float(latitude)
                    if longitude:
                        longitude = float(longitude)
                    if rating:
                        rating = min(float(rating), 5.0)
                        rating = Decimal(str(rating))
                    if total_reviews:
                        total_reviews = int(total_reviews)

                    phone = national_phone or intl_phone

                    # Create or update place
                    place, created = Place.objects.update_or_create(
                        place_id=place_id,
                        defaults={
                            'name': name,
                            'ko_name': ko_name,
                            'country_idx': country,
                            'region1_idx': region1,
                            'region2_idx': region2,
                            'types': types,
                            'address': address,
                            'latitude': latitude,
                            'longitude': longitude,
                            'google_maps_uri': google_maps_uri,
                            'website_uri': website_uri,
                            'phone': phone,
                            'rating': rating,
                            'user_ratings_total': total_reviews,
                        }
                    )

                    imported += 1

                    if imported % 1000 == 0:
                        print(f"✅ Imported {imported} places...")

                except Exception as e:
                    print(f"❌ Error importing row: {str(e)[:100]}")
                    errors += 1
                    continue

    print(f"\n{'='*50}")
    print(f"✅ Import completed!")
    print(f"   Imported: {imported}")
    print(f"   Skipped:  {skipped}")
    print(f"   Errors:   {errors}")
    print(f"{'='*50}\n")

    return imported

if __name__ == '__main__':
    print("="*50)
    print("PLACES DATA IMPORT SCRIPT")
    print("="*50)

    # Parse SQL files
    places1 = parse_sql_file('/tmp/places_202510211121.sql')
    places2 = parse_sql_file('/tmp/places_korea_detail_202510211123.sql')

    all_places = places1 + places2
    print(f"\n📊 Total records to import: {len(all_places)}\n")

    # Import data
    total_imported = import_places(all_places)

    # Show final stats
    total_count = Place.objects.count()
    print(f"📊 Final database stats:")
    print(f"   Total places in DB: {total_count}")
    print(f"   With country: {Place.objects.exclude(country_idx=None).count()}")
    print(f"   With region1: {Place.objects.exclude(region1_idx=None).count()}")
    print(f"   With region2: {Place.objects.exclude(region2_idx=None).count()}")
    print(f"   With rating: {Place.objects.exclude(rating=None).count()}")
