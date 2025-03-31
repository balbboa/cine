alter table "public"."games" alter column "player1_id" set not null;

CREATE INDEX idx_club_members_club ON public.club_members USING btree (club_id);

CREATE INDEX idx_club_members_user ON public.club_members USING btree (user_id);

CREATE INDEX idx_friendships_friend ON public.friendships USING btree (friend_id);

CREATE INDEX idx_friendships_user ON public.friendships USING btree (user_id);

CREATE INDEX idx_game_moves_game ON public.game_moves USING btree (game_id);

CREATE INDEX idx_games_player1 ON public.games USING btree (player1_id);

CREATE INDEX idx_games_player2 ON public.games USING btree (player2_id);

CREATE INDEX idx_user_badges_user ON public.user_badges USING btree (user_id);

CREATE INDEX idx_user_inventory_user ON public.user_inventory USING btree (user_id);

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.handle_game_move()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Update the board state (simplified representation)
  UPDATE public.games
  SET board_state = jsonb_set(
    COALESCE(board_state, '{}'::jsonb),
    ARRAY[NEW.row::text, NEW.col::text],
    to_jsonb(jsonb_build_object('user_id', NEW.user_id, 'movie', NEW.movie))
  )
  WHERE id = NEW.game_id;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.users (id, username, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)), NEW.email);
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_user_xp(user_id_param uuid, xp_to_add integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  current_user_data RECORD;
  new_xp INTEGER;
  new_level INTEGER;
  new_xp_to_next_level INTEGER;
BEGIN
  -- Get current user data
  SELECT xp, level, xp_to_next_level INTO current_user_data 
  FROM public.users WHERE id = user_id_param;
  
  -- Calculate new XP and check for level up
  new_xp := current_user_data.xp + xp_to_add;
  new_level := current_user_data.level;
  new_xp_to_next_level := current_user_data.xp_to_next_level;
  
  -- Check if user should level up
  WHILE new_xp >= new_xp_to_next_level LOOP
    new_xp := new_xp - new_xp_to_next_level;
    new_level := new_level + 1;
    new_xp_to_next_level := new_xp_to_next_level * 1.5::INTEGER;
  END LOOP;
  
  -- Update user
  UPDATE public.users 
  SET 
    xp = new_xp,
    level = new_level,
    xp_to_next_level = new_xp_to_next_level
  WHERE id = user_id_param;
END;
$function$
;

CREATE TRIGGER on_game_move_inserted AFTER INSERT ON public.game_moves FOR EACH ROW EXECUTE FUNCTION handle_game_move();


