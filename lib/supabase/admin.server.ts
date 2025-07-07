import { createClient as _createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return _createClient(
    url,
    key,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
