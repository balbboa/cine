-- Fix the matchmaking_queue constraints to handle guest users
-- Current issue: the matched_with column has a foreign key constraint requiring the ID to exist in users table,
-- but guest users don't have entries in the users table

-- First, drop the existing foreign key constraint
alter table public.matchmaking_queue
drop constraint if exists matchmaking_queue_matched_with_fkey;

-- Create a new function to validate match_with values
-- This function will check if the ID exists in either users or guest_users table
create or replace function public.validate_matched_with()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- If matched_with is NULL, that's valid
  if new.matched_with is null then
    return new;
  end if;
  
  -- Check if the ID exists in either users or guest_users
  if exists (select 1 from public.users where id = new.matched_with) or
     exists (select 1 from public.guest_users where id = new.matched_with) then
    return new;
  else
    raise exception 'Invalid matched_with value: %. ID must exist in users or guest_users table', new.matched_with;
  end if;
end;
$$;

-- Create a trigger to validate matched_with values
drop trigger if exists validate_matched_with_trigger on public.matchmaking_queue;
create trigger validate_matched_with_trigger
before insert or update of matched_with on public.matchmaking_queue
for each row
execute function public.validate_matched_with();

-- Update the match_players function to handle guest users correctly
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
      -- Create a new game with guest/user IDs in the appropriate columns
      insert into public.games (
        status,
        game_mode,
        -- Set player IDs based on guest status
        player1_id,
        player1_guest_id,
        player1_display_name,
        player2_id,
        player2_guest_id,
        player2_display_name
      ) values (
        'waiting',
        v_game_mode,
        -- Player 1 (potential_match)
        case when not potential_match.is_guest then potential_match.user_id else null end,
        case when potential_match.is_guest then potential_match.user_id else null end,
        potential_match.username,
        -- Player 2 (new)
        case when not new.is_guest then new.user_id else null end,
        case when new.is_guest then new.user_id else null end,
        new.username
      )
      returning id into new_game_id;
      
      -- Update both players' records
      -- Since we now use the validate_matched_with trigger, this update should succeed
      -- even when setting matched_with to a guest user ID
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
      
      raise notice 'Match found: game_id=%, player1=%, player2=%, is_guest1=%, is_guest2=%',
        new_game_id, potential_match.user_id, new.user_id, potential_match.is_guest, new.is_guest;
    end if;
  end if;
  
  return new;
exception
  when others then
    raise notice 'Error in match_players: %', SQLERRM;
    raise;
end;
$$; 