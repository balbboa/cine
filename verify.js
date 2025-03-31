// Need to install with npm install @supabase/supabase-js
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Verify tables
const tables = [
  'achievements',
  'user_achievements',
  'seasonal_leaderboards',
  'seasonal_player_stats'
];

// Check each table
async function verifyTables() {
  console.log('Checking tables created in our migrations:');
  
  const results = await Promise.all(tables.map(async (table) => {
    try {
      // Try to select just one row to verify the table exists
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        console.error(`❌ Error checking table ${table}:`, error.message);
        return false;
      } else {
        console.log(`✅ Table ${table} exists`);
        return true;
      }
    } catch (err) {
      console.error(`❌ Failed to query table ${table}:`, err.message);
      return false;
    }
  }));
  
  const successCount = results.filter(result => result).length;
  console.log(`\nVerification complete: ${successCount}/${tables.length} tables verified successfully.`);
}

// Verify functions
const functions = [
  'get_top_players',
  'get_user_achievements',
  'update_achievement_progress',
  'refresh_leaderboard'
];

// We can't directly verify functions existence with supabase-js, 
// but we can log that they should be there based on our migrations
function verifyFunctions() {
  console.log('\nFunctions created in our migrations:');
  functions.forEach(fn => {
    console.log(`- ${fn}: should be created`);
  });
}

// Verify materialized view existence
async function verifyMaterializedView() {
  try {
    const { data, error } = await supabase
      .rpc('refresh_leaderboard');
    
    if (error) {
      console.error('❌ Error refreshing leaderboard (materialized view might not exist):', error.message);
    } else {
      console.log('✅ Successfully refreshed leaderboard materialized view');
    }
  } catch (err) {
    console.error('❌ Failed to refresh leaderboard:', err.message);
  }
}

// Run all verifications
async function runAllVerifications() {
  verifyFunctions();
  await verifyTables();
  await verifyMaterializedView();
  
  console.log('\nMigration verification complete!');
}

runAllVerifications(); 