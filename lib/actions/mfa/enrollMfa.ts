'use server'

import { createClient } from '@/lib/supabase/server'

export const enrollMFA = async () => {
  const supabase = await createClient()

  // Check current assurance level before enrolling
  await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
  })
  if (error) {
    throw error
  }

  // Optionally check assurance level after enrolling
  await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

  return data
}
