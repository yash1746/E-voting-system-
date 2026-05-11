require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function testQuery() {
  const target = 'ADMIN00001';
  console.log(`Querying for: |${target}|`);
  
  const { data, error } = await supabase
    .from('eligible_voters')
    .select('*')
    .eq('voter_id_number', target)
    .single();
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Found Voter:', data.full_name);
  }
}

testQuery();
