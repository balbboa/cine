-- Migration: Add leaderboard functionality
-- Created at: 2025-03-30T18:44:21.000Z
-- Description: Adds a leaderboard view and ranking functions for player statistics

-- Create a materialized view for the global leaderboard
-- This will improve performance by pre-calculating the rankings
CREATE MATERIALIZED VIEW IF NOT EXISTS public.global_leaderboard AS
SELECT
  users.id,
  users.username,
  users.avatar_url,
  users.level,
  users.xp,
  users.wins,
  users.losses,
  CASE
    WHEN users.wins + users.losses = 0 THEN 0
    ELSE ROUND((users.wins::numeric / (users.wins + users.losses)) * 100, 2)
  END AS win_rate,
  RANK() OVER (ORDER BY users.wins DESC, users.xp DESC) AS rank
FROM
  public.users
WHERE 
  users.wins + users.losses > 0;

COMMENT ON MATERIALIZED VIEW public.global_leaderboard IS 'Pre-calculated global leaderboard for faster queries';

-- Create index on the leaderboard for faster rank lookups
CREATE INDEX IF NOT EXISTS idx_leaderboard_rank ON public.global_leaderboard(rank);
CREATE INDEX IF NOT EXISTS idx_leaderboard_wins ON public.global_leaderboard(wins DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_win_rate ON public.global_leaderboard(win_rate DESC);

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION public.refresh_leaderboard()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.global_leaderboard;
END;
$$;

COMMENT ON FUNCTION public.refresh_leaderboard() IS 'Refreshes the global leaderboard materialized view';

-- Create a trigger function to refresh the leaderboard when game status changes
CREATE OR REPLACE FUNCTION public.refresh_leaderboard_on_game_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  -- Only refresh when a game is completed
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Refresh the leaderboard
    PERFORM public.refresh_leaderboard();
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.refresh_leaderboard_on_game_completion() IS 'Automatically refreshes the leaderboard when games are completed';

-- Create the trigger on the games table
DROP TRIGGER IF EXISTS refresh_leaderboard_trigger ON public.games;

CREATE TRIGGER refresh_leaderboard_trigger
AFTER UPDATE ON public.games
FOR EACH ROW
EXECUTE FUNCTION public.refresh_leaderboard_on_game_completion();

-- Create a seasonal leaderboards table to track seasonal rankings
CREATE TABLE IF NOT EXISTS public.seasonal_leaderboards (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  season_name TEXT NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.seasonal_leaderboards IS 'Defines seasons for competitive play and leaderboards';

-- Enable RLS on seasonal_leaderboards
ALTER TABLE public.seasonal_leaderboards ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for seasonal_leaderboards
CREATE POLICY "Anyone can view seasonal leaderboards" ON public.seasonal_leaderboards
FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "Only authenticated users can create seasonal leaderboards" ON public.seasonal_leaderboards
FOR INSERT TO authenticated
WITH CHECK (
  -- In a real application, you might want to restrict this to admins only
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND level >= 10
  )
);

-- Create a table to track seasonal player stats
CREATE TABLE IF NOT EXISTS public.seasonal_player_stats (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  season_id BIGINT NOT NULL REFERENCES public.seasonal_leaderboards(id) ON DELETE CASCADE,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  highest_rank INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(user_id, season_id)
);

COMMENT ON TABLE public.seasonal_player_stats IS 'Tracks player performance in seasonal competitions';

-- Enable RLS on seasonal_player_stats
ALTER TABLE public.seasonal_player_stats ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for seasonal_player_stats
CREATE POLICY "Anyone can view seasonal player stats" ON public.seasonal_player_stats
FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "Users can update their own seasonal stats" ON public.seasonal_player_stats
FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
);

-- Create function to get a player's current rank
CREATE OR REPLACE FUNCTION public.get_player_rank(player_id UUID)
RETURNS TABLE (
  global_rank BIGINT,
  seasonal_rank BIGINT,
  season_name TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  current_season_id BIGINT;
BEGIN
  -- Get the current active season
  SELECT id INTO current_season_id
  FROM public.seasonal_leaderboards
  WHERE is_active = true
  ORDER BY start_date DESC
  LIMIT 1;
  
  -- Get global rank
  RETURN QUERY
  SELECT 
    gl.rank AS global_rank,
    sps.highest_rank AS seasonal_rank,
    sl.season_name
  FROM 
    public.global_leaderboard gl
  LEFT JOIN
    public.seasonal_player_stats sps ON gl.id = sps.user_id AND sps.season_id = current_season_id
  LEFT JOIN
    public.seasonal_leaderboards sl ON sl.id = current_season_id
  WHERE 
    gl.id = player_id;
END;
$$;

COMMENT ON FUNCTION public.get_player_rank(UUID) IS 'Get a player''s current global and seasonal rank';

-- Function to update seasonal player stats when a game completes
CREATE OR REPLACE FUNCTION public.update_seasonal_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  current_season_id BIGINT;
BEGIN
  -- Only proceed if the game is completed and has a winner
  IF NEW.status = 'completed' AND NEW.winner_id IS NOT NULL THEN
    -- Get the current active season
    SELECT id INTO current_season_id
    FROM public.seasonal_leaderboards
    WHERE is_active = true
    AND now() BETWEEN start_date AND end_date
    LIMIT 1;
    
    -- Only proceed if there's an active season
    IF current_season_id IS NOT NULL THEN
      -- Update winner stats
      INSERT INTO public.seasonal_player_stats (user_id, season_id, wins, losses)
      VALUES (NEW.winner_id, current_season_id, 1, 0)
      ON CONFLICT (user_id, season_id) DO UPDATE
      SET wins = seasonal_player_stats.wins + 1, 
          updated_at = now();
      
      -- Update loser stats (player1 or player2 depending on who's not the winner)
      IF NEW.player1_id = NEW.winner_id AND NEW.player2_id IS NOT NULL THEN
        -- Player2 lost
        INSERT INTO public.seasonal_player_stats (user_id, season_id, wins, losses)
        VALUES (NEW.player2_id, current_season_id, 0, 1)
        ON CONFLICT (user_id, season_id) DO UPDATE
        SET losses = seasonal_player_stats.losses + 1,
            updated_at = now();
      ELSIF NEW.player2_id = NEW.winner_id AND NEW.player1_id IS NOT NULL THEN
        -- Player1 lost
        INSERT INTO public.seasonal_player_stats (user_id, season_id, wins, losses)
        VALUES (NEW.player1_id, current_season_id, 0, 1)
        ON CONFLICT (user_id, season_id) DO UPDATE
        SET losses = seasonal_player_stats.losses + 1,
            updated_at = now();
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_seasonal_stats() IS 'Updates player seasonal stats when games are completed';

-- Create the trigger on the games table
DROP TRIGGER IF EXISTS update_seasonal_stats_trigger ON public.games;

CREATE TRIGGER update_seasonal_stats_trigger
AFTER UPDATE ON public.games
FOR EACH ROW
EXECUTE FUNCTION public.update_seasonal_stats();

-- Function to create a new season
CREATE OR REPLACE FUNCTION public.create_new_season(
  p_season_name TEXT,
  p_start_date TIMESTAMP WITH TIME ZONE,
  p_end_date TIMESTAMP WITH TIME ZONE,
  p_is_active BOOLEAN DEFAULT TRUE
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_season_id BIGINT;
BEGIN
  -- If making this season active, deactivate all other seasons
  IF p_is_active THEN
    UPDATE public.seasonal_leaderboards
    SET is_active = FALSE
    WHERE is_active = TRUE;
  END IF;
  
  -- Create the new season
  INSERT INTO public.seasonal_leaderboards (
    season_name,
    start_date,
    end_date,
    is_active
  )
  VALUES (
    p_season_name,
    p_start_date,
    p_end_date,
    p_is_active
  )
  RETURNING id INTO v_season_id;
  
  RETURN v_season_id;
END;
$$;

COMMENT ON FUNCTION public.create_new_season(TEXT, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, BOOLEAN) IS 'Creates a new seasonal leaderboard';

-- Create a function to get top players
CREATE OR REPLACE FUNCTION public.get_top_players(
  p_limit INTEGER DEFAULT 10,
  p_offset INTEGER DEFAULT 0,
  p_season_id BIGINT DEFAULT NULL
)
RETURNS TABLE (
  player_id UUID,
  username TEXT,
  avatar_url TEXT,
  wins INTEGER,
  losses INTEGER,
  win_rate NUMERIC,
  rank BIGINT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  -- If season_id is provided, return seasonal leaderboard
  IF p_season_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      u.id AS player_id,
      u.username,
      u.avatar_url,
      sps.wins,
      sps.losses,
      CASE
        WHEN sps.wins + sps.losses = 0 THEN 0
        ELSE ROUND((sps.wins::numeric / (sps.wins + sps.losses)) * 100, 2)
      END AS win_rate,
      RANK() OVER (ORDER BY sps.wins DESC, sps.wins - sps.losses DESC) AS rank
    FROM
      public.seasonal_player_stats sps
    JOIN
      public.users u ON sps.user_id = u.id
    WHERE
      sps.season_id = p_season_id
    ORDER BY
      rank
    LIMIT p_limit
    OFFSET p_offset;
  ELSE
    -- Return global leaderboard
    RETURN QUERY
    SELECT
      id AS player_id,
      username,
      avatar_url,
      wins,
      losses,
      win_rate,
      rank
    FROM
      public.global_leaderboard
    ORDER BY
      rank
    LIMIT p_limit
    OFFSET p_offset;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.get_top_players(INTEGER, INTEGER, BIGINT) IS 'Get top players globally or for a specific season';

-- Create an initial season for testing
SELECT public.create_new_season(
  'Season 1',
  NOW(),
  NOW() + INTERVAL '3 months',
  TRUE
);

-- Refresh the leaderboard to ensure it's populated
SELECT public.refresh_leaderboard(); 