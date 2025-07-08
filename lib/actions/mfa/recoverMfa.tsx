'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { sendMfaRecoveryEmail } from './sendMfaRecoveryEmail'

export async function recoverMfa(): Promise<{ success: boolean; error?: string }> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const errorMessage = 'Server configuration error: The SUPABASE_SERVICE_ROLE_KEY is missing from your environment variables. This is required for MFA recovery.'
    console.error(errorMessage)
    return { success: false, error: errorMessage }
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  try {
    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) {
      throw new Error('Not authenticated.')
    }

    await sendMfaRecoveryEmail(user.id, user.email!)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unknown error occurred.'
    console.error('MFA recovery failed:', message)
    return { success: false, error: message }
  }
}
