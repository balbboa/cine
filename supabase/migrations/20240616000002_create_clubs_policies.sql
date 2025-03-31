-- Simple RLS policies for clubs table
DROP POLICY IF EXISTS "Anyone can view clubs" ON public.clubs;
CREATE POLICY "Anyone can view clubs"
ON public.clubs FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Anyone can create clubs" ON public.clubs;
CREATE POLICY "Anyone can create clubs"
ON public.clubs FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update clubs" ON public.clubs;
CREATE POLICY "Anyone can update clubs"
ON public.clubs FOR UPDATE
USING (true);

DROP POLICY IF EXISTS "Anyone can delete clubs" ON public.clubs;
CREATE POLICY "Anyone can delete clubs"
ON public.clubs FOR DELETE
USING (true);

-- Simple RLS policies for club_members table
DROP POLICY IF EXISTS "Anyone can view club members" ON public.club_members;
CREATE POLICY "Anyone can view club members"
ON public.club_members FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Anyone can join clubs" ON public.club_members;
CREATE POLICY "Anyone can join clubs"
ON public.club_members FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can leave clubs" ON public.club_members;
CREATE POLICY "Anyone can leave clubs"
ON public.club_members FOR DELETE
USING (true); 