-- Migration: update_friendships_and_add_friend_requests
-- Created at: 2025-03-30T17:50:45.000Z
-- Description: Updates friendship system to support nickname search and friend invites

-- Create a trigger to ensure username is unique before friends can be added
CREATE OR REPLACE FUNCTION check_username_uniqueness()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.users 
    WHERE LOWER(username) = LOWER(NEW.username) 
    AND id != NEW.id
  ) THEN
    RAISE EXCEPTION 'Username must be unique (case insensitive)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on user table
DROP TRIGGER IF EXISTS ensure_username_uniqueness ON public.users;
CREATE TRIGGER ensure_username_uniqueness
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION check_username_uniqueness();

-- Create friend_requests table to handle pending friend requests
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(sender_id, receiver_id),
  CONSTRAINT different_users CHECK (sender_id != receiver_id)
);
COMMENT ON TABLE public.friend_requests IS 'Friend requests between users';

-- Create game_invites table to handle game invitations
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

-- Update friendships table to remove the status column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'friendships' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE public.friendships DROP COLUMN status;
  END IF;
END $$;

-- Enable RLS for friend_requests and game_invites tables
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_invites ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for friend_requests
CREATE POLICY "Users can view friend requests they are involved with" ON public.friend_requests
FOR SELECT TO authenticated USING (
  auth.uid() = sender_id OR auth.uid() = receiver_id
);

CREATE POLICY "Users can create friend requests" ON public.friend_requests
FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = sender_id
);

CREATE POLICY "Users can update friend requests they received" ON public.friend_requests
FOR UPDATE TO authenticated USING (
  auth.uid() = receiver_id
);

-- Create RLS policies for game_invites
CREATE POLICY "Users can view game invites they are involved with" ON public.game_invites
FOR SELECT TO authenticated USING (
  auth.uid() = sender_id OR auth.uid() = receiver_id
);

CREATE POLICY "Users can create game invites" ON public.game_invites
FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = sender_id
);

CREATE POLICY "Users can update game invites they received" ON public.game_invites
FOR UPDATE TO authenticated USING (
  auth.uid() = receiver_id
);

-- Create function to find user by username (case insensitive)
CREATE OR REPLACE FUNCTION public.find_user_by_username(username_param TEXT)
RETURNS TABLE (
  id UUID,
  username TEXT,
  avatar_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.username, u.avatar_url
  FROM public.users u
  WHERE LOWER(u.username) = LOWER(username_param);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to send friend request
CREATE OR REPLACE FUNCTION public.send_friend_request(
  sender_id_param UUID,
  receiver_username TEXT
)
RETURNS JSONB AS $$
DECLARE
  receiver record;
  existing_request record;
  existing_friendship record;
  result JSONB;
BEGIN
  -- Find receiver by username
  SELECT * INTO receiver FROM public.find_user_by_username(receiver_username) LIMIT 1;
  
  IF receiver IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'User not found');
  END IF;
  
  -- Check if sender and receiver are the same
  IF sender_id_param = receiver.id THEN
    RETURN jsonb_build_object('success', false, 'message', 'You cannot send a friend request to yourself');
  END IF;
  
  -- Check if there's already a pending request
  SELECT * INTO existing_request FROM public.friend_requests 
  WHERE (sender_id = sender_id_param AND receiver_id = receiver.id) 
     OR (sender_id = receiver.id AND receiver_id = sender_id_param)
  LIMIT 1;
  
  IF existing_request IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'A friend request already exists');
  END IF;
  
  -- Check if they are already friends
  SELECT * INTO existing_friendship FROM public.friendships 
  WHERE (user_id = sender_id_param AND friend_id = receiver.id) 
     OR (user_id = receiver.id AND friend_id = sender_id_param)
  LIMIT 1;
  
  IF existing_friendship IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'You are already friends with this user');
  END IF;
  
  -- Create friend request
  INSERT INTO public.friend_requests (sender_id, receiver_id)
  VALUES (sender_id_param, receiver.id);
  
  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Friend request sent',
    'receiver', jsonb_build_object(
      'id', receiver.id,
      'username', receiver.username
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to respond to friend request
CREATE OR REPLACE FUNCTION public.respond_to_friend_request(
  request_id_param BIGINT,
  user_id_param UUID,
  accept BOOLEAN
)
RETURNS JSONB AS $$
DECLARE
  request_record record;
  result JSONB;
BEGIN
  -- Get the friend request
  SELECT * INTO request_record FROM public.friend_requests
  WHERE id = request_id_param AND receiver_id = user_id_param AND status = 'pending';
  
  IF request_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Friend request not found');
  END IF;
  
  IF accept THEN
    -- Accept friend request
    UPDATE public.friend_requests
    SET status = 'accepted', updated_at = now()
    WHERE id = request_id_param;
    
    -- Create friendship
    INSERT INTO public.friendships (user_id, friend_id)
    VALUES (request_record.sender_id, request_record.receiver_id);
    
    RETURN jsonb_build_object('success', true, 'message', 'Friend request accepted');
  ELSE
    -- Reject friend request
    UPDATE public.friend_requests
    SET status = 'rejected', updated_at = now()
    WHERE id = request_id_param;
    
    RETURN jsonb_build_object('success', true, 'message', 'Friend request rejected');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to send game invite
CREATE OR REPLACE FUNCTION public.send_game_invite(
  sender_id_param UUID,
  receiver_id_param UUID,
  game_id_param UUID
)
RETURNS JSONB AS $$
DECLARE
  existing_invite record;
  is_friend boolean;
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Refresh the schema cache
SELECT pg_notify('pgrst', 'reload schema');
