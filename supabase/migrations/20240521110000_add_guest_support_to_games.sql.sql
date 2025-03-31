-- supabase/migrations/TIMESTAMP_add_guest_support_to_games.sql
-- Description: Modifies the games table to support guest players.
-- Adds display name columns and makes player ID columns nullable.

-- Add player display name columns
ALTER TABLE public.games
ADD COLUMN IF NOT EXISTS player1_display_name TEXT,
ADD COLUMN IF NOT EXISTS player2_display_name TEXT;

-- Add comments for new columns
COMMENT ON COLUMN public.games.player1_display_name IS 'Display name for player 1 (username or guest name).';
COMMENT ON COLUMN public.games.player2_display_name IS 'Display name for player 2 (username or guest name).';

-- Make player ID columns nullable to allow guests (who don't have a users.id)
-- Note: This removes the NOT NULL constraint if it exists. Foreign key constraint remains but allows NULL.
ALTER TABLE public.games
ALTER COLUMN player1_id DROP NOT NULL,
ALTER COLUMN player2_id DROP NOT NULL;

-- Optional: Update existing rows to populate display names from users table if needed
-- This depends on whether you want to backfill. Run cautiously.
-- UPDATE public.games g
-- SET 
--   player1_display_name = COALESCE(g.player1_display_name, u1.username),
--   player2_display_name = COALESCE(g.player2_display_name, u2.username)
-- FROM public.users u1, public.users u2
-- WHERE g.player1_id = u1.id AND g.player2_id = u2.id
--   AND (g.player1_display_name IS NULL OR g.player2_display_name IS NULL); 