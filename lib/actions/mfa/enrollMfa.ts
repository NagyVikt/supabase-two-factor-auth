'use server'

import { createClient } from '@/lib/supabase/client'

interface MfaEnrollData {
  id: string
  type: 'totp' | (string & {})
  totp: {
    qr_code: string
    secret: string
    uri: string
  }
  friendly_name?: string
}

export const enrollMFA = async () => {
  const supabase = createClient()

  // Check current assurance level before enrolling
  await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

  const factors = await supabase.auth.mfa.listFactors()
  if (factors.error) {
    throw factors.error
  }

  const existing = factors.data.all.find((f) => f.factor_type === 'totp')

  if (existing) {
    if (existing.status === 'unverified') {
      // Remove unverified factor before re-enrolling
      await supabase.auth.mfa.unenroll({ factorId: existing.id })
    } else {
      // Already enrolled and verified
      return { alreadyEnrolled: true }
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
  })
  if (error) {
    throw error
  }

  // Optionally check assurance level after enrolling
  await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

  return data as MfaEnrollData
}
