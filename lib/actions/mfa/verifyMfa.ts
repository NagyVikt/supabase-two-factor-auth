'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const verifyMFA = async (formData: FormData) => {
  const supabase = await createClient()

  const verificationCode = formData.get('verifyCode') as string

  const factors = await supabase.auth.mfa.listFactors()
  if (factors.error) {
    throw factors.error
  }

  const factorId = factors.data.all[0]?.id
  if (!factorId) {
    throw new Error('No TOTP factors found!')
  }

  const challenge = await supabase.auth.mfa.challenge({ factorId })
  if (challenge.error) {
    throw challenge.error
  }

  const challengeId = challenge.data.id

  const verify = await supabase.auth.mfa.verify({
    factorId,
    challengeId,
    code: verificationCode,
  })
  if (verify.error) {
    throw verify.error
  }

  const { error } = await supabase.auth.setSession({
    access_token: verify.data?.access_token || '',
    refresh_token: verify.data?.refresh_token || '',
  })
  if (error) {
    throw error
  }

  redirect('/protected?mfaSuccess=true')
}
