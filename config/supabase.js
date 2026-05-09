const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('your-project-id')) {
  console.warn('⚠️  SUPABASE not configured. API routes will return errors until you update .env');
}

// Service role client — full access, used only on backend
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: { persistSession: false }
  }
);

module.exports = { supabase };
