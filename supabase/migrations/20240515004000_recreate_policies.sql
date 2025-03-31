-- Migration: recreate_policies
-- Created at: 2024-05-15T00:40:00.000Z

-- Up Migration
-- This migration recreates all the necessary policies after they've been dropped

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

-- User badges policies
DO $$
BEGIN
  IF (SELECT table_exists('public', 'user_badges')) THEN
    CREATE POLICY "Anyone can view user badges" ON public.user_badges
    FOR SELECT TO anon, authenticated USING (true);
    
    CREATE POLICY "Users can see their badges" ON public.user_badges
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

-- Store items policies
DO $$
BEGIN
  IF (SELECT table_exists('public', 'store_items')) THEN
    CREATE POLICY "Anyone can view store items" ON public.store_items
    FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

-- User inventory policies
DO $$
BEGIN
  IF (SELECT table_exists('public', 'user_inventory')) THEN
    CREATE POLICY "Users can view their inventory" ON public.user_inventory
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
    
    CREATE POLICY "Users can update their inventory" ON public.user_inventory
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);
    
    CREATE POLICY "Users can add to their inventory" ON public.user_inventory
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Clubs policies
DO $$
BEGIN
  IF (SELECT table_exists('public', 'clubs')) THEN
    CREATE POLICY "Anyone can view clubs" ON public.clubs
    FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

-- Club members policies
DO $$
BEGIN
  IF (SELECT table_exists('public', 'club_members')) THEN
    CREATE POLICY "Anyone can view club members" ON public.club_members
    FOR SELECT TO anon, authenticated USING (true);
    
    CREATE POLICY "Users can join clubs" ON public.club_members
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
    
    CREATE POLICY "Users can leave clubs" ON public.club_members
    FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

-- Friendships policies
DO $$
BEGIN
  IF (SELECT table_exists('public', 'friendships')) THEN
    CREATE POLICY "Users can view their friendships" ON public.friendships
    FOR SELECT TO authenticated USING (auth.uid() = user_id OR auth.uid() = friend_id);
    
    CREATE POLICY "Users can add friends" ON public.friendships
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
    
    CREATE POLICY "Users can end friendships" ON public.friendships
    FOR DELETE TO authenticated USING (auth.uid() = user_id OR auth.uid() = friend_id);
  END IF;
END $$;

-- Migrations policies
DO $$
BEGIN
  IF (SELECT table_exists('public', 'migrations')) THEN
    CREATE POLICY "Migrations are viewable by everyone" 
      ON public.migrations FOR SELECT USING (true);
    
    CREATE POLICY "Service role can insert migrations" 
      ON public.migrations FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- Clean up the helper function
DROP FUNCTION IF EXISTS table_exists(text, text); 