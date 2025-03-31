-- Migration: {{MIGRATION_NAME}}
-- Created at: {{TIMESTAMP}}
-- Description: {{DESCRIPTION}}

---------------------------------------------------------------------------
-- MIGRATION TEMPLATE WITH BEST PRACTICES FOR SUPABASE MIGRATIONS
---------------------------------------------------------------------------
-- Instructions:
-- 1. Replace all placeholders ({{PLACEHOLDER}}) with actual values
-- 2. Remove sections not needed for your specific migration
-- 3. Follow the guidelines in each section for safe migrations
---------------------------------------------------------------------------

-- Check if objects already exist before creating them
DO $$
BEGIN
  -- Example: Check if a table exists before creating it
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = '{{TABLE_NAME}}'
  ) THEN
    -- Create table statement goes here
    -- CREATE TABLE public.{{TABLE_NAME}} ( ... );
    
    -- Add comments
    -- COMMENT ON TABLE public.{{TABLE_NAME}} IS '{{TABLE_DESCRIPTION}}';
    
    -- Enable RLS
    -- ALTER TABLE public.{{TABLE_NAME}} ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Check if columns exist before adding them
DO $$
BEGIN
  -- Example: Check if a column exists before adding it
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = '{{TABLE_NAME}}' AND column_name = '{{COLUMN_NAME}}'
  ) THEN
    -- Add column
    -- ALTER TABLE public.{{TABLE_NAME}} ADD COLUMN {{COLUMN_NAME}} {{DATA_TYPE}} {{CONSTRAINTS}};
  END IF;
END $$;

-- Check if policies exist before creating them
DO $$
BEGIN
  -- Example: Check if a policy exists before creating it
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = '{{TABLE_NAME}}' 
    AND policyname = '{{POLICY_NAME}}'
  ) THEN
    -- Create policy
    -- CREATE POLICY "{{POLICY_NAME}}" ON public.{{TABLE_NAME}}
    -- FOR SELECT TO authenticated USING ( {{POLICY_CONDITION}} );
  END IF;
END $$;

-- Create or update functions safely
CREATE OR REPLACE FUNCTION public.{{FUNCTION_NAME}}({{FUNCTION_PARAMETERS}})
RETURNS {{RETURN_TYPE}}
LANGUAGE {{LANGUAGE}}
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  -- Variable declarations
BEGIN
  -- Function logic
END;
$$;

COMMENT ON FUNCTION public.{{FUNCTION_NAME}}({{FUNCTION_PARAMETERS}}) IS '{{FUNCTION_DESCRIPTION}}';

-- Create triggers safely
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = '{{TABLE_NAME}}'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = '{{TRIGGER_NAME}}' 
    AND tgrelid = 'public.{{TABLE_NAME}}'::regclass
  ) THEN
    -- Create trigger
    -- CREATE TRIGGER {{TRIGGER_NAME}}
    -- BEFORE UPDATE ON public.{{TABLE_NAME}}
    -- FOR EACH ROW
    -- EXECUTE FUNCTION public.{{TRIGGER_FUNCTION}}();
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    -- Handle case where table doesn't exist
    NULL;
END $$;

-- After all changes, refresh the PostgREST schema cache
-- This makes all changes immediately available to the API without restarting
SELECT pg_notify('pgrst', 'reload schema'); 