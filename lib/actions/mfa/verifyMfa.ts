// lib/actions/mfa/verifyMfa.ts
'use server'

import { createClient } from '@/lib/supabase/admin.server'

export interface VerifyMFAResult {
  success: boolean
  error?: string
}

export async function verifyMFA({
  verifyCode,
}: {
  verifyCode: string
}): Promise<VerifyMFAResult> {
  const supabase = await createClient()

  if (!verifyCode) {
    return { success: false, error: 'Missing verification code' }
  }

  // 1) List enrolled factors
  const { data: listData, error: listError } =
    await supabase.auth.mfa.listFactors()
  if (listError) {
    return { success: false, error: listError.message }
  }

  const factorId = listData.all[0]?.id
  if (!factorId) {
    return { success: false, error: 'No MFA factor found' }
  }

  // 2) Initiate challenge
  const { data: challengeData, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId })
  if (challengeError) {
    return { success: false, error: challengeError.message }
  }

  // 3) Verify code
  const { data: verifyData, error: verifyError } =
    await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code: verifyCode,
    })
  if (verifyError) {
    return { success: false, error: verifyError.message }
  }

  // 4) Set session tokens
  const { error: sessionError } = await supabase.auth.setSession({
    access_token: verifyData.access_token ?? '',
    refresh_token: verifyData.refresh_token ?? '',
  })
  if (sessionError) {
    return { success: false, error: sessionError.message }
  }

  return { success: true }
}
