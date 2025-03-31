-- Enable RLS on the users table (if not already enabled)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows authenticated users to read all user profiles
CREATE POLICY "Users are viewable by authenticated users" 
ON users FOR SELECT 
TO authenticated
USING (true);

-- Create a policy that allows users to update their own profiles
CREATE POLICY "Users can update their own profiles" 
ON users FOR UPDATE 
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Create a policy for anonymous access to users table (read-only, limited)
CREATE POLICY "Public users are viewable by everyone" 
ON users FOR SELECT 
TO anon
USING (true);

-- Apply similar policies to other tables that need them
-- Example for games table
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Games are viewable by authenticated users" 
ON games FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Games can be modified by participants" 
ON games FOR ALL 
TO authenticated
USING (
  auth.uid() = player1_id OR 
  auth.uid() = player2_id
);

-- Example for game_moves table
ALTER TABLE game_moves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Game moves are viewable by everyone" 
ON game_moves FOR SELECT 
TO authenticated, anon
USING (true);

CREATE POLICY "Game moves can be added by participants" 
ON game_moves FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM games 
    WHERE games.id = game_id AND 
    (auth.uid() = games.player1_id OR auth.uid() = games.player2_id)
  )
);

-- Store items viewable by all
ALTER TABLE store_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store items are viewable by everyone" 
ON store_items FOR SELECT 
TO authenticated, anon
USING (true);

-- Badges viewable by all
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Badges are viewable by everyone" 
ON badges FOR SELECT 
TO authenticated, anon
USING (true); 