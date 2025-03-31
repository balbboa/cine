-- Create clubs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.clubs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id) NOT NULL
);
COMMENT ON TABLE public.clubs IS 'Clubs that users can create and join';

-- Create club_members table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.club_members (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES public.clubs(id) NOT NULL,
  member_id uuid REFERENCES auth.users(id) NOT NULL,
  joined_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(club_id, member_id)
);
COMMENT ON TABLE public.club_members IS 'Junction table for clubs and members';

-- Enable RLS on both tables if not already enabled
DO $$
BEGIN
    -- Enable RLS on clubs if not already enabled
    IF NOT EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'clubs' 
        AND rowsecurity
    ) THEN
        ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
    END IF;
    
    -- Enable RLS on club_members if not already enabled
    IF NOT EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'club_members' 
        AND rowsecurity
    ) THEN
        ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
    END IF;
    
    -- Create policies only if they don't exist
    IF NOT EXISTS (
        SELECT FROM pg_policies WHERE policyname = 'Anyone can view clubs' AND tablename = 'clubs'
    ) THEN
        CREATE POLICY "Anyone can view clubs" ON clubs
        FOR SELECT
        USING (true);
    END IF;
    
    IF NOT EXISTS (
        SELECT FROM pg_policies WHERE policyname = 'Users can create clubs' AND tablename = 'clubs'
    ) THEN
        CREATE POLICY "Users can create clubs" ON clubs
        FOR INSERT
        WITH CHECK (auth.uid() = created_by);
    END IF;
    
    IF NOT EXISTS (
        SELECT FROM pg_policies WHERE policyname = 'Club creators can update clubs' AND tablename = 'clubs'
    ) THEN
        CREATE POLICY "Club creators can update clubs" ON clubs
        FOR UPDATE
        USING (auth.uid() = created_by)
        WITH CHECK (auth.uid() = created_by);
    END IF;
    
    IF NOT EXISTS (
        SELECT FROM pg_policies WHERE policyname = 'Club creators can delete clubs' AND tablename = 'clubs'
    ) THEN
        CREATE POLICY "Club creators can delete clubs" ON clubs
        FOR DELETE
        USING (auth.uid() = created_by);
    END IF;
    
    IF NOT EXISTS (
        SELECT FROM pg_policies WHERE policyname = 'Anyone can see club members' AND tablename = 'club_members'
    ) THEN
        CREATE POLICY "Anyone can see club members" ON club_members
        FOR SELECT
        USING (true);
    END IF;
    
    IF NOT EXISTS (
        SELECT FROM pg_policies WHERE policyname = 'Users can join clubs' AND tablename = 'club_members'
    ) THEN
        CREATE POLICY "Users can join clubs" ON club_members
        FOR INSERT
        WITH CHECK (auth.uid() = member_id);
    END IF;
    
    IF NOT EXISTS (
        SELECT FROM pg_policies WHERE policyname = 'Users can leave clubs' AND tablename = 'club_members'
    ) THEN
        CREATE POLICY "Users can leave clubs" ON club_members
        FOR DELETE
        USING (auth.uid() = member_id);
    END IF;
END
$$;

-- Create trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_clubs_updated_at
BEFORE UPDATE ON public.clubs
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Add club-related functions

-- Function to check if a user is a member of a specific club
CREATE OR REPLACE FUNCTION public.is_club_member(club_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = is_club_member.club_id AND user_id = auth.uid()
  );
END;
$$;

-- Function to get all clubs with member counts
CREATE OR REPLACE FUNCTION public.get_clubs_with_member_count()
RETURNS TABLE (
  id BIGINT,
  name TEXT,
  description TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  member_count BIGINT,
  is_member BOOLEAN
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.description,
    c.created_at,
    c.updated_at,
    COUNT(DISTINCT cm.user_id)::BIGINT AS member_count,
    EXISTS (
      SELECT 1 FROM public.club_members 
      WHERE club_id = c.id AND user_id = auth.uid()
    ) AS is_member
  FROM 
    public.clubs c
  LEFT JOIN 
    public.club_members cm ON c.id = cm.club_id
  GROUP BY
    c.id, c.name, c.description, c.created_at, c.updated_at
  ORDER BY
    c.name ASC;
END;
$$;

-- Function to create a club and add the creator as a member in one transaction
CREATE OR REPLACE FUNCTION public.create_club_with_membership(
  name TEXT,
  description TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  new_club_id BIGINT;
BEGIN
  -- Ensure the user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to create a club';
  END IF;

  -- Create the club and get its ID
  INSERT INTO public.clubs (name, description)
  VALUES (name, description)
  RETURNING id INTO new_club_id;
  
  -- Add the creator as a member
  INSERT INTO public.club_members (user_id, club_id)
  VALUES (auth.uid(), new_club_id);
  
  RETURN new_club_id;
END;
$$;

COMMENT ON FUNCTION public.create_club_with_membership IS 'Creates a club and automatically adds the creator as a member'; 