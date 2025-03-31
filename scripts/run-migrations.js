#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase client
function initClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Error: Supabase environment variables are missing');
    process.exit(1);
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

// Migration handler
async function runMigrations() {
  const supabase = initClient();
  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
  
  // Create migrations directory if it doesn't exist
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }

  console.log('Checking for migrations table...');
  
  // Check if migrations table exists, create if not
  try {
    const { error } = await supabase.rpc('create_migrations_table_if_not_exists');
    
    if (error) {
      // If the RPC function doesn't exist, create the migrations table manually
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS public.migrations (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        );
        
        -- Add RLS policies for migrations table
        ALTER TABLE public.migrations ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Migrations are viewable by everyone" 
          ON public.migrations FOR SELECT USING (true);
          
        CREATE POLICY "Service role can insert migrations" 
          ON public.migrations FOR INSERT WITH CHECK (true);
      `;
      
      console.log('Creating migrations table...');
      console.log('Please run the following SQL in your Supabase SQL Editor:');
      console.log('-----------------------------------------------------------');
      console.log(createTableSQL);
      console.log('-----------------------------------------------------------');
      console.log('After running the SQL, run this script again.');
      return;
    }
  } catch (err) {
    // If the function doesn't exist yet, just continue
    console.log('Need to create migrations table manually (first-time setup)');
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS public.migrations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );
      
      -- Add RLS policies for migrations table
      ALTER TABLE public.migrations ENABLE ROW LEVEL SECURITY;
      
      CREATE POLICY "Migrations are viewable by everyone" 
        ON public.migrations FOR SELECT USING (true);
        
      CREATE POLICY "Service role can insert migrations" 
        ON public.migrations FOR INSERT WITH CHECK (true);
        
      -- Create helper function for migrations
      CREATE OR REPLACE FUNCTION create_migrations_table_if_not_exists()
      RETURNS void AS $$
      BEGIN
        -- This function exists simply to check if the migrations infrastructure is set up
        -- The actual table creation is done in the initial migration
      END;
      $$ LANGUAGE plpgsql;
    `;
    
    console.log('Please run the following SQL in your Supabase SQL Editor:');
    console.log('-----------------------------------------------------------');
    console.log(createTableSQL);
    console.log('-----------------------------------------------------------');
    console.log('After running the SQL, run this script again.');
    return;
  }

  // Get applied migrations
  const { data: appliedMigrations, error: fetchError } = await supabase
    .from('migrations')
    .select('name')
    .order('name', { ascending: true });

  if (fetchError) {
    console.error('Error fetching applied migrations:', fetchError);
    return;
  }

  const appliedMigrationNames = appliedMigrations.map(m => m.name);
  console.log('Applied migrations:', appliedMigrationNames.length ? appliedMigrationNames : 'None');

  // Get all migration files
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  // Find migrations that haven't been applied
  const pendingMigrations = migrationFiles.filter(f => !appliedMigrationNames.includes(f));

  if (pendingMigrations.length === 0) {
    console.log('No pending migrations to apply.');
    return;
  }

  console.log('Pending migrations:', pendingMigrations);
  console.log('\nPlease run the following migrations manually in your Supabase SQL Editor in this order:');
  
  // Process each pending migration
  for (const migrationFile of pendingMigrations) {
    const migrationPath = path.join(migrationsDir, migrationFile);
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('\n-----------------------------------------------------------');
    console.log(`Migration: ${migrationFile}`);
    console.log('-----------------------------------------------------------');
    console.log(migrationSQL);
    console.log('-----------------------------------------------------------');
    console.log('\nAfter running the migration, mark it as applied with:');
    console.log(`INSERT INTO public.migrations (name) VALUES ('${migrationFile}');`);
    console.log('-----------------------------------------------------------\n');
  }
}

// Run the migration process
runMigrations().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
}); 