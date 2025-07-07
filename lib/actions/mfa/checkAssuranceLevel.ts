'use server'

import { createClient } from '@/lib/supabase/client'

export const checkAssurance = async () => {
  const supabase = createClient()
  await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
}
