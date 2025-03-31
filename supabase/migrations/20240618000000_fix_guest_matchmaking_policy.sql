-- Fix RLS policies for matchmaking_queue to properly handle guest users
-- The current policy for guests has an issue with the 'all' operation

-- Drop the existing policy for guests that uses 'all' operation (not recommended)
drop policy if exists "Guests can view and join the queue" on public.matchmaking_queue;

-- Create separate policies for each operation type for guests
create policy "Guests can view the queue" 
on public.matchmaking_queue 
for select 
to anon 
using (is_guest = true);

create policy "Guests can join the queue" 
on public.matchmaking_queue 
for insert 
to anon 
with check (is_guest = true);

create policy "Guests can update their queue entries" 
on public.matchmaking_queue 
for update 
to anon 
using (is_guest = true)
with check (is_guest = true);

create policy "Guests can delete their queue entries" 
on public.matchmaking_queue 
for delete 
to anon 
using (is_guest = true);

-- Update the join_matchmaking function to handle guest users better
create or replace function public.join_matchmaking(
  p_match_type match_type,
  p_is_guest boolean default false,
  p_username text default 'Guest',
  p_rating int default null
)
returns uuid
language plpgsql
security definer -- Change to security definer to bypass RLS
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_entry_id bigint;
begin
  -- Get current user ID for authenticated users
  if not p_is_guest then
    v_user_id := auth.uid();
    
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
  else
    -- For guests, generate a random UUID
    v_user_id := gen_random_uuid();
  end if;
  
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
  
  -- Run the cleanup function to handle any timed-out entries
  perform public.cleanup_matchmaking_queue();
  
  -- Return the user ID
  return v_user_id;
end;
$$; 