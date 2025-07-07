import { createClient as _createClient } from '@supabase/supabase-js'
import {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  assertServiceRoleEnv,
} from './utils'

export function createAdminClient() {
  assertServiceRoleEnv()
  return _createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
