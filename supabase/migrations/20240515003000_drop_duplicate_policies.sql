-- Migration: drop_duplicate_policies
-- Created at: 2024-05-15T00:30:00.000Z

-- Up Migration
-- This migration only drops existing policies to resolve conflicts

-- Drop all existing policies
DO $$ 
DECLARE
  pol RECORD;
BEGIN
  -- Loop through all policies in the database
  FOR pol IN 
    SELECT 
      policyname, 
      tablename,
      schemaname
    FROM 
      pg_policies 
    WHERE 
      schemaname = 'public'
  LOOP
    -- Drop each policy
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
                  pol.policyname, 
                  pol.schemaname, 
                  pol.tablename);
  END LOOP;
END $$;

-- Down Migration
-- No down migration needed 