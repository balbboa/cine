-- Add support for guest users in the database
-- This migration will add a guest_users table and modify existing policies

-- Function to check if a policy exists
CREATE OR REPLACE FUNCTION guest_policy_exists(policy_name text, table_name text) RETURNS boolean AS $$
DECLARE
  policy_count integer;
BEGIN
  SELECT COUNT(*) INTO policy_count 
  FROM pg_policies 
  WHERE policyname = policy_name 
  AND tablename = table_name;
  
  RETURN policy_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Check if guest_users table already exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables 
                 WHERE table_schema = 'public' 
                 AND table_name = 'guest_users') THEN
    -- Create guest_users table
    CREATE TABLE IF NOT EXISTS public.guest_users (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      username TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
      last_active TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
      xp INTEGER NOT NULL DEFAULT 0,
      wins INTEGER NOT NULL DEFAULT 0,
      losses INTEGER NOT NULL DEFAULT 0
    );
    COMMENT ON TABLE public.guest_users IS 'Temporary guest users for quick matches';
    
    -- Enable Row Level Security on guest_users table
    ALTER TABLE public.guest_users ENABLE ROW LEVEL SECURITY;
    
    -- Create RLS policies for guest_users
    CREATE POLICY "Guest users are readable by anyone" ON public.guest_users
    FOR SELECT TO anon, authenticated
    USING (true);
    
    CREATE POLICY "Guest users can be created by anyone" ON public.guest_users
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);
    
    CREATE POLICY "Guest users can be updated by anyone" ON public.guest_users
    FOR UPDATE TO anon, authenticated
    USING (true);
  END IF;
END
$$;

-- Check if games table exists before adding columns
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables 
             WHERE table_schema = 'public' 
             AND table_name = 'games') THEN
    -- Add columns to games table if they don't exist
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'games' 
                   AND column_name = 'player1_guest_id') THEN
      -- Modify games table to support guest users
      ALTER TABLE public.games ADD COLUMN player1_guest_id UUID REFERENCES public.guest_users(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'games' 
                   AND column_name = 'player2_guest_id') THEN
      ALTER TABLE public.games ADD COLUMN player2_guest_id UUID REFERENCES public.guest_users(id) ON DELETE SET NULL;
    END IF;
  END IF;
END
$$;

-- Check if game_moves table exists before adding columns
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables 
             WHERE table_schema = 'public' 
             AND table_name = 'game_moves') THEN
    -- Add column to game_moves table if it doesn't exist
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'game_moves' 
                   AND column_name = 'guest_user_id') THEN
      -- Modify game_moves table to support guest users
      ALTER TABLE public.game_moves ADD COLUMN guest_user_id UUID REFERENCES public.guest_users(id) ON DELETE SET NULL;
    END IF;
  END IF;
END
$$;

-- Create function to create a guest user (if it doesn't already exist)
CREATE OR REPLACE FUNCTION create_guest_user(username TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  guest_id UUID;
BEGIN
  INSERT INTO public.guest_users (username)
  VALUES (username)
  RETURNING id INTO guest_id;
  
  RETURN guest_id;
END;
$$;

-- Update game RLS policies to support guest users
-- Only drop and create policies if games table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables 
             WHERE table_schema = 'public' 
             AND table_name = 'games') THEN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Anyone can view games" ON public.games;
    DROP POLICY IF EXISTS "Users can create games" ON public.games;
    DROP POLICY IF EXISTS "Game players can update games" ON public.games;
    
    -- Create new policies only if they don't already exist
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view games' AND tablename = 'games') THEN
      CREATE POLICY "Anyone can view games" ON public.games
      FOR SELECT TO anon, authenticated
      USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can create games' AND tablename = 'games') THEN
      CREATE POLICY "Anyone can create games" ON public.games
      FOR INSERT TO anon, authenticated
      WITH CHECK (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can update games' AND tablename = 'games') THEN
      CREATE POLICY "Anyone can update games" ON public.games
      FOR UPDATE TO anon, authenticated
      USING (true);
    END IF;
  END IF;
END
$$;

-- Update game_moves RLS policies if table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables 
             WHERE table_schema = 'public' 
             AND table_name = 'game_moves') THEN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Anyone can view game moves" ON public.game_moves;
    DROP POLICY IF EXISTS "Players can insert their moves" ON public.game_moves;
    DROP POLICY IF EXISTS "Users can record their moves" ON public.game_moves;
    
    -- Create new policies only if they don't already exist
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view game moves' AND tablename = 'game_moves') THEN
      CREATE POLICY "Anyone can view game moves" ON public.game_moves
      FOR SELECT TO anon, authenticated
      USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can record moves' AND tablename = 'game_moves') THEN
      CREATE POLICY "Anyone can record moves" ON public.game_moves
      FOR INSERT TO anon, authenticated
      WITH CHECK (true);
    END IF;
  END IF;
END
$$;

-- Modify the create_game function to support guest users
CREATE OR REPLACE FUNCTION public.create_game_with_guest(
  p_guest_id UUID,
  p_username TEXT,
  p_game_mode TEXT DEFAULT 'quick'
) 
RETURNS TABLE(game_id UUID, invite_code TEXT, guest_id UUID) 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_game_id UUID;
  v_invite_code TEXT;
  v_guest_id UUID;
BEGIN
  -- Use existing guest ID or create a new one
  IF p_guest_id IS NULL THEN
    -- Create a new guest user
    INSERT INTO public.guest_users (username)
    VALUES (p_username)
    RETURNING id INTO v_guest_id;
  ELSE
    v_guest_id := p_guest_id;
  END IF;
  
  -- Generate invite code
  v_invite_code = UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
  
  -- Create game with guest player
  INSERT INTO public.games (
    player1_guest_id, 
    game_mode, 
    invite_code, 
    status
  )
  VALUES (
    v_guest_id,
    p_game_mode,
    v_invite_code,
    'waiting'
  )
  RETURNING id INTO v_game_id;
  
  -- Return game ID, invite code and guest ID
  RETURN QUERY SELECT v_game_id, v_invite_code, v_guest_id;
END;
$$;

-- Add function to join a game as a guest
CREATE OR REPLACE FUNCTION public.join_game_as_guest(
  p_invite_code TEXT,
  p_guest_id UUID,
  p_username TEXT
)
RETURNS TABLE(game_id UUID, guest_id UUID)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_game_id UUID;
  v_guest_id UUID;
BEGIN
  -- Use existing guest ID or create a new one
  IF p_guest_id IS NULL THEN
    -- Create a new guest user
    INSERT INTO public.guest_users (username)
    VALUES (p_username)
    RETURNING id INTO v_guest_id;
  ELSE
    v_guest_id := p_guest_id;
  END IF;
  
  -- Find game with invite code
  SELECT id INTO v_game_id
  FROM public.games
  WHERE invite_code = p_invite_code
  AND player2_id IS NULL
  AND player2_guest_id IS NULL
  AND status = 'waiting';
  
  -- If game found, join it
  IF v_game_id IS NOT NULL THEN
    UPDATE public.games
    SET player2_guest_id = v_guest_id,
        status = 'active'
    WHERE id = v_game_id;
    
    RETURN QUERY SELECT v_game_id, v_guest_id;
  ELSE
    RETURN;
  END IF;
END;
$$;

-- Clean up the helper function
DROP FUNCTION IF EXISTS guest_policy_exists(text, text); 