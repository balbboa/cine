-- Migration: Add achievements system
-- Created at: 2025-03-30T18:45:20.000Z
-- Description: Adds achievement tracking and unlocking functionality

-- Create achievements table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.achievements (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  xp_reward INTEGER NOT NULL DEFAULT 0,
  credits_reward INTEGER NOT NULL DEFAULT 0,
  achievement_type TEXT NOT NULL,
  required_value INTEGER NOT NULL DEFAULT 1,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.achievements IS 'Game achievements that players can unlock';

-- Create user_achievements table to track which achievements users have unlocked
CREATE TABLE IF NOT EXISTS public.user_achievements (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  achievement_id BIGINT NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  progress INTEGER NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(user_id, achievement_id)
);

COMMENT ON TABLE public.user_achievements IS 'Tracks user progress towards achievements';

-- Enable Row Level Security on both tables
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for achievements
CREATE POLICY "Anyone can view achievements" ON public.achievements
FOR SELECT TO anon, authenticated
USING (
  true
);

-- Create RLS policies for user_achievements
CREATE POLICY "Users can view their own achievements" ON public.user_achievements
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
);

CREATE POLICY "Users can view anyone's completed achievements" ON public.user_achievements
FOR SELECT TO anon, authenticated
USING (
  is_completed = true
);

CREATE POLICY "Users can update their own achievement progress" ON public.user_achievements
FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
);

-- Create function to check and update achievement progress
CREATE OR REPLACE FUNCTION public.update_achievement_progress(
  p_user_id UUID,
  p_achievement_type TEXT,
  p_progress_value INTEGER DEFAULT 1
)
RETURNS TABLE (
  achievement_id BIGINT,
  achievement_name TEXT,
  is_newly_completed BOOLEAN,
  xp_gained INTEGER,
  credits_gained INTEGER
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  achievement_record RECORD;
  user_achievement_record RECORD;
  newly_completed BOOLEAN;
  xp_reward INTEGER;
  credits_reward INTEGER;
BEGIN
  -- Find all achievements of the specified type
  FOR achievement_record IN 
    SELECT * FROM public.achievements 
    WHERE achievement_type = p_achievement_type
  LOOP
    -- Check if the user already has this achievement in progress
    SELECT * INTO user_achievement_record 
    FROM public.user_achievements
    WHERE user_id = p_user_id AND achievement_id = achievement_record.id;
    
    IF user_achievement_record IS NULL THEN
      -- Create a new record if one doesn't exist
      INSERT INTO public.user_achievements (
        user_id, 
        achievement_id, 
        progress,
        is_completed,
        completed_at
      )
      VALUES (
        p_user_id,
        achievement_record.id,
        p_progress_value,
        p_progress_value >= achievement_record.required_value,
        CASE WHEN p_progress_value >= achievement_record.required_value THEN now() ELSE NULL END
      )
      RETURNING * INTO user_achievement_record;
      
      newly_completed := user_achievement_record.is_completed;
    ELSE
      -- Only update if not already completed
      IF NOT user_achievement_record.is_completed THEN
        -- Update the existing record
        UPDATE public.user_achievements
        SET 
          progress = user_achievement_record.progress + p_progress_value,
          is_completed = CASE 
            WHEN user_achievement_record.progress + p_progress_value >= achievement_record.required_value 
            THEN true 
            ELSE false 
          END,
          completed_at = CASE 
            WHEN user_achievement_record.progress + p_progress_value >= achievement_record.required_value 
            THEN now() 
            ELSE NULL 
          END,
          updated_at = now()
        WHERE 
          id = user_achievement_record.id
        RETURNING * INTO user_achievement_record;
        
        newly_completed := user_achievement_record.is_completed AND 
                           (user_achievement_record.progress - p_progress_value) < achievement_record.required_value;
      ELSE
        newly_completed := false;
      END IF;
    END IF;
    
    -- If the achievement was newly completed, grant rewards
    IF newly_completed THEN
      -- Grant XP reward
      IF achievement_record.xp_reward > 0 THEN
        PERFORM public.update_user_xp(p_user_id, achievement_record.xp_reward);
        xp_reward := achievement_record.xp_reward;
      ELSE
        xp_reward := 0;
      END IF;
      
      -- Grant credits reward
      IF achievement_record.credits_reward > 0 THEN
        UPDATE public.users
        SET credits = credits + achievement_record.credits_reward
        WHERE id = p_user_id;
        
        credits_reward := achievement_record.credits_reward;
      ELSE
        credits_reward := 0;
      END IF;
      
      -- Return information about the completed achievement
      RETURN QUERY
      SELECT 
        achievement_record.id,
        achievement_record.name,
        newly_completed,
        xp_reward,
        credits_reward;
    END IF;
  END LOOP;
  
  -- Return empty result if no achievements were completed
  IF NOT FOUND THEN
    achievement_id := NULL;
    achievement_name := NULL;
    is_newly_completed := false;
    xp_gained := 0;
    credits_gained := 0;
    RETURN NEXT;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.update_achievement_progress(UUID, TEXT, INTEGER) IS 'Updates a user''s progress towards achievements of a specific type';

-- Create trigger function to track game completion achievements
CREATE OR REPLACE FUNCTION public.track_game_achievements()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  -- Only proceed if the game status changed to completed
  IF NEW.status = 'completed' AND NEW.winner_id IS NOT NULL AND
     (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Track completed games for the winner
    PERFORM public.update_achievement_progress(NEW.winner_id, 'games_completed');
    
    -- Track win streak achievement if applicable
    PERFORM public.update_achievement_progress(NEW.winner_id, 'win_streak');
    
    -- Track wins achievement
    PERFORM public.update_achievement_progress(NEW.winner_id, 'games_won');
    
    -- If player1 lost, track their stats too
    IF NEW.player1_id != NEW.winner_id AND NEW.player1_id IS NOT NULL THEN
      PERFORM public.update_achievement_progress(NEW.player1_id, 'games_completed');
      PERFORM public.update_achievement_progress(NEW.player1_id, 'games_played');
    END IF;
    
    -- If player2 lost, track their stats too
    IF NEW.player2_id != NEW.winner_id AND NEW.player2_id IS NOT NULL THEN
      PERFORM public.update_achievement_progress(NEW.player2_id, 'games_completed');
      PERFORM public.update_achievement_progress(NEW.player2_id, 'games_played');
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.track_game_achievements() IS 'Tracks achievement progress when games are completed';

-- Create the trigger on the games table
DROP TRIGGER IF EXISTS track_game_achievements_trigger ON public.games;

CREATE TRIGGER track_game_achievements_trigger
AFTER UPDATE ON public.games
FOR EACH ROW
EXECUTE FUNCTION public.track_game_achievements();

-- Create a function to check movie accuracy achievements
CREATE OR REPLACE FUNCTION public.track_movie_accuracy_achievements()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  -- Track movie guesses
  PERFORM public.update_achievement_progress(NEW.user_id, 'movies_guessed');
  
  -- Track quick answers (if answered in under 5 seconds)
  IF NEW.time_to_answer < 5 THEN
    PERFORM public.update_achievement_progress(NEW.user_id, 'quick_answers');
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.track_movie_accuracy_achievements() IS 'Tracks achievement progress related to movie guessing';

-- Create the trigger on the game_moves table
DROP TRIGGER IF EXISTS track_movie_achievements_trigger ON public.game_moves;

CREATE TRIGGER track_movie_achievements_trigger
AFTER INSERT ON public.game_moves
FOR EACH ROW
EXECUTE FUNCTION public.track_movie_accuracy_achievements();

-- Function to get user achievements with progress
CREATE OR REPLACE FUNCTION public.get_user_achievements(p_user_id UUID)
RETURNS TABLE (
  achievement_id BIGINT,
  name TEXT,
  description TEXT,
  icon TEXT,
  progress INTEGER,
  required_value INTEGER,
  is_completed BOOLEAN,
  completed_at TIMESTAMP WITH TIME ZONE,
  is_hidden BOOLEAN,
  xp_reward INTEGER,
  credits_reward INTEGER
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id AS achievement_id,
    a.name,
    a.description,
    a.icon,
    COALESCE(ua.progress, 0) AS progress,
    a.required_value,
    COALESCE(ua.is_completed, false) AS is_completed,
    ua.completed_at,
    a.is_hidden,
    a.xp_reward,
    a.credits_reward
  FROM
    public.achievements a
  LEFT JOIN
    public.user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = p_user_id
  WHERE
    -- Only show hidden achievements if they're completed
    (NOT a.is_hidden OR (a.is_hidden AND ua.is_completed))
  ORDER BY
    a.achievement_type,
    a.required_value;
END;
$$;

COMMENT ON FUNCTION public.get_user_achievements(UUID) IS 'Get all achievements for a user with progress information';

-- Insert some initial achievement types
INSERT INTO public.achievements (name, description, icon, xp_reward, credits_reward, achievement_type, required_value, is_hidden)
VALUES
  ('First Victory', 'Win your first game', 'trophy', 50, 10, 'games_won', 1, false),
  ('Cinephile', 'Play 10 games', 'film', 100, 20, 'games_completed', 10, false),
  ('Movie Master', 'Win 25 games', 'star', 250, 50, 'games_won', 25, false),
  ('Quick Draw', 'Answer correctly in under 5 seconds 5 times', 'clock', 75, 15, 'quick_answers', 5, false),
  ('Winning Streak', 'Win 5 games in a row', 'fire', 150, 30, 'win_streak', 5, false),
  ('Movie Buff', 'Guess 50 movies correctly', 'clapperboard', 200, 40, 'movies_guessed', 50, false),
  ('Film Fanatic', 'Play 50 games', 'popcorn', 300, 60, 'games_played', 50, false),
  ('Ultimate Champion', 'Win 100 games', 'crown', 500, 100, 'games_won', 100, true)
ON CONFLICT (name) DO NOTHING; 