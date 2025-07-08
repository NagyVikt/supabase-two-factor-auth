// lib/actions/mfa/enrollMfa.ts
'use server'

import { createClient } from '@/lib/supabase/client'

/**
 * The shape of a successful TOTP enrollment response from Supabase.
 */
export interface MfaEnrollData {
  id: string
  type: 'totp' | (string & {})
  totp: {
    qr_code: string
    secret: string
    uri: string
  }
  friendly_name?: string
}

/**
 * Enrolls the current user in TOTP-based MFA.
 * If the user already has a verified factor, returns { alreadyEnrolled: true }.
 * If they have an unverified factor, it will be removed and re-enrolled.
 *
 * @throws if any Supabase call returns an error
 */
export const enrollMFA = async (): Promise<MfaEnrollData | { alreadyEnrolled: true }> => {
  const supabase = await createClient()

  // 1) Check current assurance level
  await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

  // 2) List existing factors
  const factors = await supabase.auth.mfa.listFactors()
  if (factors.error) {
    throw factors.error
  }

  // 3) If there's already a TOTP factor...
  const existing = factors.data.all.find((f) => f.factor_type === 'totp')
  if (existing) {
    if (existing.status === 'unverified') {
      // Remove it so we can re-enroll cleanly
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: existing.id })
      if (unenrollError) {
        throw unenrollError
      }
    } else {
      // Already enrolled & verified
      return { alreadyEnrolled: true }
    }
  }

  // 4) Enroll a new TOTP factor
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
  })
  if (error) {
    throw error
  }

  // 5) (Optional) Re-check assurance level
  await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

  // 6) Return the enrollment data
  return data as MfaEnrollData
}
