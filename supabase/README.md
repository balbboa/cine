# Supabase Setup Instructions

## How to Fix Permission Errors

The app is experiencing permission errors due to Row Level Security (RLS) policies in Supabase. To fix these issues:

1. Log in to your Supabase account at https://app.supabase.com
2. Select your project "cine-tac-toe"
3. Go to the SQL Editor in the left sidebar
4. Create a new query
5. Copy the contents of the `fix-permissions.sql` file in this directory
6. Run the SQL commands

This will:
- Enable Row Level Security on necessary tables
- Create appropriate policies to allow authenticated and anonymous users to view data
- Create policies that allow users to modify their own data
- Fix the 403 Forbidden errors you're seeing in the app

## Project Settings

Your current Supabase project settings (already in your .env file):

```
NEXT_PUBLIC_SUPABASE_URL=https://chctgzvwqyjoeuyvqkqw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Local Development with Supabase CLI

If you still want to set up local development with Supabase CLI later:

1. Make sure Docker Desktop is running and properly configured
2. Install the Supabase CLI: `npm install -g supabase`
3. Initialize Supabase: `supabase init`
4. Start Supabase locally: `supabase start`

This will create a local Supabase instance with all your tables and data, allowing you to develop without affecting your production data.

## Common Issues

- **Permission Denied Errors**: This happens when Row Level Security policies are enabled but not properly configured. The SQL script above fixes this.
- **Docker Connection Errors**: If you're running Supabase locally and see Docker connection errors, make sure Docker Desktop is running and properly configured to expose the Docker daemon on tcp://localhost:2375.
- **Authentication Issues**: Make sure your JWT token is properly configured in the Supabase dashboard under Authentication > Settings.

## Further Resources

- [Supabase Row Level Security Documentation](https://supabase.io/docs/guides/auth/row-level-security)
- [Supabase CLI Documentation](https://supabase.io/docs/reference/cli) 