import { createClient } from '@supabase/supabase-js';

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY) {
  throw new Error(
    'Missing SUPABASE_SERVICE_ROLE_KEY—please add it to your environment variables.'
  );
}

export function createAdminClient() {
  return createClient(
    process.env.SUPABASE_URL!,   // assert the URL exists
    SERVICE_ROLE_KEY!,           // now definitely a string
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
