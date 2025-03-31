# Supabase Migration Guide

This guide provides best practices for creating and applying database migrations in our Supabase project.

## Migration Workflow

### Creating a New Migration

1. Generate a migration file with the Supabase CLI:
   ```bash
   supabase migration new your_migration_name
   ```

2. Find the newly created migration file in `supabase/migrations/` with a timestamp prefix.

3. Use the template in `supabase/templates/migration_template.sql` as a starting point by copying its content into your new migration file.

4. Replace the placeholders in the template with your actual migration content.

5. Follow the best practices outlined in this guide for writing the migration SQL.

### Applying Migrations

#### Local Development

To apply your migrations to your local development database:

```bash
supabase db reset
```

This resets your local database and applies all migrations from scratch.

#### Production

To apply your migrations to the production database:

```bash
supabase db push
```

## Best Practices

### 1. Always Use Idempotent Migrations

Make migrations that can be run multiple times without errors or unintended side effects:

```sql
-- Instead of:
CREATE TABLE public.todos (id bigint primary key);

-- Use:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'todos'
  ) THEN
    CREATE TABLE public.todos (id bigint primary key);
  END IF;
END $$;
```

### 2. Check for Existing Objects Before Creating/Altering

When creating or modifying database objects, always check if they exist first:

```sql
-- Tables
IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'table_name') THEN
  -- Create table
END IF;

-- Columns
IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'table_name' AND column_name = 'column_name') THEN
  -- Add column
END IF;

-- Policies
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'table_name' AND policyname = 'policy_name') THEN
  -- Create policy
END IF;

-- Triggers
IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_name' AND tgrelid = 'public.table_name'::regclass) THEN
  -- Create trigger
END IF;
```

### 3. Handle Row Level Security (RLS) Properly

Always enable RLS for tables and create proper policies:

```sql
-- Enable RLS
ALTER TABLE public.table_name ENABLE ROW LEVEL SECURITY;

-- Create policies safely
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'table_name' AND policyname = 'Users can view their data') THEN
    CREATE POLICY "Users can view their data" ON public.table_name
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);
  END IF;
END $$;
```

### 4. Use CREATE OR REPLACE for Functions

For functions, use `CREATE OR REPLACE` pattern:

```sql
CREATE OR REPLACE FUNCTION public.my_function(param1 text, param2 integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  -- Function logic
END;
$$;
```

### 5. Add Comments to Objects

Document your database objects:

```sql
COMMENT ON TABLE public.todos IS 'Todo items for users';
COMMENT ON FUNCTION public.my_function(text, integer) IS 'Brief description of what the function does';
```

### 6. Refresh PostgREST Schema Cache

At the end of each migration, add this command to refresh the schema cache:

```sql
SELECT pg_notify('pgrst', 'reload schema');
```

### 7. Set Proper Constraints and Indexes

Always add appropriate constraints and indexes for performance and data integrity:

```sql
-- Primary keys
CREATE TABLE public.todos (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  -- other columns
);

-- Foreign keys
ALTER TABLE public.todo_items 
ADD CONSTRAINT todo_items_todo_id_fkey 
FOREIGN KEY (todo_id) REFERENCES public.todos(id) ON DELETE CASCADE;

-- Indexes for commonly queried columns
CREATE INDEX IF NOT EXISTS idx_todos_user_id ON public.todos(user_id);
```

### 8. Handling Migration Errors

If `supabase db push` fails:

1. Check the error message carefully
2. Fix the issue in your migration (typically by adding existence checks)
3. Create a new migration that addresses the issue
4. For critical issues, use the baseline approach as documented in `20250330200000_migration_baseline.sql`

## Troubleshooting

### Reset Migration State

If migrations get out of sync between local and production:

```sql
-- Create a baseline migration that:
-- 1. Truncates the migration tracking table
-- 2. Re-adds entries for all existing migrations
-- 3. Makes specific fixes to address any issues

-- See supabase/migrations/20250330200000_migration_baseline.sql for an example
```

### Testing Migrations Locally

Always test your migrations locally before pushing to production:

```bash
supabase db reset
```

## Resources

- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/) 