-- Migration to create the club_join_requests table and add is_owner to club_members
-- Following standards from scripts/code-format-sql.md and scripts/database-create-migration.md

-- First, add is_owner column to club_members table if it doesn't exist
do $$
begin
    if not exists (
        select from information_schema.columns 
        where table_name = 'club_members' and column_name = 'is_owner'
    ) then
        alter table public.club_members add column is_owner boolean not null default false;
        comment on column public.club_members.is_owner is 'Whether this member is an owner/admin of the club';
    end if;
end $$;

-- Create the club_join_requests table
create table if not exists public.club_join_requests (
    id bigint generated always as identity primary key,
    club_id bigint not null references public.clubs(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    message text null,
    status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    
    -- Constraints
    constraint user_can_only_request_once unique (club_id, user_id)
);

-- Create indexes for better performance
create index if not exists idx_club_join_requests_club_id on public.club_join_requests(club_id);
create index if not exists idx_club_join_requests_user_id on public.club_join_requests(user_id);
create index if not exists idx_club_join_requests_status on public.club_join_requests(status);

-- Add comments to the table and columns
comment on table public.club_join_requests is 'Tracks user requests to join clubs';
comment on column public.club_join_requests.id is 'Unique identifier for the join request';
comment on column public.club_join_requests.club_id is 'The club the user wants to join';
comment on column public.club_join_requests.user_id is 'The user requesting to join';
comment on column public.club_join_requests.message is 'Optional message from the user with the request';
comment on column public.club_join_requests.status is 'The current status of the join request (pending, accepted, rejected)';
comment on column public.club_join_requests.created_at is 'When the join request was created';
comment on column public.club_join_requests.updated_at is 'When the join request was last updated';

-- Enable Row Level Security (RLS)
alter table public.club_join_requests enable row level security;

-- Create RLS policies for club_join_requests

-- Policy 1: Club owners can see pending requests for their clubs
create policy "Club owners can view requests"
on public.club_join_requests
for select
to authenticated
using (
    exists (
        select 1
        from public.club_members cm
        where cm.club_id = club_join_requests.club_id
        and cm.user_id = auth.uid()
        and cm.is_owner = true
    )
);

-- Policy 2: Users can see their own requests
create policy "Users can view their own requests"
on public.club_join_requests
for select
to authenticated
using (
    user_id = auth.uid()
);

-- Policy 3: Authenticated users can insert their own requests
create policy "Users can insert their own requests"
on public.club_join_requests
for insert
to authenticated
with check (
    user_id = auth.uid()
    -- Prevent requesting for a club they're already in
    and not exists (
        select 1 
        from public.club_members cm
        where cm.club_id = club_join_requests.club_id
        and cm.user_id = auth.uid()
    )
);

-- Policy 4: Club owners can update the status of requests for their clubs
create policy "Club owners can update request status"
on public.club_join_requests
for update
to authenticated
using (
    exists (
        select 1
        from public.club_members cm
        where cm.club_id = club_join_requests.club_id
        and cm.user_id = auth.uid()
        and cm.is_owner = true
    )
)
with check (
    status in ('accepted', 'rejected') -- Only allow changing to accepted/rejected
);

-- Policy 5: Users can delete their pending requests
create policy "Users can delete their pending requests"
on public.club_join_requests
for delete
to authenticated
using (
    user_id = auth.uid() 
    and status = 'pending'
);

-- Create DB functions for club join requests
-- First drop existing functions to avoid return type conflicts

-- Drop existing function if it exists (create_club_join_request)
drop function if exists public.create_club_join_request(bigint, uuid, text);

-- Function to create a join request
create or replace function public.create_club_join_request(
    p_club_id bigint,
    p_user_id uuid,
    p_message text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_result jsonb;
begin
    -- Check if user is already a member
    if exists (
        select 1 
        from public.club_members 
        where club_id = p_club_id 
        and user_id = p_user_id
    ) then
        return jsonb_build_object(
            'success', false,
            'message', 'You are already a member of this club'
        );
    end if;

    -- Check if there's already a pending request
    if exists (
        select 1 
        from public.club_join_requests 
        where club_id = p_club_id 
        and user_id = p_user_id 
        and status = 'pending'
    ) then
        return jsonb_build_object(
            'success', false,
            'message', 'You already have a pending request to join this club'
        );
    end if;

    -- Insert the join request
    insert into public.club_join_requests (club_id, user_id, message)
    values (p_club_id, p_user_id, p_message)
    returning id into v_result;

    return jsonb_build_object(
        'success', true,
        'request_id', v_result,
        'message', 'Join request submitted successfully'
    );
end;
$$;

-- Drop existing function if it exists (respond_to_club_join_request)
drop function if exists public.respond_to_club_join_request(bigint, boolean);

-- Function to respond to a join request
create or replace function public.respond_to_club_join_request(
    p_request_id bigint,
    p_accept boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_club_id bigint;
    v_user_id uuid;
    v_status text;
begin
    -- Check if request exists and get info
    select club_id, user_id, status
    into v_club_id, v_user_id, v_status
    from public.club_join_requests
    where id = p_request_id;

    if not found then
        return jsonb_build_object(
            'success', false,
            'message', 'Join request not found'
        );
    end if;

    -- Check if request is still pending
    if v_status != 'pending' then
        return jsonb_build_object(
            'success', false,
            'message', 'This request has already been ' || v_status
        );
    end if;

    -- Check if user is club owner
    if not exists (
        select 1 
        from public.club_members 
        where club_id = v_club_id 
        and user_id = auth.uid() 
        and is_owner = true
    ) then
        return jsonb_build_object(
            'success', false,
            'message', 'Only club owners can respond to join requests'
        );
    end if;

    -- Update status based on acceptance
    update public.club_join_requests
    set 
        status = case when p_accept then 'accepted' else 'rejected' end,
        updated_at = now()
    where id = p_request_id;

    -- If accepted, add user to club
    if p_accept then
        insert into public.club_members (club_id, user_id, is_owner)
        values (v_club_id, v_user_id, false)
        on conflict (club_id, user_id) do nothing;
    end if;

    return jsonb_build_object(
        'success', true,
        'message', 'Request ' || case when p_accept then 'accepted' else 'rejected' end || ' successfully'
    );
end;
$$;

-- Drop existing function if it exists (get_club_join_requests)
drop function if exists public.get_club_join_requests(bigint);

-- Function to get club join requests with user details
create or replace function public.get_club_join_requests(
    p_club_id bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_requests jsonb;
begin
    -- Check if current user is club owner
    if not exists (
        select 1 
        from public.club_members 
        where club_id = p_club_id 
        and user_id = auth.uid() 
        and is_owner = true
    ) then
        return jsonb_build_object(
            'success', false,
            'message', 'Only club owners can view join requests'
        );
    end if;

    -- Get pending requests with user details
    select jsonb_agg(
        jsonb_build_object(
            'id', r.id,
            'club_id', r.club_id,
            'user_id', r.user_id,
            'status', r.status,
            'message', r.message,
            'created_at', r.created_at,
            'updated_at', r.updated_at,
            'username', u.username,
            'avatar_url', u.avatar_url
        )
    )
    into v_requests
    from public.club_join_requests r
    join public.users u on r.user_id = u.id
    where r.club_id = p_club_id
    and r.status = 'pending'
    order by r.created_at desc;

    return coalesce(v_requests, '[]'::jsonb);
end;
$$;

-- Drop existing function if it exists (create_guild_with_membership)
drop function if exists public.create_guild_with_membership(text, text, uuid);

-- Update create_guild_with_membership function to set is_owner properly
create or replace function create_guild_with_membership(
    club_name text,
    club_description text,
    creator_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_club_id bigint;
    v_user_credits int;
    v_creation_cost int := 2000; -- Cost in credits to create a club
begin
    -- Check if user has enough credits
    select credits into v_user_credits from public.users where id = creator_id;
    
    if v_user_credits < v_creation_cost then
        return jsonb_build_object(
            'success', false, 
            'message', format('Not enough credits. Club creation costs %s credits, you have %s.', v_creation_cost, v_user_credits)
        );
    end if;
    
    -- Create the club
    insert into public.clubs (name, description)
    values (club_name, club_description)
    returning id into v_club_id;
    
    -- Add creator as member with owner status
    insert into public.club_members (club_id, user_id, is_owner)
    values (v_club_id, creator_id, true);
    
    -- Deduct credits from user
    update public.users
    set credits = credits - v_creation_cost
    where id = creator_id;
    
    return jsonb_build_object(
        'success', true, 
        'club_id', v_club_id,
        'message', 'Club created successfully'
    );
end;
$$;

-- Create function to update club details
create or replace function public.update_club_details(
    p_club_id bigint,
    p_name text,
    p_description text default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
    -- Check if user is club owner
    if not exists (
        select 1 
        from public.club_members 
        where club_id = p_club_id 
        and user_id = auth.uid() 
        and is_owner = true
    ) then
        raise exception 'Only club owners can update club details';
    end if;

    -- Update club details
    update public.clubs
    set 
        name = p_name,
        description = p_description
    where id = p_club_id;

    return true;
end;
$$; 