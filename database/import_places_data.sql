-- ============================================================================
-- Import Places Data into place_places table
-- ============================================================================
-- This script imports data from the original places dump files
-- and converts it to match the Django model structure
-- ============================================================================

BEGIN;

-- Create temporary table with the original structure
CREATE TEMP TABLE temp_places_import (
    id TEXT,
    name TEXT,
    ko_name TEXT,
    country_name TEXT,
    region1_name TEXT,
    region2_name TEXT,
    types TEXT,
    address TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    google_maps_uri TEXT,
    website_uri TEXT,
    national_phone_number TEXT,
    international_phone_number TEXT,
    current_opening_hours_summary TEXT,
    regular_opening_hours_summary TEXT,
    utc_offset_minutes INTEGER,
    takeout_available BOOLEAN,
    delivery_available BOOLEAN,
    dinein_available BOOLEAN,
    rating DOUBLE PRECISION,
    total_reviews_count INTEGER,
    price_level_code TEXT,
    category_id INTEGER,
    attributions_summary TEXT,
    last_updated TIMESTAMP,
    region3_name TEXT
);

-- The actual INSERT statements from the SQL files will go here
-- This is just the structure - you'll need to run the SQL files to populate it

COMMIT;
