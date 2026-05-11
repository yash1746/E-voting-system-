require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function debugVoters() {
  const { data, error } = await supabase
    .from('eligible_voters')
    .select('voter_id_number, full_name');
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('--- DEBUG VOTER IDS ---');
  data.forEach(v => {
    console.log(`|${v.voter_id_number}| (Length: ${v.voter_id_number.length}) - ${v.full_name}`);
  });
}

debugVoters();
