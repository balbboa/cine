// Verify game_invites relationships
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function verifyRelationships() {
  try {
    console.log('Verifying game_invites table and its relationships...');
    
    // Check if the table exists by running a simple query
    const { data: tableData, error: tableError } = await supabase
      .from('game_invites')
      .select('id')
      .limit(1);
    
    if (tableError) {
      console.error('❌ Error accessing game_invites table:', tableError.message);
    } else {
      console.log('✅ game_invites table exists and is accessible');
    }
    
    // Try querying with a join to check relationships
    const { data: joinData, error: joinError } = await supabase
      .from('game_invites')
      .select(`
        id,
        sender_id,
        receiver_id,
        game_id,
        status,
        sender:users!sender_id(id, username),
        receiver:users!receiver_id(id, username),
        game:games!game_id(id, game_mode)
      `)
      .limit(1);
    
    if (joinError) {
      console.error('❌ Error with relationships:', joinError.message);
      console.error('Error details:', joinError);
    } else {
      console.log('✅ Foreign key relationships are correctly set up');
      console.log('Sample query result structure:', 
        JSON.stringify(joinData, null, 2));
    }
    
    // Check if the functions exist
    const { data: functionData, error: functionError } = await supabase
      .rpc('send_game_invite', { 
        sender_id_param: '00000000-0000-0000-0000-000000000000', 
        receiver_id_param: '11111111-1111-1111-1111-111111111111',
        game_id_param: '22222222-2222-2222-2222-222222222222'
      });
    
    if (functionError && !functionError.message.includes('You can only invite friends')) {
      console.error('❌ Error with send_game_invite function:', functionError.message);
    } else {
      console.log('✅ send_game_invite function exists');
    }
    
    console.log('\nVerification complete!');
  } catch (err) {
    console.error('Unexpected error during verification:', err.message);
  }
}

verifyRelationships(); 