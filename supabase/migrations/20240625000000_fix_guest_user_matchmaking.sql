-- Fix matchmaking for guest users
-- The previous approach tried to create entries in the users table for guests,
-- but the users table doesn't have a rating column and requires an email field.
-- Instead, we should use the guest_users table for guest users and properly
-- handle the player1_guest_id and player2_guest_id fields in the games table.

-- First, update the join_matchmaking function to not try to use rating with users table
create or replace function public.join_matchmaking(
  p_match_type match_type,
  p_is_guest boolean default false,
  p_username text default 'Guest',
  p_rating int default null
)
returns uuid
language plpgsql
security definer  -- Using definer to bypass RLS
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_entry_id bigint;
begin
  -- Get current user ID for authenticated users
  if not p_is_guest then
    v_user_id := auth.uid();
    
    -- For authenticated users, we expect a valid user ID
    if v_user_id is null then
      raise notice 'Warning: No authenticated user found but p_is_guest is false. Treating as guest.';
      -- Instead of raising an exception, we'll treat this as a guest
      p_is_guest := true;
      v_user_id := gen_random_uuid();
    else
      -- Get username if not provided
      if p_username = 'Guest' then
        select username into p_username
        from public.users
        where id = v_user_id;
      end if;
    end if;
  end if;
  
  -- If this is a guest or we couldn't get a valid auth.uid()
  if p_is_guest then
    -- For guests, generate a random UUID if we don't have one yet
    if v_user_id is null then
      v_user_id := gen_random_uuid();
    end if;
    
    -- Check if a guest user entry exists, create one if not
    declare
      v_guest_exists boolean;
    begin
      select exists(
        select 1 from public.guest_users where id = v_user_id
      ) into v_guest_exists;
      
      if not v_guest_exists then
        insert into public.guest_users (
          id,
          username,
          last_active,
          created_at
        ) values (
          v_user_id,
          p_username,
          now(),
          now()
        );
        raise notice 'Created new guest user: % (%)', p_username, v_user_id;
      else
        -- Update last active time for existing guest
        update public.guest_users
        set last_active = now(),
            username = p_username
        where id = v_user_id;
      end if;
    end;
  end if;
  
  -- Add debug logging
  raise notice 'Joining matchmaking: user_id=%, match_type=%, is_guest=%, username=%', 
    v_user_id, p_match_type, p_is_guest, p_username;
  
  -- Remove any existing entries for this user
  delete from public.matchmaking_queue
  where user_id = v_user_id
    and status = 'searching';
  
  -- Insert the user into the queue
  insert into public.matchmaking_queue (
    user_id,
    match_type,
    rating,
    is_guest,
    username
  ) values (
    v_user_id,
    p_match_type,
    p_rating,
    p_is_guest,
    p_username
  )
  returning id into v_entry_id;
  
  -- Verify an entry was created
  if v_entry_id is null then
    raise exception 'Failed to insert into matchmaking queue';
  end if;
  
  -- Run the cleanup function to handle any timed-out entries
  perform public.cleanup_matchmaking_queue();
  
  -- Return the user ID
  return v_user_id;
exception
  when others then
    -- Log the error and re-raise
    raise notice 'Error in join_matchmaking: %', SQLERRM;
    raise;
end;
$$;

-- Now, update the match_players function to properly handle guest users
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