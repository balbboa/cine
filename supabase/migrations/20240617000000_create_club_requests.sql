-- Migration: Club Requests System
-- Description: Adds MMORPG-style guild functionality to the club system
-- 1. Add cost system to clubs
-- 2. Add club_join_requests table for join requests
-- 3. Only club owners can accept join requests

-- Add credits field to users if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'credits'
    ) THEN
        ALTER TABLE users ADD COLUMN credits INT NOT NULL DEFAULT 1000;
    END IF;
END$$;

-- Add is_owner column to club_members if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'club_members' AND column_name = 'is_owner'
    ) THEN
        ALTER TABLE club_members ADD COLUMN is_owner BOOLEAN NOT NULL DEFAULT false;
    END IF;
END$$;

-- Table: public.club_join_requests
CREATE TABLE IF NOT EXISTS public.club_join_requests (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    club_id BIGINT NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE(club_id, user_id)
);

COMMENT ON TABLE public.club_join_requests IS 'Stores requests to join movie clubs in a guild-like system';

-- Enable RLS on club_join_requests
ALTER TABLE public.club_join_requests ENABLE ROW LEVEL SECURITY;

-- Create club join request policies

-- Allow authenticated users to see their own requests
CREATE POLICY "Users can view their own join requests" 
ON club_join_requests
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow club owners to see all requests for their clubs
CREATE POLICY "Club owners can view all join requests for their clubs" 
ON club_join_requests
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM club_members 
        WHERE club_id = club_join_requests.club_id 
        AND user_id = auth.uid()
        AND is_owner = true
    )
);

-- Allow authenticated users to create join requests
CREATE POLICY "Users can create join requests" 
ON club_join_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow club owners to update join requests (accept/reject)
CREATE POLICY "Club owners can update join requests" 
ON club_join_requests
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM club_members 
        WHERE club_id = club_join_requests.club_id 
        AND user_id = auth.uid()
        AND is_owner = true
    )
);

-- Allow users to delete their own pending requests
CREATE POLICY "Users can delete their own pending requests" 
ON club_join_requests
FOR DELETE
TO authenticated
USING (
    auth.uid() = user_id AND 
    status = 'pending'
);

-- Allow club owners to delete requests for their clubs
CREATE POLICY "Club owners can delete join requests for their clubs" 
ON club_join_requests
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM club_members 
        WHERE club_id = club_join_requests.club_id 
        AND user_id = auth.uid()
        AND is_owner = true
    )
);

-- Create function to handle club creation with cost
CREATE OR REPLACE FUNCTION public.create_guild_with_membership(
    club_name TEXT,
    club_description TEXT,
    creator_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    club_id BIGINT;
    user_credits INT;
    club_cost INT := 2000;
    result JSONB;
BEGIN
    -- Check if user has enough credits
    SELECT credits INTO user_credits FROM users WHERE id = creator_id;
    
    IF user_credits IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'User not found');
    END IF;
    
    IF user_credits < club_cost THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', format('Not enough credits. Club creation costs %s credits, you have %s', club_cost, user_credits)
        );
    END IF;
    
    -- Deduct credits
    UPDATE users SET credits = credits - club_cost WHERE id = creator_id;
    
    -- Create club
    INSERT INTO clubs (name, description)
    VALUES (club_name, club_description)
    RETURNING id INTO club_id;
    
    -- Add creator as member and owner
    INSERT INTO club_members (club_id, user_id, member_id, is_owner)
    VALUES (club_id, creator_id, creator_id, true);
    
    RETURN jsonb_build_object(
        'success', true,
        'club_id', club_id,
        'credits_spent', club_cost,
        'remaining_credits', user_credits - club_cost
    );
END;
$$;

COMMENT ON FUNCTION public.create_guild_with_membership IS 'Creates a new club and automatically adds the creator as a member. Costs 2000 credits.';

-- Create function to handle join requests
CREATE OR REPLACE FUNCTION public.create_club_join_request(
    p_club_id BIGINT,
    p_user_id UUID,
    p_message TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    existing_membership RECORD;
    existing_request RECORD;
    result JSONB;
BEGIN
    -- Check if already a member
    SELECT id INTO existing_membership FROM club_members 
    WHERE club_id = p_club_id AND (user_id = p_user_id OR member_id = p_user_id);
    
    IF existing_membership IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Already a member of this club');
    END IF;
    
    -- Check if already has a pending request
    SELECT id, status INTO existing_request FROM club_join_requests 
    WHERE club_id = p_club_id AND user_id = p_user_id;
    
    IF existing_request IS NOT NULL THEN
        IF existing_request.status = 'pending' THEN
            RETURN jsonb_build_object('success', false, 'message', 'Already have a pending request for this club');
        ELSIF existing_request.status = 'rejected' THEN
            -- Update existing rejected request to pending
            UPDATE club_join_requests 
            SET status = 'pending', message = p_message, updated_at = NOW()
            WHERE id = existing_request.id;
            
            RETURN jsonb_build_object('success', true, 'message', 'Join request submitted');
        END IF;
    END IF;
    
    -- Create new request
    INSERT INTO club_join_requests (club_id, user_id, message)
    VALUES (p_club_id, p_user_id, p_message);
    
    RETURN jsonb_build_object('success', true, 'message', 'Join request submitted');
END;
$$;

COMMENT ON FUNCTION public.create_club_join_request IS 'Creates a request to join a club in the guild system';

-- Create function to handle request responses
CREATE OR REPLACE FUNCTION public.respond_to_club_join_request(
    p_request_id BIGINT,
    p_accept BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    request_record RECORD;
    is_club_owner BOOLEAN;
    result JSONB;
BEGIN
    -- Get request details
    SELECT r.id, r.club_id, r.user_id, r.status
    INTO request_record
    FROM club_join_requests r
    WHERE r.id = p_request_id;
    
    IF request_record IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Request not found');
    END IF;
    
    -- Check if caller is club owner
    SELECT EXISTS (
        SELECT 1 FROM club_members 
        WHERE club_id = request_record.club_id 
        AND user_id = auth.uid()
        AND is_owner = true
    ) INTO is_club_owner;
    
    IF NOT is_club_owner THEN
        RETURN jsonb_build_object('success', false, 'message', 'Only club owner can respond to join requests');
    END IF;
    
    -- Check if request is already processed
    IF request_record.status != 'pending' THEN
        RETURN jsonb_build_object('success', false, 'message', format('Request already %s', request_record.status));
    END IF;
    
    IF p_accept THEN
        -- Accept: add user as member and update request status
        INSERT INTO club_members (club_id, user_id, member_id, is_owner)
        VALUES (request_record.club_id, request_record.user_id, request_record.user_id, false);
        
        UPDATE club_join_requests
        SET status = 'accepted', updated_at = NOW()
        WHERE id = p_request_id;
        
        RETURN jsonb_build_object('success', true, 'message', 'Request accepted, user added to club');
    ELSE
        -- Reject: update request status
        UPDATE club_join_requests
        SET status = 'rejected', updated_at = NOW()
        WHERE id = p_request_id;
        
        RETURN jsonb_build_object('success', true, 'message', 'Request rejected');
    END IF;
END;
$$;

COMMENT ON FUNCTION public.respond_to_club_join_request IS 'Allows club owners to accept or reject join requests';

-- Create function to get club join requests
CREATE OR REPLACE FUNCTION public.get_club_join_requests(p_club_id BIGINT)
RETURNS TABLE (
    id BIGINT,
    club_id BIGINT,
    user_id UUID,
    status TEXT,
    message TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    username TEXT,
    avatar_url TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.club_id,
        r.user_id,
        r.status,
        r.message,
        r.created_at,
        r.updated_at,
        u.username,
        u.avatar_url
    FROM club_join_requests r
    JOIN users u ON r.user_id = u.id
    WHERE r.club_id = p_club_id
    ORDER BY r.created_at DESC;
END;
$$;

COMMENT ON FUNCTION public.get_club_join_requests IS 'Gets join requests for a specific club with user details'; 