-- Fix the match_players function to correctly store guest user IDs
-- Currently, when creating games with guest users, the IDs aren't properly stored in the player1_guest_id
-- and player2_guest_id fields, causing issues with player identification

-- Update the match_players function to correctly handle guest user IDs
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
      v_game_mode := 'online'; -- Using 'online' for quick matches
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
      v_game_mode := 'ranked'; -- Using 'ranked' for ranked matches
    end if;
    
    -- If we found a match, create a game and update both records
    if potential_match.id is not null then
      -- Create a new game with proper player ID assignment based on guest status
      insert into public.games (
        status,
        game_mode,
        -- Player 1 (potential_match)
        player1_id,
        player1_guest_id,
        player1_display_name,
        -- Player 2 (new)
        player2_id,
        player2_guest_id,
        player2_display_name
      ) values (
        'waiting',
        v_game_mode,
        -- If potential_match is NOT a guest, set player1_id
        CASE WHEN NOT potential_match.is_guest THEN potential_match.user_id ELSE NULL END,
        -- If potential_match IS a guest, set player1_guest_id
        CASE WHEN potential_match.is_guest THEN potential_match.user_id ELSE NULL END,
        potential_match.username,
        -- If new is NOT a guest, set player2_id
        CASE WHEN NOT new.is_guest THEN new.user_id ELSE NULL END,
        -- If new IS a guest, set player2_guest_id
        CASE WHEN new.is_guest THEN new.user_id ELSE NULL END,
        new.username
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
      
      raise notice 'Match found! Game ID: %, Player1: % (guest: %), Player2: % (guest: %)', 
        new_game_id, 
        potential_match.user_id, 
        potential_match.is_guest,
        new.user_id,
        new.is_guest;
    end if;
  end if;
  
  return new;
exception
  when others then
    raise notice 'Error in match_players: %', SQLERRM;
    raise;
end;
$$; 