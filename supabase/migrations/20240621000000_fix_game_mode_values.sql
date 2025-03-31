-- Fix the match_players function to use the exact valid game_mode values
-- The check constraint shows only 'online' and 'ranked' are valid values

-- Update the match_players function with correct game_mode values
create or replace function public.match_players()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  potential_match record;
  new_game_id uuid;
  match_found boolean := false;
  v_game_mode text;
begin
  -- Only proceed if this is a new entry or status changed to 'searching'
  if (TG_OP = 'INSERT' or (TG_OP = 'UPDATE' and new.status = 'searching')) then
    -- Find a potential match based on match type
    -- For quick match, just find the oldest player in the queue
    -- For ranked match, find someone with a similar rating
    if new.match_type = 'quick' then
      select * into potential_match
      from public.matchmaking_queue
      where status = 'searching'
        and match_type = new.match_type
        and id != new.id
        and (matched_with is null)
      order by joined_at asc
      limit 1;
      v_game_mode := 'online'; -- Using 'online' for quick matches - VERIFIED VALID VALUE
    else
      -- For ranked matches, find a player with a similar rating
      -- The longer they've been waiting, the wider the rating range becomes
      select * into potential_match
      from public.matchmaking_queue
      where status = 'searching'
        and match_type = new.match_type
        and id != new.id
        and (matched_with is null)
        and (
          abs(coalesce(rating, 1000) - coalesce(new.rating, 1000)) <= 
          -- Increase rating tolerance based on wait time (10 points per second, up to 300)
          least(300, (extract(epoch from (now() - joined_at)) * 10)::int)
        )
      order by joined_at asc
      limit 1;
      v_game_mode := 'ranked'; -- Using 'ranked' for ranked matches - VERIFIED VALID VALUE
    end if;
    
    -- If we found a match, create a game and update both records
    if potential_match.id is not null then
      -- Create a new game with the correct game_mode values
      insert into public.games (
        status,
        player1_id,
        player2_id,
        game_mode           -- Set this to a valid enum value from the check constraint
      ) values (
        'waiting',
        potential_match.user_id,
        new.user_id,
        v_game_mode         -- Either 'online' or 'ranked' as verified by the check constraint
      )
      returning id into new_game_id;
      
      -- Update both players' records
      update public.matchmaking_queue
      set status = 'found',
          matched_with = new.user_id,
          game_id = new_game_id,
          updated_at = now()
      where id = potential_match.id;
      
      -- Update the current player's record
      new.status := 'found';
      new.matched_with := potential_match.user_id;
      new.game_id := new_game_id;
      new.updated_at := now();
      
      match_found := true;
    end if;
  end if;
  
  return new;
end;
$$; 