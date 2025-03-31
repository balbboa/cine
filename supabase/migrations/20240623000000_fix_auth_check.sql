-- Fix the join_matchmaking function to better handle guest vs. authenticated users
-- The previous version was raising an exception when auth.uid() returned null for non-guest users

-- Create or replace the join_matchmaking function
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
      
      -- Get rating for ranked matches if not provided
      if p_match_type = 'ranked' and p_rating is null then
        select rating into p_rating
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