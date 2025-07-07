'use server'

import { createClient } from '@/lib/supabase/client'

export const unEnrollMFA = async () => {
  const supabase = createClient()

  const factors = await supabase.auth.mfa.listFactors()
  if (factors.error) {
    throw factors.error
  }

  const factorId = factors.data.all[0]?.id
  if (!factorId) {
    return
  }

  const { error } = await supabase.auth.mfa.unenroll({ factorId })
  if (error) {
    throw error
  }
}
