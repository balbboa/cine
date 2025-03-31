-- Migration: create_migrations_table
-- Created at: 2024-05-15T00:50:00.000Z

-- Up Migration
-- This migration creates the migrations table itself

-- Create migrations table
CREATE TABLE IF NOT EXISTS public.migrations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS on the migrations table
ALTER TABLE public.migrations ENABLE ROW LEVEL SECURITY;

-- Create policies for the migrations table
DO $$
BEGIN
  -- Check if the policy already exists before creating it
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'migrations' 
    AND policyname = 'Migrations are viewable by everyone'
  ) THEN
    CREATE POLICY "Migrations are viewable by everyone" 
    ON public.migrations FOR SELECT USING (true);
  END IF;
  
  -- Check if the insert policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'migrations' 
    AND policyname = 'Service role can insert migrations'
  ) THEN
    CREATE POLICY "Service role can insert migrations" 
    ON public.migrations FOR INSERT WITH CHECK (true);
  END IF;
END$$;

-- Create helper function for migrations
CREATE OR REPLACE FUNCTION create_migrations_table_if_not_exists()
RETURNS void AS $$
BEGIN
  -- This function exists simply to check if the migrations infrastructure is set up
  -- The actual table creation is done in the initial migration
END;
$$ LANGUAGE plpgsql;

-- Down Migration
-- DROP FUNCTION IF EXISTS create_migrations_table_if_not_exists();
-- DROP TABLE IF EXISTS public.migrations;

-- First, drop all existing policies
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

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tables
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  xp_to_next_level INTEGER NOT NULL DEFAULT 100,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  credits INTEGER NOT NULL DEFAULT 100,
  online_status TEXT DEFAULT 'offline',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);
COMMENT ON TABLE public.users IS 'User profiles for application users.';

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

-- Create games table
CREATE TABLE IF NOT EXISTS public.games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player1_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  player2_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  winner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  player1_guest_id UUID REFERENCES public.guest_users(id) ON DELETE SET NULL,
  player2_guest_id UUID REFERENCES public.guest_users(id) ON DELETE SET NULL,
  game_mode TEXT NOT NULL DEFAULT 'casual',
  status TEXT NOT NULL DEFAULT 'waiting',
  invite_code TEXT UNIQUE,
  board_state JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE
);
COMMENT ON TABLE public.games IS 'Game records for matches played.';

-- Create game_moves table
CREATE TABLE IF NOT EXISTS public.game_moves (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  guest_user_id UUID REFERENCES public.guest_users(id) ON DELETE SET NULL,
  row INTEGER NOT NULL,
  col INTEGER NOT NULL,
  movie TEXT NOT NULL,
  time_to_answer INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);
COMMENT ON TABLE public.game_moves IS 'Record of moves made in games.';

-- Create badges table
CREATE TABLE IF NOT EXISTS public.badges (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);
COMMENT ON TABLE public.badges IS 'Achievement badges that users can earn.';

-- Create user_badges junction table
CREATE TABLE IF NOT EXISTS public.user_badges (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  badge_id BIGINT NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(user_id, badge_id)
);
COMMENT ON TABLE public.user_badges IS 'Junction table for users and their earned badges.';

-- Create store_items table
CREATE TABLE IF NOT EXISTS public.store_items (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  price INTEGER NOT NULL,
  type TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);
COMMENT ON TABLE public.store_items IS 'Items available for purchase in the store.';

-- Create user_inventory junction table
CREATE TABLE IF NOT EXISTS public.user_inventory (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  item_id BIGINT NOT NULL REFERENCES public.store_items(id) ON DELETE CASCADE,
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  equipped BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(user_id, item_id)
);
COMMENT ON TABLE public.user_inventory IS 'Junction table for users and their purchased items.';

-- Create clubs table
CREATE TABLE IF NOT EXISTS public.clubs (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  member_count INTEGER NOT NULL DEFAULT 0
);
COMMENT ON TABLE public.clubs IS 'Movie clubs that users can join.';

-- Create club_members junction table
CREATE TABLE IF NOT EXISTS public.club_members (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  club_id BIGINT NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(club_id, user_id)
);
COMMENT ON TABLE public.club_members IS 'Junction table for clubs and their members.';

-- Create friendships table
CREATE TABLE IF NOT EXISTS public.friendships (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(user_id, friend_id),
  CONSTRAINT different_users CHECK (user_id != friend_id)
);
COMMENT ON TABLE public.friendships IS 'Friendships between users.';

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY; 
ALTER TABLE public.guest_users ENABLE ROW LEVEL SECURITY;

-- Users table policies
DO $$
BEGIN
  -- Users table policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' 
    AND policyname = 'Users can view their own profiles'
  ) THEN
    CREATE POLICY "Users can view their own profiles" ON public.users
    FOR SELECT TO authenticated USING (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' 
    AND policyname = 'Users can update their own profiles'
  ) THEN
    CREATE POLICY "Users can update their own profiles" ON public.users
    FOR UPDATE TO authenticated USING (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' 
    AND policyname = 'Anyone can view basic user info'
  ) THEN
    CREATE POLICY "Anyone can view basic user info" ON public.users
    FOR SELECT TO anon, authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' 
    AND policyname = 'Users can insert their own profile once'
  ) THEN
    CREATE POLICY "Users can insert their own profile once" ON public.users
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
  END IF;

  -- Guest users policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'guest_users' 
    AND policyname = 'Guest users are readable by anyone'
  ) THEN
    CREATE POLICY "Guest users are readable by anyone" ON public.guest_users
    FOR SELECT TO anon, authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'guest_users' 
    AND policyname = 'Guest users can be created by anyone'
  ) THEN
    CREATE POLICY "Guest users can be created by anyone" ON public.guest_users
    FOR INSERT TO anon, authenticated WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'guest_users' 
    AND policyname = 'Guest users can be updated by anyone'
  ) THEN
    CREATE POLICY "Guest users can be updated by anyone" ON public.guest_users
    FOR UPDATE TO anon, authenticated USING (true);
  END IF;

  -- Games table policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'games' 
    AND policyname = 'Anyone can view games'
  ) THEN
    CREATE POLICY "Anyone can view games" ON public.games
    FOR SELECT TO anon, authenticated USING (true);
  END IF;
END$$;

-- Continue with policies for games, game_moves, etc.
DO $$
BEGIN
  -- Games table policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'games' 
    AND policyname = 'Anyone can create games'
  ) THEN
    CREATE POLICY "Anyone can create games" ON public.games
    FOR INSERT TO anon, authenticated WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'game_moves' 
    AND policyname = 'Anyone can view game moves'
  ) THEN
    CREATE POLICY "Anyone can view game moves" ON public.game_moves
    FOR SELECT TO anon, authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'badges' 
    AND policyname = 'Anyone can view badges'
  ) THEN
    CREATE POLICY "Anyone can view badges" ON public.badges
    FOR SELECT TO anon, authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_badges' 
    AND policyname = 'Anyone can view user badges'
  ) THEN
    CREATE POLICY "Anyone can view user badges" ON public.user_badges
    FOR SELECT TO anon, authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'store_items' 
    AND policyname = 'Anyone can view store items'
  ) THEN
    CREATE POLICY "Anyone can view store items" ON public.store_items
    FOR SELECT TO anon, authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_inventory' 
    AND policyname = 'Users can view their inventory'
  ) THEN
    CREATE POLICY "Users can view their inventory" ON public.user_inventory
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_inventory' 
    AND policyname = 'Users can update their inventory'
  ) THEN
    CREATE POLICY "Users can update their inventory" ON public.user_inventory
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_inventory' 
    AND policyname = 'Users can add to their inventory'
  ) THEN
    CREATE POLICY "Users can add to their inventory" ON public.user_inventory
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Insert additional policies here for clubs, club_members, friendships, etc.
END$$;

-- Continue with additional missing policies 
DO $$
BEGIN
  -- Games update policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'games' 
    AND policyname = 'Anyone can update games'
  ) THEN
    CREATE POLICY "Anyone can update games" ON public.games
    FOR UPDATE TO anon, authenticated USING (true);
  END IF;

  -- Game moves insert policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'game_moves' 
    AND policyname = 'Anyone can record moves'
  ) THEN
    CREATE POLICY "Anyone can record moves" ON public.game_moves
    FOR INSERT TO anon, authenticated WITH CHECK (true);
  END IF;

  -- User badges additional policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_badges' 
    AND policyname = 'Users can see their badges'
  ) THEN
    CREATE POLICY "Users can see their badges" ON public.user_badges
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;

  -- Club policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'clubs' 
    AND policyname = 'Anyone can view clubs'
  ) THEN
    CREATE POLICY "Anyone can view clubs" ON public.clubs
    FOR SELECT TO anon, authenticated USING (true);
  END IF;

  -- Club members policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'club_members' 
    AND policyname = 'Anyone can view club members'
  ) THEN
    CREATE POLICY "Anyone can view club members" ON public.club_members
    FOR SELECT TO anon, authenticated USING (true);
  END IF;

  -- Friendships policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'friendships' 
    AND policyname = 'Users can view their friendships'
  ) THEN
    CREATE POLICY "Users can view their friendships" ON public.friendships
    FOR SELECT TO authenticated USING (auth.uid() = user_id OR auth.uid() = friend_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'friendships' 
    AND policyname = 'Users can create friendships'
  ) THEN
    CREATE POLICY "Users can create friendships" ON public.friendships
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

-- Create function to create a guest user
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

-- Mark all migrations as applied only if they don't exist
DO $$
DECLARE
  migration_files TEXT[] := ARRAY[
    'setup.sql',
    '20240515000000_add_existing_user.sql',
    '20240515001000_fix_duplicate_badges.sql',
    '20240515002000_fix_duplicate_policies.sql',
    '20240515003000_drop_duplicate_policies.sql',
    '20240515004000_recreate_policies.sql',
    '20240515005000_create_migrations_table.sql'
  ];
  migration TEXT;
BEGIN
  FOREACH migration IN ARRAY migration_files
  LOOP
    -- Only insert if the migration doesn't already exist
    IF NOT EXISTS (SELECT 1 FROM public.migrations WHERE name = migration) THEN
      INSERT INTO public.migrations (name) VALUES (migration);
    END IF;
  END LOOP;
END $$; 