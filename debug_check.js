const { supabase } = require('./config/supabase');

async function debugVoter() {
  const target = 'ADMIN00001';
  console.log(`Checking for ${target}...`);
  
  const { data, error } = await supabase
    .from('eligible_voters')
    .select('*')
    .eq('voter_id_number', target)
    .single();
    
  if (error) {
    console.error('NOT FOUND. Error:', error.message);
    
    // List all IDs to see what we have
    const { data: all } = await supabase.from('eligible_voters').select('voter_id_number');
    console.log('Available IDs in DB:', all.map(v => v.voter_id_number));
  } else {
    console.log('FOUND:', data.full_name);
  }
}

debugVoter();
