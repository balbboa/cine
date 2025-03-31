-- Migration: add_existing_user
-- Created at: 2023-05-15T00:00:00.000Z

-- Up Migration
-- This migration adds the existing authenticated user to the users table

-- Check if users table exists first to avoid errors
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables 
             WHERE table_schema = 'public' 
             AND table_name = 'users') THEN
    -- Create the user record for the existing authenticated user
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
      '82962cd0-ec86-4142-a377-820d9b64a701', -- The user ID from the auth logs
      'user_82962cd0',                         -- Username based on user ID
      'user@example.com',                      -- Replace with actual email if known
      1,                                       -- Starting level
      0,                                       -- Starting XP
      100,                                     -- Starting XP needed for next level
      0,                                       -- Starting wins
      0,                                       -- Starting losses
      100,                                     -- Starting credits
      'offline',                               -- Initial online status
      NOW()                                    -- Current timestamp
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
END
$$;

-- Don't error if the user already exists

-- Down Migration
-- DELETE FROM public.users WHERE id = '82962cd0-ec86-4142-a377-820d9b64a701'; 