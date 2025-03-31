-- Fix the match_players function to use the correct column names in the games table
-- The current function refers to player_x_id and player_o_id but the actual columns are player1_id and player2_id

-- Replace the match_players function with the corrected version
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
    end if;
    
    -- If we found a match, create a game and update both records
    if potential_match.id is not null then
      -- Create a new game
      insert into public.games (
        status,
        player1_id,         -- Changed from player_x_id
        player2_id,         -- Changed from player_o_id
        game_mode           -- Changed from is_ranked to game_mode
      ) values (
        'waiting',          -- Assuming the status enum still has 'waiting'
        potential_match.user_id,
        new.user_id,
        case               -- Set game_mode based on match_type
          when new.match_type = 'ranked' then 'ranked'
          else 'quick'
        end
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