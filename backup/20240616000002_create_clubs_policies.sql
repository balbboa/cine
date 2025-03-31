-- RLS policies for clubs
DROP POLICY IF EXISTS "Anyone can view clubs" ON public.clubs;
CREATE POLICY "Anyone can view clubs" ON public.clubs
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users can create clubs" ON public.clubs;
CREATE POLICY "Users can create clubs" ON public.clubs
FOR INSERT
WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Club creators can update clubs" ON public.clubs;
CREATE POLICY "Club creators can update clubs" ON public.clubs
FOR UPDATE
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Club creators can delete clubs" ON public.clubs;
CREATE POLICY "Club creators can delete clubs" ON public.clubs
FOR DELETE
USING (auth.uid() = created_by);

-- RLS policies for club_members
DROP POLICY IF EXISTS "Anyone can see club members" ON public.club_members;
CREATE POLICY "Anyone can see club members" ON public.club_members
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users can join clubs" ON public.club_members;
CREATE POLICY "Users can join clubs" ON public.club_members
FOR INSERT
WITH CHECK (auth.uid() = member_id OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can leave clubs" ON public.club_members;
CREATE POLICY "Users can leave clubs" ON public.club_members
FOR DELETE
USING (auth.uid() = member_id OR auth.uid() = user_id); 