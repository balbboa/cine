-- Migration to add updated_at timestamp column to clubs table
-- This resolves the error: "record 'new' has no field 'updated_at'"

-- Add updated_at column with default current timestamp
alter table public.clubs
  add column updated_at timestamptz not null default now();

-- Create or replace trigger to automatically update the updated_at column
create or replace function public.handle_updated_at()
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

-- Add trigger to automatically update the updated_at column on update
drop trigger if exists set_clubs_updated_at on public.clubs;
create trigger set_clubs_updated_at
  before update on public.clubs
  for each row
  execute function public.handle_updated_at(); 