-- Add RLS policies for matchmaking_queue table
-- This adds policies to allow both authenticated and anonymous users
-- to insert, read, and delete their own matchmaking queue entries

-- First, ensure RLS is enabled
alter table public.matchmaking_queue enable row level security;

-- Policy for selecting (users can only view their own entries)
create policy "Users can view their own matchmaking entries"
on public.matchmaking_queue
for select
to authenticated, anon
using (auth.uid() = user_id);

-- Policy for inserting (users can add themselves to the queue)
create policy "Users can add themselves to matchmaking queue"
on public.matchmaking_queue
for insert
to authenticated, anon
with check (auth.uid() = user_id);

-- Policy for deleting (users can remove themselves from the queue)
create policy "Users can remove themselves from matchmaking queue"
on public.matchmaking_queue
for delete
to authenticated, anon
using (auth.uid() = user_id);

-- Policy for updating (users can update their own entries)
create policy "Users can update their own matchmaking entries"
on public.matchmaking_queue
for update
to authenticated, anon
using (auth.uid() = user_id)
with check (auth.uid() = user_id); 