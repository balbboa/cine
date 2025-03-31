-- Create clubs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.clubs IS 'Clubs that users can create and join';

-- Create club_members table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.club_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
  member_id UUID, -- For older member reference
  user_id UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.club_members IS 'Junction table for clubs and members';

-- Add unique constraints (safely)
DO $$
BEGIN
  -- Add the constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'club_members_club_id_member_id_key' 
    AND conrelid = 'public.club_members'::regclass
  ) THEN
    ALTER TABLE public.club_members ADD CONSTRAINT club_members_club_id_member_id_key UNIQUE (club_id, member_id);
  END IF;

  -- Add the constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'club_members_club_id_user_id_key' 
    AND conrelid = 'public.club_members'::regclass
  ) THEN
    ALTER TABLE public.club_members ADD CONSTRAINT club_members_club_id_user_id_key UNIQUE (club_id, user_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Ignore errors
END;
$$;

-- Enable Row Level Security
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY; 