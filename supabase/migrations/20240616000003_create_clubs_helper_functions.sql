-- Function for creating clubs with membership
DROP FUNCTION IF EXISTS public.create_club_with_membership;

CREATE OR REPLACE FUNCTION public.create_club_with_membership(
  name TEXT,
  description TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  club_id UUID;
BEGIN
  -- Create the club
  INSERT INTO public.clubs (name, description, created_by)
  VALUES (name, description, auth.uid())
  RETURNING id INTO club_id;
  
  -- Add the creator as a member - try both columns for compatibility
  BEGIN
    INSERT INTO public.club_members (club_id, user_id, member_id)
    VALUES (club_id, auth.uid(), auth.uid());
  EXCEPTION WHEN OTHERS THEN
    -- If this fails, try with just one id column
    INSERT INTO public.club_members (club_id, user_id)
    VALUES (club_id, auth.uid());
  END;
  
  RETURN club_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.create_club_with_membership IS 'Creates a club and automatically adds the creator as a member';

-- Function for getting clubs with member counts
DROP FUNCTION IF EXISTS public.get_clubs_with_member_count;

CREATE OR REPLACE FUNCTION public.get_clubs_with_member_count()
RETURNS TABLE(
  id UUID,
  name TEXT,
  description TEXT,
  created_at TIMESTAMPTZ,
  created_by UUID,
  updated_at TIMESTAMPTZ,
  member_count BIGINT,
  is_member BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.description,
    c.created_at,
    c.created_by,
    c.updated_at,
    COUNT(cm.id)::BIGINT AS member_count,
    EXISTS (
      SELECT 1 FROM club_members 
      WHERE club_id = c.id AND (user_id = auth.uid() OR member_id = auth.uid())
    ) AS is_member
  FROM 
    clubs c
  LEFT JOIN 
    club_members cm ON c.id = cm.club_id
  GROUP BY 
    c.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_clubs_with_member_count IS 'Returns all clubs with their member counts and membership status for current user';

-- Function to check if a user is a member of a club
DROP FUNCTION IF EXISTS public.is_club_member;

CREATE OR REPLACE FUNCTION public.is_club_member(club_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM club_members 
    WHERE club_id = $1 AND (user_id = auth.uid() OR member_id = auth.uid())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.is_club_member IS 'Checks if current user is a member of the specified club';

-- Ensure created_by is not null for existing records
DO $$
BEGIN
  UPDATE public.clubs
  SET created_by = '00000000-0000-0000-0000-000000000000'
  WHERE created_by IS NULL;
  
  -- Make created_by NOT NULL after ensuring data consistency
  ALTER TABLE public.clubs ALTER COLUMN created_by SET NOT NULL;
EXCEPTION WHEN OTHERS THEN
  -- Ignore errors
END;
$$;

-- Simple function to create a club
CREATE OR REPLACE FUNCTION public.create_club(
  p_name TEXT,
  p_description TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  club_id UUID;
BEGIN
  INSERT INTO public.clubs (name, description)
  VALUES (p_name, p_description)
  RETURNING id INTO club_id;
  
  RETURN club_id;
END;
$$ LANGUAGE plpgsql;

-- Simple function to get all clubs
CREATE OR REPLACE FUNCTION public.get_all_clubs()
RETURNS SETOF public.clubs AS $$
  SELECT * FROM public.clubs;
$$ LANGUAGE sql; 