'use server'

import { createClient } from '@/lib/supabase/server'

export const checkAssurance = async () => {
  const supabase = await createClient()
  await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
}
