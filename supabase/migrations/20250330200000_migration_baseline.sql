-- Migration: Establish baseline for future migrations
-- Created at: 2025-03-30T20:00:00.000Z
-- Description: Fixes migration history and sets baseline for future migrations

-- Skip this entire migration if it has already been run
-- This prevents duplicate key errors in schema_migrations
DO $$
BEGIN
  -- Check if this migration is already tracked
  IF EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations 
    WHERE name = '20250330200000_migration_baseline.sql'
  ) THEN
    -- If it exists, raise notice and exit the block
    RAISE NOTICE 'Migration 20250330200000_migration_baseline.sql has already been applied. Skipping.';
    RETURN;
  END IF;
END $$;

-- Create migration tracking schema and table only if they don't exist
DO $$
BEGIN
  -- Create schema if it doesn't exist
  CREATE SCHEMA IF NOT EXISTS supabase_migrations;
  
  -- Create migrations table if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
  ) THEN
    CREATE TABLE supabase_migrations.schema_migrations (
      version text PRIMARY KEY,
      statements text[],
      name text
    );
  END IF;
END $$;

-- We'll skip adding entries to schema_migrations in this migration
-- because the migration system will handle that automatically

-- Ensure game_invites table has the correct structure and relationships
DO $$
BEGIN
  -- Make sure game_invites table exists
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'game_invites'
  ) THEN
    -- Create game_invites table if it doesn't exist
    CREATE TABLE public.game_invites (
      id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      game_id UUID REFERENCES public.games(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
      UNIQUE(sender_id, receiver_id, game_id),
      CONSTRAINT different_users CHECK (sender_id != receiver_id)
    );

    COMMENT ON TABLE public.game_invites IS 'Game invitations between friends';
    
    -- Enable Row Level Security
    ALTER TABLE public.game_invites ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Fix foreign key references if they don't exist
DO $$
BEGIN
  -- Check if foreign key constraints exist for game_invites
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'game_invites'
  ) AND NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'game_invites'
    AND ccu.table_name = 'users'
    AND tc.table_schema = 'public'
    AND ccu.column_name = 'id'
    AND tc.constraint_name LIKE '%sender%'
  ) THEN
    -- Add the missing foreign key constraints
    ALTER TABLE public.game_invites 
    ADD CONSTRAINT game_invites_sender_id_fkey 
    FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
  
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'game_invites'
  ) AND NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'game_invites'
    AND ccu.table_name = 'users'
    AND tc.table_schema = 'public'
    AND ccu.column_name = 'id'
    AND tc.constraint_name LIKE '%receiver%'
  ) THEN
    ALTER TABLE public.game_invites 
    ADD CONSTRAINT game_invites_receiver_id_fkey 
    FOREIGN KEY (receiver_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
  
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'game_invites'
  ) AND NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'game_invites'
    AND ccu.table_name = 'games'
    AND tc.table_schema = 'public'
  ) THEN
    ALTER TABLE public.game_invites 
    ADD CONSTRAINT game_invites_game_id_fkey 
    FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create or update RLS policies using safe pattern that avoids errors
DO $$
BEGIN
  -- SELECT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'game_invites' 
    AND policyname = 'Users can view game invites they are involved with'
  ) THEN
    CREATE POLICY "Users can view game invites they are involved with" ON public.game_invites
    FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
  END IF;

  -- INSERT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'game_invites' 
    AND policyname = 'Users can create game invites'
  ) THEN
    CREATE POLICY "Users can create game invites" ON public.game_invites
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
  END IF;

  -- UPDATE policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'game_invites' 
    AND policyname = 'Users can update game invites they received'
  ) THEN
    CREATE POLICY "Users can update game invites they received" ON public.game_invites
    FOR UPDATE TO authenticated USING (auth.uid() = receiver_id);
  END IF;

  -- DELETE policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'game_invites' 
    AND policyname = 'Users can delete game invites they created'
  ) THEN
    CREATE POLICY "Users can delete game invites they created" ON public.game_invites
    FOR DELETE TO authenticated USING (auth.uid() = sender_id);
  END IF;
END $$;

-- Create helper functions for game invites
CREATE OR REPLACE FUNCTION public.send_game_invite(
  sender_id_param UUID,
  receiver_id_param UUID,
  game_id_param UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  existing_invite RECORD;
  is_friend BOOLEAN;
  result JSONB;
BEGIN
  -- Check if they are friends
  SELECT EXISTS(
    SELECT 1 FROM public.friendships 
    WHERE (user_id = sender_id_param AND friend_id = receiver_id_param) 
       OR (user_id = receiver_id_param AND friend_id = sender_id_param)
  ) INTO is_friend;
  
  IF NOT is_friend THEN
    RETURN jsonb_build_object('success', false, 'message', 'You can only invite friends to games');
  END IF;
  
  -- Check if there's already a pending invite
  SELECT * INTO existing_invite FROM public.game_invites 
  WHERE sender_id = sender_id_param 
    AND receiver_id = receiver_id_param 
    AND game_id = game_id_param
    AND status = 'pending'
  LIMIT 1;
  
  IF existing_invite IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'A game invite already exists');
  END IF;
  
  -- Create game invite
  INSERT INTO public.game_invites (sender_id, receiver_id, game_id)
  VALUES (sender_id_param, receiver_id_param, game_id_param);
  
  RETURN jsonb_build_object('success', true, 'message', 'Game invite sent');
END;
$$;

-- Create or update timestamps trigger
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger safely
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'game_invites'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'set_timestamp' 
    AND tgrelid = 'public.game_invites'::regclass
  ) THEN
    CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON public.game_invites
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_timestamp();
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    NULL;
END $$;

-- Force reload of schema cache to make all changes visible immediately
SELECT pg_notify('pgrst', 'reload schema'); 