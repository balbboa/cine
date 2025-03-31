#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function main() {
  // Validate environment variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('Error: NEXT_PUBLIC_SUPABASE_URL is not defined in .env.local');
    process.exit(1);
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('Error: NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined in .env.local');
    process.exit(1);
  }

  console.log('Setting up Supabase database...');
  
  // Create Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  console.log(`Connected to Supabase at ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
  console.log('To execute the SQL migration, you need to:');
  console.log('1. Go to your Supabase dashboard at https://app.supabase.com');
  console.log('2. Open your project and navigate to the SQL Editor');
  console.log('3. Copy and paste the SQL from the supabase/setup.sql file');
  console.log('4. Run the SQL query');
  
  // Read SQL file path for user reference
  const sqlPath = path.join(__dirname, '..', 'supabase', 'setup.sql');
  console.log(`\nSQL file location: ${sqlPath}`);
  
  // For safety, don't attempt to execute SQL directly via the client
  // as Supabase JS client doesn't provide a reliable way to execute
  // arbitrary SQL statements.
  
  try {
    // Check connection by executing a simple query
    const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true });
    
    if (error) {
      if (error.code === 'PGRST104') {
        console.log('\nThe "users" table does not exist yet. This is expected if you have not run the migration.');
      } else {
        console.error('\nError connecting to Supabase:', error);
      }
    } else {
      console.log('\nSuccessfully connected to Supabase!');
    }
    
    console.log('\nManual setup completed successfully. Please run the SQL migration as described above.');
  } catch (error) {
    console.error('Exception during connection test:', error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 