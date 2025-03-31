-- Migration: add-some-feature
-- Created at: 2025-03-27T20:44:20.588Z

-- Up Migration
-- This section contains the changes to apply the migration

-- Step 1: Create any new tables or modify existing ones

-- Step 2: Update or create any new functions

-- Step 3: Set up any required policies

-- Down Migration (Optional)
-- This section contains the SQL to revert the migration if needed

-- Example:
-- DROP TABLE IF EXISTS public.table_name;

-- Create migrations table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.migrations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Add RLS policies for migrations table if it exists
ALTER TABLE public.migrations ENABLE ROW LEVEL SECURITY;

-- Create policies only if they don't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'migrations' 
    AND policyname = 'Migrations are viewable by everyone'
  ) THEN
    CREATE POLICY "Migrations are viewable by everyone" 
      ON public.migrations FOR SELECT USING (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'migrations' 
    AND policyname = 'Service role can insert migrations'
  ) THEN
    CREATE POLICY "Service role can insert migrations" 
      ON public.migrations FOR INSERT WITH CHECK (true);
  END IF;
END
$$;

-- Create helper function for migrations
CREATE OR REPLACE FUNCTION create_migrations_table_if_not_exists()
RETURNS void AS $$
BEGIN
  -- This function exists simply to check if the migrations infrastructure is set up
  -- The actual table creation is done in the initial migration
END;
$$ LANGUAGE plpgsql;

-- Insert migration records if they don't already exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.migrations WHERE name = 'setup.sql') THEN
    RAISE NOTICE 'Migration setup.sql already exists, skipping';
  ELSE
    INSERT INTO public.migrations (name) VALUES ('setup.sql');
  END IF;
  
  IF EXISTS (SELECT 1 FROM public.migrations WHERE name = '20240515000000_add_existing_user.sql') THEN
    RAISE NOTICE 'Migration 20240515000000_add_existing_user.sql already exists, skipping';
  ELSE
    INSERT INTO public.migrations (name) VALUES ('20240515000000_add_existing_user.sql');
  END IF;
  
  IF EXISTS (SELECT 1 FROM public.migrations WHERE name = '20240515001000_fix_duplicate_badges.sql') THEN
    RAISE NOTICE 'Migration 20240515001000_fix_duplicate_badges.sql already exists, skipping';
  ELSE
    INSERT INTO public.migrations (name) VALUES ('20240515001000_fix_duplicate_badges.sql');
  END IF;
END
$$;

