'use server'

import { createClient } from '@/lib/supabase/admin.server'

export const checkAssurance = async () => {
  const supabase = await createClient()
  await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
}
