-- Reset schema if needed (be careful with this in production)
-- COMMENT OUT AFTER FIRST RUN
-- DROP SCHEMA public CASCADE;
-- CREATE SCHEMA public;

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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  location TEXT
);
COMMENT ON TABLE public.users IS 'User profiles for application users.';

-- Create games table
CREATE TABLE IF NOT EXISTS public.games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player1_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  player2_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  winner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
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

-- Create some sample data
INSERT INTO public.badges (name, icon, description) VALUES
('First Win', 'trophy', 'Win your first game'),
('Movie Buff', 'film', 'Play 10 games'),
('Cinephile', 'star', 'Correctly name 50 movies'),
('Quick Draw', 'clock', 'Answer correctly in under 5 seconds'),
('Winning Streak', 'award', 'Win 5 games in a row')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.store_items (name, description, price, type, image_url) VALUES
('Gold Frame', 'A luxurious gold frame for your profile', 500, 'frame', '/items/gold-frame.png'),
('Silver Frame', 'A sleek silver frame for your profile', 300, 'frame', '/items/silver-frame.png'),
('Movie Director', 'Show everyone you''re a movie director', 800, 'title', NULL),
('Film Critic', 'Let others know you have taste', 700, 'title', NULL),
('Red Theme', 'Change your profile theme to red', 200, 'theme', NULL)
ON CONFLICT (name) DO NOTHING;

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

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

-- Clear migrations table if it exists
TRUNCATE public.migrations;

-- Now recreate the policies one by one

-- Users table policies
CREATE POLICY "Users can view their own profiles" ON public.users
FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can update their own profiles" ON public.users
FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Anyone can view basic user info" ON public.users
FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Users can insert their own profile once" ON public.users
FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Games table policies
CREATE POLICY "Anyone can view games" ON public.games
FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Users can create games" ON public.games
FOR INSERT TO authenticated WITH CHECK (auth.uid() = player1_id);

CREATE POLICY "Game players can update games" ON public.games
FOR UPDATE TO authenticated USING (
  auth.uid() = player1_id OR auth.uid() = player2_id
);

-- Game moves policies
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

-- Badges policies
CREATE POLICY "Anyone can view badges" ON public.badges
FOR SELECT TO anon, authenticated USING (true);

-- User badges policies
CREATE POLICY "Anyone can view user badges" ON public.user_badges
FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Users can see their badges" ON public.user_badges
FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Store items policies
CREATE POLICY "Anyone can view store items" ON public.store_items
FOR SELECT TO anon, authenticated USING (true);

-- Clubs policies
CREATE POLICY "Anyone can view clubs" ON public.clubs
FOR SELECT TO anon, authenticated USING (true);

-- Club members policies
CREATE POLICY "Anyone can view club members" ON public.club_members
FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Users can join clubs" ON public.club_members
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave clubs" ON public.club_members
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Friendships policies
CREATE POLICY "Users can view their friendships" ON public.friendships
FOR SELECT TO authenticated USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can add friends" ON public.friendships
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can end friendships" ON public.friendships
FOR DELETE TO authenticated USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Migrations policies
CREATE POLICY "Migrations are viewable by everyone" 
  ON public.migrations FOR SELECT USING (true);

CREATE POLICY "Service role can insert migrations" 
  ON public.migrations FOR INSERT WITH CHECK (true);

-- Create migrations table
CREATE TABLE IF NOT EXISTS public.migrations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS on the migrations table
ALTER TABLE public.migrations ENABLE ROW LEVEL SECURITY;

-- Create policies for the migrations table
CREATE POLICY "Migrations are viewable by everyone" 
  ON public.migrations FOR SELECT USING (true);

CREATE POLICY "Service role can insert migrations" 
  ON public.migrations FOR INSERT WITH CHECK (true);

-- Create helper function for migrations
CREATE OR REPLACE FUNCTION create_migrations_table_if_not_exists()
RETURNS void AS $$
BEGIN
  -- This function exists simply to check if the migrations infrastructure is set up
END;
$$ LANGUAGE plpgsql;

-- Mark all migrations as applied
INSERT INTO public.migrations (name) VALUES 
('setup.sql'),
('20240515000000_add_existing_user.sql'),
('20240515001000_fix_duplicate_badges.sql'),
('20240515002000_fix_duplicate_policies.sql'),
('20240515003000_drop_duplicate_policies.sql'),
('20240515004000_recreate_policies.sql');

-- Make sure our existing user is added
INSERT INTO public.users (
  id, 
  username, 
  email, 
  level, 
  xp, 
  xp_to_next_level, 
  wins, 
  losses, 
  credits, 
  online_status, 
  created_at
)
VALUES (
  '82962cd0-ec86-4142-a377-820d9b64a701', 
  'user_82962cd0',
  'user@example.com',
  1,
  0,
  100,
  0,
  0,
  100,
  'offline',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Functions for user management
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, username, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)), NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Function to update user XP
CREATE OR REPLACE FUNCTION public.update_user_xp(user_id_param UUID, xp_to_add INTEGER)
RETURNS VOID AS $$
DECLARE
  current_user_data RECORD;
  new_xp INTEGER;
  new_level INTEGER;
  new_xp_to_next_level INTEGER;
BEGIN
  -- Get current user data
  SELECT xp, level, xp_to_next_level INTO current_user_data 
  FROM public.users WHERE id = user_id_param;
  
  -- Calculate new XP and check for level up
  new_xp := current_user_data.xp + xp_to_add;
  new_level := current_user_data.level;
  new_xp_to_next_level := current_user_data.xp_to_next_level;
  
  -- Check if user should level up
  WHILE new_xp >= new_xp_to_next_level LOOP
    new_xp := new_xp - new_xp_to_next_level;
    new_level := new_level + 1;
    new_xp_to_next_level := new_xp_to_next_level * 1.5::INTEGER;
  END LOOP;
  
  -- Update user
  UPDATE public.users 
  SET 
    xp = new_xp,
    level = new_level,
    xp_to_next_level = new_xp_to_next_level
  WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger function to update games when a move is made
CREATE OR REPLACE FUNCTION public.handle_game_move()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the board state (simplified representation)
  UPDATE public.games
  SET board_state = jsonb_set(
    COALESCE(board_state, '{}'::jsonb),
    ARRAY[NEW.row::text, NEW.col::text],
    to_jsonb(jsonb_build_object('user_id', NEW.user_id, 'movie', NEW.movie))
  )
  WHERE id = NEW.game_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for game moves
CREATE TRIGGER on_game_move_inserted
  AFTER INSERT ON public.game_moves
  FOR EACH ROW EXECUTE PROCEDURE public.handle_game_move();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_games_player1 ON public.games(player1_id);
CREATE INDEX IF NOT EXISTS idx_games_player2 ON public.games(player2_id);
CREATE INDEX IF NOT EXISTS idx_game_moves_game ON public.game_moves(game_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON public.user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_club_members_club ON public.club_members(club_id);
CREATE INDEX IF NOT EXISTS idx_club_members_user ON public.club_members(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_user ON public.friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend ON public.friendships(friend_id); 