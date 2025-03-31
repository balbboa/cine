-- Migration: fix_duplicate_policies
-- Created at: 2024-05-15T00:20:00.000Z

-- Up Migration
-- This migration safely drops and recreates policies to avoid duplicates

-- Function to check if a policy exists
CREATE OR REPLACE FUNCTION policy_exists(policy_name text, table_name text) RETURNS boolean AS $$
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

-- Function to check if a table exists
CREATE OR REPLACE FUNCTION table_exists(schema_name text, tbl_name text) RETURNS boolean AS $$
DECLARE
  table_count integer;
BEGIN
  SELECT COUNT(*) INTO table_count 
  FROM information_schema.tables 
  WHERE table_schema = schema_name
  AND table_name = tbl_name;
  
  RETURN table_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Drop existing policies if they exist
DO $$ 
BEGIN
  -- Users table policies
  IF (SELECT table_exists('public', 'users')) THEN
    IF (SELECT policy_exists('Users can view their own profiles', 'users')) THEN
      DROP POLICY "Users can view their own profiles" ON public.users;
    END IF;
    
    IF (SELECT policy_exists('Users can update their own profiles', 'users')) THEN
      DROP POLICY "Users can update their own profiles" ON public.users;
    END IF;
    
    IF (SELECT policy_exists('Anyone can view basic user info', 'users')) THEN
      DROP POLICY "Anyone can view basic user info" ON public.users;
    END IF;
    
    IF (SELECT policy_exists('Users can insert their own profile once', 'users')) THEN
      DROP POLICY "Users can insert their own profile once" ON public.users;
    END IF;
  END IF;
  
  -- Games table policies
  IF (SELECT table_exists('public', 'games')) THEN
    IF (SELECT policy_exists('Anyone can view games', 'games')) THEN
      DROP POLICY "Anyone can view games" ON public.games;
    END IF;
    
    IF (SELECT policy_exists('Users can create games', 'games')) THEN
      DROP POLICY "Users can create games" ON public.games;
    END IF;
    
    IF (SELECT policy_exists('Game players can update games', 'games')) THEN
      DROP POLICY "Game players can update games" ON public.games;
    END IF;
  END IF;
  
  -- Game moves policies
  IF (SELECT table_exists('public', 'game_moves')) THEN
    IF (SELECT policy_exists('Anyone can view game moves', 'game_moves')) THEN
      DROP POLICY "Anyone can view game moves" ON public.game_moves;
    END IF;
    
    IF (SELECT policy_exists('Players can insert their moves', 'game_moves')) THEN
      DROP POLICY "Players can insert their moves" ON public.game_moves;
    END IF;
  END IF;
  
  -- Badges policies
  IF (SELECT table_exists('public', 'badges')) THEN
    IF (SELECT policy_exists('Anyone can view badges', 'badges')) THEN
      DROP POLICY "Anyone can view badges" ON public.badges;
    END IF;
  END IF;
  
  -- Other policies can be added here as needed
END $$;

-- Recreate the policies
-- Users table policies
DO $$
BEGIN
  IF (SELECT table_exists('public', 'users')) THEN
    CREATE POLICY "Users can view their own profiles" ON public.users
    FOR SELECT TO authenticated USING (auth.uid() = id);
    
    CREATE POLICY "Users can update their own profiles" ON public.users
    FOR UPDATE TO authenticated USING (auth.uid() = id);
    
    CREATE POLICY "Anyone can view basic user info" ON public.users
    FOR SELECT TO anon, authenticated USING (true);
    
    CREATE POLICY "Users can insert their own profile once" ON public.users
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- Games table policies
DO $$
BEGIN
  IF (SELECT table_exists('public', 'games')) THEN
    CREATE POLICY "Anyone can view games" ON public.games
    FOR SELECT TO anon, authenticated USING (true);
    
    CREATE POLICY "Users can create games" ON public.games
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = player1_id);
    
    CREATE POLICY "Game players can update games" ON public.games
    FOR UPDATE TO authenticated USING (
      auth.uid() = player1_id OR auth.uid() = player2_id
    );
  END IF;
END $$;

-- Game moves policies
DO $$
BEGIN
  IF (SELECT table_exists('public', 'game_moves')) THEN
    CREATE POLICY "Anyone can view game moves" ON public.game_moves
    FOR SELECT TO anon, authenticated USING (true);
    
    CREATE POLICY "Players can insert their moves" ON public.game_moves
    FOR INSERT TO authenticated WITH CHECK (
      auth.uid() = user_id AND
      EXISTS (
        SELECT 1 FROM public.games 
        WHERE id = game_id AND (player1_id = auth.uid() OR player2_id = auth.uid())
      )
    );
  END IF;
END $$;

-- Badges policies
DO $$
BEGIN
  IF (SELECT table_exists('public', 'badges')) THEN
    CREATE POLICY "Anyone can view badges" ON public.badges
    FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

-- Clean up the helper functions
DROP FUNCTION IF EXISTS policy_exists(text, text);
DROP FUNCTION IF EXISTS table_exists(text, text);

-- Down Migration
-- No down migration needed as we're just fixing conflicts 