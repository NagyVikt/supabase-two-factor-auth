'use server'

import { createClient } from '@/lib/supabase/server.server'
import { redirect } from 'next/navigation'

export const verifyMFA = async (formData: FormData) => {
  const supabase = await createClient()

  const verificationCode = formData.get('verifyCode') as string

  // List enrolled factors
  const factors = await supabase.auth.mfa.listFactors()
  if (factors.error) {
    // Couldn’t list—redirect back with generic error
    redirect('/verify-mfa?message=Unable+to+verify+your+device')
  }

  const factorId = factors.data.all[0]?.id
  if (!factorId) {
    redirect('/verify-mfa?message=No+TOTP+factor+found')
  }

  // Initiate a challenge (refreshes the factor so it’s ready to verify)
  const challenge = await supabase.auth.mfa.challenge({ factorId })
  if (challenge.error) {
    redirect('/verify-mfa?message=Unable+to+initiate+MFA+challenge')
  }

  const challengeId = challenge.data.id

  // Perform the actual verify step
  const verify = await supabase.auth.mfa.verify({
    factorId,
    challengeId,
    code: verificationCode,
  })

  if (verify.error) {
    // Invalid TOTP code: send back to form with message
    redirect('/verify-mfa?message=Invalid+verification+code')
  }

  // On success, set session tokens
  const { error } = await supabase.auth.setSession({
    access_token: verify.data.access_token || '',
    refresh_token: verify.data.refresh_token || '',
  })
  if (error) {
    redirect('/verify-mfa?message=Could+not+establish+session')
  }

  // All good—go to your protected page
  redirect('/protected?mfaSuccess=true')
}
