-- Function for creating clubs with membership
DROP FUNCTION IF EXISTS public.create_club_with_membership;

CREATE FUNCTION public.create_club_with_membership(
  club_name text,
  club_description text,
  creator_id uuid
)
RETURNS json
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
  
  -- Add the creator as a member - try both fields for compatibility
  BEGIN
    INSERT INTO public.club_members (club_id, member_id)
    VALUES (new_club_id, creator_id);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.club_members (club_id, user_id)
    VALUES (new_club_id, creator_id);
  END;
  
  -- Return the result
  SELECT json_build_object(
    'club_id', new_club_id,
    'success', true
  ) INTO result;
  
  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.create_club_with_membership IS 'Creates a club and automatically adds the creator as a member';

-- Function for getting clubs with member counts
DROP FUNCTION IF EXISTS public.get_clubs_with_member_count;

CREATE FUNCTION public.get_clubs_with_member_count()
RETURNS TABLE (
  id bigint,
  name text,
  description text,
  created_at timestamptz,
  created_by uuid,
  updated_at timestamptz,
  member_count bigint,
  is_member boolean
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT 
    c.id,
    c.name,
    c.description,
    c.created_at,
    c.created_by,
    c.updated_at,
    COUNT(cm.id)::bigint AS member_count,
    EXISTS (
      SELECT 1 FROM public.club_members 
      WHERE club_id = c.id AND (
        member_id = auth.uid() OR
        user_id = auth.uid()
      )
    ) AS is_member
  FROM 
    public.clubs c
  LEFT JOIN 
    public.club_members cm ON c.id = cm.club_id
  GROUP BY
    c.id
  ORDER BY
    c.name;
$$;

COMMENT ON FUNCTION public.get_clubs_with_member_count IS 'Returns all clubs with their member counts and membership status for current user';

-- Function to check if a user is a member of a club
DROP FUNCTION IF EXISTS public.is_club_member;

CREATE FUNCTION public.is_club_member(club_id_param bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = club_id_param AND (
      member_id = auth.uid() OR
      user_id = auth.uid()
    )
  );
END;
$$;

COMMENT ON FUNCTION public.is_club_member IS 'Checks if current user is a member of the specified club';

-- Ensure created_by is not null for existing records
DO $$
BEGIN
  UPDATE public.clubs
  SET created_by = (SELECT id FROM auth.users LIMIT 1)
  WHERE created_by IS NULL;
  
  -- Make created_by NOT NULL after ensuring data consistency
  ALTER TABLE public.clubs ALTER COLUMN created_by SET NOT NULL;
EXCEPTION WHEN OTHERS THEN
  -- Ignore errors
END;
$$; 