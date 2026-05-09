const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkVoters() {
  const { data, error } = await supabase
    .from('eligible_voters')
    .select('voter_id_number, full_name, is_active');
  
  if (error) {
    console.error('Error fetching voters:', error);
  } else {
    console.log('Registered Voters in Database:', data);
  }
}

checkVoters();
