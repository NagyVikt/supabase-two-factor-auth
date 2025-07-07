'use server'

import { createClient } from '@/lib/supabase/client'

export const checkAssurance = async () => {
  const supabase = await createClient()
  await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
}
