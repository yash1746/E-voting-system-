require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkVoters() {
  const { data, error } = await supabase
    .from('eligible_voters')
    .select('*');
  
  if (error) {
    console.error('Error fetching voters:', error);
    return;
  }
  
  if (data.length === 0) {
    console.log('NO VOTERS FOUND IN DATABASE.');
  } else {
    console.log('Registered Voters:');
    console.table(data.map(v => ({
      ID: v.voter_id_number,
      Name: v.full_name,
      State: v.state,
      Const: v.constituency
    })));
  }
}

checkVoters();
