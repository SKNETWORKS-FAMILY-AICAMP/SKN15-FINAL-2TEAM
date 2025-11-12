-- pgvector Extension Setup
-- This enables vector similarity search for RAG implementation

\c lecun2

-- Create pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify installation
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
    ) THEN
        RAISE NOTICE 'pgvector extension installed successfully';
        RAISE NOTICE 'Version: %', (SELECT extversion FROM pg_extension WHERE extname = 'vector');
    ELSE
        RAISE EXCEPTION 'Failed to install pgvector extension';
    END IF;
END $$;

-- Example: Create a sample embeddings table structure
-- (This is a template - actual tables will be created by Django migrations)
/*
CREATE TABLE IF NOT EXISTS travel.embeddings (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    embedding vector(1536),  -- OpenAI ada-002 embedding dimension
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS embeddings_vector_idx
ON travel.embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create GIN index for metadata search
CREATE INDEX IF NOT EXISTS embeddings_metadata_idx
ON travel.embeddings
USING GIN (metadata);
*/

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'pgvector setup completed';
END $$;
