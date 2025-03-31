-- Migration: Fix game_invites relationships
-- Created at: 2025-03-30T19:03:47.000Z
-- Description: Adds proper foreign key relationships between game_invites and users tables

-- First check if the table exists before attempting to fix it
DO $$
BEGIN
  -- Check if game_invites table exists
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'game_invites'
  ) THEN
    -- If the table exists, check if we need to recreate it with proper foreign keys
    IF NOT EXISTS (
      SELECT 1 
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND tc.table_name = 'game_invites'
      AND ccu.table_name = 'users'
      AND tc.table_schema = 'public'
    ) THEN
      -- Drop existing table if it doesn't have proper foreign keys
      DROP TABLE IF EXISTS public.game_invites;
    END IF;
  END IF;
END$$;

-- Create game_invites table with proper foreign key relationships if it doesn't exist
CREATE TABLE IF NOT EXISTS public.game_invites (
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

-- Enable Row Level Security for the table
ALTER TABLE public.game_invites ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for game_invites
DO $$
BEGIN
  -- Check if the SELECT policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'game_invites' 
    AND policyname = 'Users can view game invites they are involved with'
  ) THEN
    CREATE POLICY "Users can view game invites they are involved with" ON public.game_invites
    FOR SELECT TO authenticated 
    USING (
      auth.uid() = sender_id OR auth.uid() = receiver_id
    );
  END IF;

  -- Check if the INSERT policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'game_invites' 
    AND policyname = 'Users can create game invites'
  ) THEN
    CREATE POLICY "Users can create game invites" ON public.game_invites
    FOR INSERT TO authenticated 
    WITH CHECK (
      auth.uid() = sender_id
    );
  END IF;

  -- Check if the UPDATE policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'game_invites' 
    AND policyname = 'Users can update game invites they received'
  ) THEN
    CREATE POLICY "Users can update game invites they received" ON public.game_invites
    FOR UPDATE TO authenticated 
    USING (
      auth.uid() = receiver_id
    );
  END IF;

  -- Check if the DELETE policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'game_invites' 
    AND policyname = 'Users can delete game invites they created'
  ) THEN
    CREATE POLICY "Users can delete game invites they created" ON public.game_invites
    FOR DELETE TO authenticated 
    USING (
      auth.uid() = sender_id
    );
  END IF;
END $$;

-- Create function to send game invites if it doesn't exist
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

COMMENT ON FUNCTION public.send_game_invite(UUID, UUID, UUID) IS 'Sends a game invitation to a friend';

-- Create function to respond to game invites
CREATE OR REPLACE FUNCTION public.respond_to_game_invite(
  invite_id_param BIGINT,
  user_id_param UUID,
  accept BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  invite_record RECORD;
  result JSONB;
BEGIN
  -- Get the game invite
  SELECT * INTO invite_record FROM public.game_invites
  WHERE id = invite_id_param AND receiver_id = user_id_param AND status = 'pending';
  
  IF invite_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Game invite not found');
  END IF;
  
  IF accept THEN
    -- Accept the game invite
    UPDATE public.game_invites
    SET status = 'accepted', updated_at = now()
    WHERE id = invite_id_param;
    
    -- Update the game to include the player (joining as player2)
    UPDATE public.games
    SET player2_id = user_id_param, 
        status = 'active'
    WHERE id = invite_record.game_id;
    
    RETURN jsonb_build_object('success', true, 'message', 'Game invite accepted', 'game_id', invite_record.game_id);
  ELSE
    -- Reject the game invite
    UPDATE public.game_invites
    SET status = 'rejected', updated_at = now()
    WHERE id = invite_id_param;
    
    RETURN jsonb_build_object('success', true, 'message', 'Game invite rejected');
  END IF;
END;
$$;

COMMENT ON FUNCTION public.respond_to_game_invite(BIGINT, UUID, BOOLEAN) IS 'Accepts or rejects a game invitation';

-- Create updated_at trigger for game_invites table
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Only create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
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
    -- If the table doesn't exist, we don't need to create the trigger
    NULL;
END $$; 