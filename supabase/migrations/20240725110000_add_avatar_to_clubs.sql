-- Migration: Add avatar_url to clubs table
-- Description: Adds an avatar_url column to store club avatar image URLs.
-- Affected Tables: clubs
-- Author: Gemini

alter table public.clubs
add column if not exists avatar_url text null;

-- Add a comment to the new column for clarity
comment on column public.clubs.avatar_url is 'URL for the club''s avatar image.'; -- Escaped single quote with '' 