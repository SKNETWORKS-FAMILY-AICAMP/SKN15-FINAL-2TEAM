-- Initial Database Setup for Travel Planner
-- This script runs when the PostgreSQL container is first created

-- Create database if not exists
SELECT 'CREATE DATABASE triplan'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'triplan')\gexec

-- Connect to the database
\c triplan

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create schema for better organization (optional)
CREATE SCHEMA IF NOT EXISTS travel;

-- Grant permissions
GRANT ALL PRIVILEGES ON SCHEMA travel TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA travel TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA travel TO postgres;

-- Log message
DO $$
BEGIN
    RAISE NOTICE 'Database triplan initialized successfully';
END $$;
