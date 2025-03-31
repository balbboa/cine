-- Migration: fix_duplicate_badges
-- Created at: 2024-05-15T00:10:00.000Z

-- Up Migration
-- This migration safely inserts badge data with conflict handling

-- Check if badges table exists first to avoid errors
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables 
             WHERE table_schema = 'public' 
             AND table_name = 'badges') THEN
    -- Safely insert badges by ignoring duplicate entries
    INSERT INTO public.badges (name, icon, description) VALUES
    ('First Win', 'trophy', 'Win your first game'),
    ('Movie Buff', 'film', 'Play 10 games'),
    ('Cinephile', 'star', 'Correctly name 50 movies'),
    ('Quick Draw', 'clock', 'Answer correctly in under 5 seconds'),
    ('Winning Streak', 'award', 'Win 5 games in a row')
    ON CONFLICT (name) DO NOTHING;
  END IF;
END
$$;

-- Check if store_items table exists before inserting
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables 
             WHERE table_schema = 'public' 
             AND table_name = 'store_items') THEN
    -- Same approach for store items
    INSERT INTO public.store_items (name, description, price, type, image_url) VALUES
    ('Gold Frame', 'A luxurious gold frame for your profile', 500, 'frame', '/items/gold-frame.png'),
    ('Silver Frame', 'A sleek silver frame for your profile', 300, 'frame', '/items/silver-frame.png'),
    ('Movie Director', 'Show everyone you''re a movie director', 800, 'title', NULL),
    ('Film Critic', 'Let others know you have taste', 700, 'title', NULL),
    ('Red Theme', 'Change your profile theme to red', 200, 'theme', NULL)
    ON CONFLICT (name) DO NOTHING;
  END IF;
END
$$;

-- Down Migration
-- No down migration needed as we're just avoiding duplicates 