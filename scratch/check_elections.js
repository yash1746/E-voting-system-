const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkElections() {
  const { data: elections, error } = await supabase.from('elections').select('*');
  if (error) {
    console.error('Error fetching elections:', error);
    return;
  }

  console.log('--- ELECTIONS IN DATABASE ---');
  elections.forEach(e => {
    console.log(`\nElection ID: ${e.id}`);
    console.log(`Title: ${e.title}`);
    console.log(`Status: ${e.status}`);
    console.log(`Eligible States: ${JSON.stringify(e.eligible_states)}`);
    console.log(`Candidates count: ${e.candidates ? e.candidates.length : 0}`);
    if (e.candidates && e.candidates.length > 0) {
      console.log('Candidates detail:');
      e.candidates.forEach(c => {
        console.log(`  - Name: ${c.name}, Constituency: |${c.constituency}|, Party: ${c.party}`);
      });
    }
  });
}

checkElections();
