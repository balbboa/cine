-- Migration to improve the invite code system

-- 1. Create a function to generate standardized invite codes
CREATE OR REPLACE FUNCTION generate_invite_code() 
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Removed confusing characters (0, O, 1, I)
  result text := '';
  i integer := 0;
BEGIN
  -- Generate a 6-character code
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- 2. Make the invite_code case-insensitive and normalized in the games table
ALTER TABLE games ADD COLUMN normalized_invite_code text;

-- 3. Update the existing games to have normalized invite codes
UPDATE games 
SET normalized_invite_code = UPPER(TRIM(invite_code))
WHERE invite_code IS NOT NULL;

-- 4. Add a trigger to automatically normalize invite codes
CREATE OR REPLACE FUNCTION normalize_invite_code()
RETURNS TRIGGER AS $$
BEGIN
  NEW.normalized_invite_code := UPPER(TRIM(NEW.invite_code));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER normalize_invite_code_trigger
BEFORE INSERT OR UPDATE OF invite_code ON games
FOR EACH ROW
EXECUTE FUNCTION normalize_invite_code();

-- 5. Create a function to join a game with an invite code (more lenient)
CREATE OR REPLACE FUNCTION join_game_with_code(p_invite_code text, p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_game_id uuid;
  v_game_record record;
  v_normalized_code text := UPPER(TRIM(p_invite_code));
BEGIN
  -- Find the game with the normalized invite code
  SELECT id, status, player1_id, player2_id 
  INTO v_game_record
  FROM games
  WHERE normalized_invite_code = v_normalized_code
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Check if game exists
  IF v_game_record IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'No game found with this invite code',
      'code', v_normalized_code
    );
  END IF;
  
  -- Check if game is in waiting status
  IF v_game_record.status != 'waiting' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'This game is not waiting for players',
      'status', v_game_record.status,
      'game_id', v_game_record.id
    );
  END IF;
  
  -- Update the game with the second player
  UPDATE games
  SET 
    player2_id = p_user_id,
    status = 'active',
    updated_at = NOW()
  WHERE id = v_game_record.id;
  
  -- Return success
  RETURN json_build_object(
    'success', true,
    'game_id', v_game_record.id
  );
END;
$$;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION join_game_with_code TO authenticated, anon;

-- 6. Create an index on the normalized invite code for faster lookups
CREATE INDEX IF NOT EXISTS idx_games_normalized_invite_code ON games (normalized_invite_code);

-- 7. Update the get_game_by_invite_code function to be more resilient
CREATE OR REPLACE FUNCTION get_game_by_invite_code(p_invite_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_game_record record;
  v_normalized_code text := UPPER(TRIM(p_invite_code));
BEGIN
  -- Find the game with the normalized invite code
  SELECT *
  INTO v_game_record
  FROM games
  WHERE normalized_invite_code = v_normalized_code
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Check if game exists
  IF v_game_record IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'No game found with this invite code',
      'code', v_normalized_code
    );
  END IF;
  
  -- Return the game
  RETURN json_build_object(
    'success', true,
    'game', row_to_json(v_game_record)
  );
END;
$$;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION get_game_by_invite_code TO authenticated, anon; 