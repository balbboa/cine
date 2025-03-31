-- Fix clubs RLS and add function for creating clubs with automatic membership
-- This function creates a club and automatically adds the creator as a member
-- in a single transaction to avoid RLS issues when creating clubs

DO $$
BEGIN
  -- Only create the function if it doesn't already exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    JOIN pg_namespace ON pg_namespace.oid = pg_proc.pronamespace
    WHERE pg_proc.proname = 'create_club_with_membership'
    AND pg_namespace.nspname = 'public'
  ) THEN
    CREATE OR REPLACE FUNCTION public.create_club_with_membership(
      club_name text,
      club_description text,
      creator_id uuid
    ) RETURNS json
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
      new_club_id bigint;
      result json;
    BEGIN
      -- Create the club
      INSERT INTO public.clubs (name, description, created_by)
      VALUES (club_name, club_description, creator_id)
      RETURNING id INTO new_club_id;
      
      -- Add the creator as a member
      INSERT INTO public.club_members (club_id, member_id)
      VALUES (new_club_id, creator_id);
      
      -- Return the result
      SELECT json_build_object(
        'club_id', new_club_id,
        'success', true
      ) INTO result;
      
      RETURN result;
    END;
    $$;
  END IF;
END
$$;

COMMENT ON FUNCTION public.create_club_with_membership IS 'Creates a club and automatically adds the creator as a member';

-- Drop existing policy if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM pg_policies WHERE policyname = 'Anyone can view clubs' AND tablename = 'clubs'
    ) THEN
        DROP POLICY "Anyone can view clubs" ON clubs;
    END IF;

    -- Recreate the policy
    CREATE POLICY "Anyone can view clubs" ON clubs
    FOR SELECT
    USING (true);

    -- Add any other fixes for clubs membership here
END
$$; 