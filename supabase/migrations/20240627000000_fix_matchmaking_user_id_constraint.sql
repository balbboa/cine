-- Fix the user_id constraint in matchmaking_queue for guest users
-- Similar to the matched_with column, user_id also has a foreign key constraint requiring the ID to exist
-- in the users table, but guest users don't have entries there

-- Drop the existing foreign key constraint on user_id
alter table public.matchmaking_queue
drop constraint if exists matchmaking_queue_user_id_fkey;

-- Create a new validation function for user_id
create or replace function public.validate_matchmaking_user_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- If user_id is NULL, that's not valid for this column
  if new.user_id is null then
    raise exception 'user_id cannot be null in matchmaking_queue';
  end if;
  
  -- Check if the ID exists in either users or guest_users
  if exists (select 1 from public.users where id = new.user_id) or
     exists (select 1 from public.guest_users where id = new.user_id) then
    return new;
  else
    raise exception 'Invalid user_id value: %. ID must exist in users or guest_users table', new.user_id;
  end if;
end;
$$;

-- Create a trigger to validate user_id values
drop trigger if exists validate_matchmaking_user_id_trigger on public.matchmaking_queue;
create trigger validate_matchmaking_user_id_trigger
before insert or update of user_id on public.matchmaking_queue
for each row
execute function public.validate_matchmaking_user_id();

-- Update the join_matchmaking function to create guest users entries properly
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
    
    -- Ensure the guest user exists in the guest_users table
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
  -- With our new trigger, this will work for both guest and regular users
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