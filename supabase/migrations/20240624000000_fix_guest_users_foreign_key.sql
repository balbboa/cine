-- Fix the match_players function to handle guest users properly
-- The current implementation tries to insert records in the games table with foreign keys to non-existent users

-- Update the match_players function to create temporary users for guests
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
  temp_player1_id uuid;
  temp_player2_id uuid;
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
      -- Handle player1 (potential_match) - Create temporary user if it's a guest
      if potential_match.is_guest then
        -- Check if a temporary user already exists
        select id into temp_player1_id
        from public.users
        where id = potential_match.user_id;
        
        -- If no temporary user exists, create one
        if temp_player1_id is null then
          insert into public.users (
            id,
            username,
            rating,
            is_guest,
            created_at,
            updated_at
          ) values (
            potential_match.user_id,
            potential_match.username,
            potential_match.rating,
            true,
            now(),
            now()
          )
          returning id into temp_player1_id;
          
          raise notice 'Created temporary user for player1: %', temp_player1_id;
        end if;
      else
        temp_player1_id := potential_match.user_id;
      end if;
      
      -- Handle player2 (new) - Create temporary user if it's a guest
      if new.is_guest then
        -- Check if a temporary user already exists
        select id into temp_player2_id
        from public.users
        where id = new.user_id;
        
        -- If no temporary user exists, create one
        if temp_player2_id is null then
          insert into public.users (
            id,
            username,
            rating,
            is_guest,
            created_at,
            updated_at
          ) values (
            new.user_id,
            new.username,
            new.rating,
            true,
            now(),
            now()
          )
          returning id into temp_player2_id;
          
          raise notice 'Created temporary user for player2: %', temp_player2_id;
        end if;
      else
        temp_player2_id := new.user_id;
      end if;
      
      -- Create a new game with the correct player IDs
      insert into public.games (
        status,
        player1_id,
        player2_id,
        game_mode
      ) values (
        'waiting',
        temp_player1_id,
        temp_player2_id,
        v_game_mode
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
exception
  when others then
    raise notice 'Error in match_players: %', SQLERRM;
    raise;
end;
$$; 