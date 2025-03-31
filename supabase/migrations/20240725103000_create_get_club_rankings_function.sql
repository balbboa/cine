-- Migration: Create get_club_rankings function
-- Description: Creates a PostgreSQL function to retrieve clubs ranked by their member count.
-- Affected Tables: clubs, club_members
-- Author: Gemini

create or replace function public.get_club_rankings(limit_count int default 50) -- Default limit to 50
returns table (
  id bigint,
  name text,
  description text,
  avatar_url text,
  created_at timestamptz,
  member_count bigint
)
language plpgsql
security invoker -- Run with the permissions of the calling user
set search_path = '' -- Ensure function operates in a controlled environment
as $$
begin
  -- Check if the clubs and club_members tables exist to avoid errors if they don't
  -- This is a basic check; more robust checks might be needed in complex scenarios
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'clubs') or 
     not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'club_members') then
    raise notice 'Required tables (clubs or club_members) do not exist in public schema. Returning empty set.';
    return query select null::bigint, null::text, null::text, null::text, null::timestamptz, null::bigint where false;
    return; 
  end if;

  -- Return the ranked list of clubs
  return query
  select
    c.id,
    c.name,
    c.description,
    c.avatar_url,
    c.created_at,
    count(cm.user_id)::bigint as member_count -- Explicit cast to bigint
  from
    public.clubs c -- Use fully qualified names
  left join
    public.club_members cm on c.id = cm.club_id -- Use fully qualified names
  group by
    c.id, c.name, c.description, c.avatar_url, c.created_at -- Group by all selected non-aggregated columns
  order by
    member_count desc, c.created_at asc -- Order by member count (desc), then creation date (asc)
  limit get_club_rankings.limit_count; -- Apply the limit parameter
end;
$$;

-- Optional: Add a comment to the function for better documentation
comment on function public.get_club_rankings(int) is 'Retrieves a list of clubs ranked by the total number of members, highest first.'; 