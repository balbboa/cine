-- Add this at the beginning of the file to ensure the schema is properly set up

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Make sure the auth schema exists
CREATE SCHEMA IF NOT EXISTS auth;

-- Ensure RLS is enabled on the database
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';
ALTER DATABASE postgres SET "app.jwt_exp" TO 3600;

-- This is the expected schema for the Supabase database

-- Users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  xp_to_next_level INTEGER NOT NULL DEFAULT 100,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  credits INTEGER NOT NULL DEFAULT 500,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own data" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own data" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Add this policy to allow anyone to insert into the users table
-- This is critical for the signup process to work
DROP POLICY IF EXISTS "Anyone can insert their own user data" ON public.users;
CREATE POLICY "Anyone can insert their own user data" ON public.users
  FOR INSERT WITH CHECK (true);

-- Add this policy to allow anyone to select from the users table
-- This helps with checking if a username/email already exists
DROP POLICY IF EXISTS "Anyone can view user data" ON public.users;
CREATE POLICY "Anyone can view user data" ON public.users
  FOR SELECT USING (true);

-- Create public profiles view for leaderboards
CREATE VIEW public.profiles AS
  SELECT id, username, avatar_url, level, xp, wins, losses
  FROM public.users;

-- Create policy for public profiles
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

-- Badges table
CREATE TABLE IF NOT EXISTS public.badges (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- User badges table
CREATE TABLE IF NOT EXISTS public.user_badges (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  badge_id INTEGER NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

-- Store items table
CREATE TABLE IF NOT EXISTS public.store_items (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('board', 'symbol', 'booster')),
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Games table
CREATE TABLE IF NOT EXISTS public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  player2_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  winner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  game_mode TEXT NOT NULL CHECK (game_mode IN ('quick', 'ranked', 'custom')),
  invite_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Game moves table
CREATE TABLE IF NOT EXISTS public.game_moves (
  id SERIAL PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  row INTEGER NOT NULL,
  col INTEGER NOT NULL,
  movie TEXT NOT NULL,
  time_to_answer INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Clubs table
CREATE TABLE IF NOT EXISTS public.clubs (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  member_count INTEGER NOT NULL DEFAULT 0
);

-- Club members table
CREATE TABLE IF NOT EXISTS public.club_members (
  id SERIAL PRIMARY KEY,
  club_id INTEGER NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(club_id, user_id)
);

-- Friendships table
CREATE TABLE IF NOT EXISTS public.friendships (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, friend_id),
  CHECK (user_id != friend_id)
);

-- Increment function for updating stats
CREATE OR REPLACE FUNCTION increment(x INTEGER) RETURNS INTEGER AS $$
BEGIN
  RETURN x + 1;
END;
$$ LANGUAGE plpgsql;

