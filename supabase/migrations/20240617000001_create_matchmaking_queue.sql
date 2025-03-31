-- Create matchmaking queue table for real-time matchmaking across devices/browsers
-- This replaces the previous in-memory implementation with a persistent solution

-- Create enum for match types
create type public.match_type as enum ('quick', 'ranked');

-- Create enum for matchmaking status
create type public.matchmaking_status as enum ('searching', 'found', 'error', 'timeout');

-- Create the matchmaking_queue table
create table public.matchmaking_queue (
  id bigint generated always as identity primary key,
  user_id uuid references public.users(id) on delete cascade,
  match_type match_type not null,
  status matchmaking_status not null default 'searching',
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  rating int,
  is_guest boolean not null default false,
  username text not null,
  matched_with uuid references public.users(id),
  game_id uuid references public.games(id),
  search_timeout_at timestamptz not null default (now() + interval '2 minutes')
);
comment on table public.matchmaking_queue is 'Tracks users waiting to be matched in quick or ranked games';

-- Add indexes for performance
create index idx_matchmaking_queue_user_id on public.matchmaking_queue(user_id);
create index idx_matchmaking_queue_status on public.matchmaking_queue(status);
create index idx_matchmaking_queue_match_type on public.matchmaking_queue(match_type);
create index idx_matchmaking_queue_joined_at on public.matchmaking_queue(joined_at);
create index idx_matchmaking_queue_search_timeout on public.matchmaking_queue(search_timeout_at);

-- Add a function to update the updated_at timestamp
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Add trigger to update the updated_at column
create trigger update_matchmaking_queue_updated_at
before update on public.matchmaking_queue
for each row
execute function public.update_updated_at_column();

-- Add trigger function to automatically match players
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
        player_x_id,
        player_o_id,
        current_player,
        is_ranked
      ) values (
        'waiting'::game_status,
        potential_match.user_id,
        new.user_id,
        'x',
        new.match_type = 'ranked'
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

-- Add the trigger to run after insert or update
create trigger match_players_trigger
before insert or update on public.matchmaking_queue
for each row
execute function public.match_players();

-- Add cleanup function to remove stale entries
create or replace function public.cleanup_matchmaking_queue()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Mark timed out entries
  update public.matchmaking_queue
  set status = 'timeout',
      updated_at = now()
  where status = 'searching'
    and search_timeout_at < now();
    
  -- Delete entries older than 1 hour
  delete from public.matchmaking_queue
  where joined_at < now() - interval '1 hour';
end;
$$;

-- Instead of using pg_cron, we'll create a function that applications should call periodically
-- This function will check and clean up any timed-out matches
-- Applications should call this function through a separate cron job or at regular intervals
comment on function public.cleanup_matchmaking_queue() is 'Call this function periodically via application code or an external scheduler to clean up timed-out matchmaking entries';

-- Enable Row-Level Security
alter table public.matchmaking_queue enable row level security;

-- Policies for matchmaking_queue
create policy "Users can view their own queue entries" 
on public.matchmaking_queue 
for select 
to authenticated 
using (auth.uid() = user_id);

create policy "Users can insert themselves into the queue" 
on public.matchmaking_queue 
for insert 
to authenticated 
with check (auth.uid() = user_id);

create policy "Users can update their own queue entries" 
on public.matchmaking_queue 
for update 
to authenticated 
using (auth.uid() = user_id);

create policy "Users can delete their own queue entries" 
on public.matchmaking_queue 
for delete 
to authenticated 
using (auth.uid() = user_id);

-- Allow anonymous access for guests
create policy "Guests can view and join the queue" 
on public.matchmaking_queue 
for all 
to anon 
using (is_guest = true);

-- Add basic functions to interact with the queue
create or replace function public.join_matchmaking(
  p_match_type match_type,
  p_is_guest boolean default false,
  p_username text default 'Guest',
  p_rating int default null
)
returns uuid
language plpgsql
security invoker
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
  -- This helps ensure cleanup runs regularly even without a dedicated cron job
  perform public.cleanup_matchmaking_queue();
  
  -- Return the user ID
  return v_user_id;
end;
$$;

create or replace function public.leave_matchmaking(p_user_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rows_affected int;
begin
  -- Remove user from queue
  delete from public.matchmaking_queue
  where user_id = p_user_id
    and status = 'searching'
  returning 1 into v_rows_affected;
  
  return v_rows_affected > 0;
end;
$$;

create or replace function public.get_matchmaking_status(p_user_id uuid)
returns json
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_result record;
begin
  -- Get current status
  select 
    status,
    match_type,
    joined_at,
    updated_at,
    matched_with,
    game_id
  into v_result
  from public.matchmaking_queue
  where user_id = p_user_id
  order by updated_at desc
  limit 1;
  
  if not found then
    return json_build_object(
      'status', 'idle',
      'in_queue', false
    );
  end if;
  
  return json_build_object(
    'status', v_result.status,
    'match_type', v_result.match_type,
    'joined_at', v_result.joined_at,
    'updated_at', v_result.updated_at,
    'in_queue', true,
    'matched_with', v_result.matched_with,
    'game_id', v_result.game_id
  );
end;
$$;

create or replace function public.get_pool_size(p_match_type match_type)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count int;
begin
  -- Run the cleanup function to ensure accurate count
  perform public.cleanup_matchmaking_queue();
  
  -- Count active entries
  select count(*)
  into v_count
  from public.matchmaking_queue
  where match_type = p_match_type
    and status = 'searching';
    
  return v_count;
end;
$$; 