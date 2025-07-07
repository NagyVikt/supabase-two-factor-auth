'use client'

import supabase from '@/lib/supabase/browser'

export interface VerifyMFAResult {
  success: boolean
  error?: string
}

export async function verifyMFA({ verifyCode }: { verifyCode: string })
: Promise<VerifyMFAResult> {

  if (!verifyCode) {
    return { success: false, error: 'Missing verification code' }
  }

  /* 1 – list factors (aal-1 token is OK in the browser) */
  const { data: listData, error: listErr } =
    await supabase.auth.mfa.listFactors()
  if (listErr) return { success: false, error: listErr.message }

  const factorId = listData.all[0]?.id
  if (!factorId) return { success: false, error: 'No MFA factor found' }

  /* 2 – challenge + verify */
  const { data: chall, error: challErr } =
    await supabase.auth.mfa.challenge({ factorId })
  if (challErr) return { success: false, error: challErr.message }

  const { data: verifyData, error: verifyErr } =
    await supabase.auth.mfa.verify({
      factorId,
      challengeId: chall.id,
      code: verifyCode,
    })
  if (verifyErr) return { success: false, error: verifyErr.message }

  /* 3 – promote aal-1 → aal-2 (sets cookies + localStorage) */
  const { error: sessErr } = await supabase.auth.setSession({
    access_token:  verifyData.access_token  ?? '',
    refresh_token: verifyData.refresh_token ?? '',
  })
  if (sessErr) return { success: false, error: sessErr.message }

  return { success: true }
}
