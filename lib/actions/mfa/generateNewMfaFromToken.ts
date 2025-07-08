// lib/actions/mfa/generateNewMfaFromToken.ts
'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import speakeasy from 'speakeasy'
import qrcode from 'qrcode'
import { z } from 'zod'

// Validate incoming recovery token as UUID
const TokenSchema = z.string().uuid({ message: 'Invalid token format.' })

interface ActionResponse {
  success: boolean
  qrCode?: string
  error?: string
}

export async function generateNewMfaFromToken(
  token: string
): Promise<ActionResponse> {
  // 1) Validate token format
  const parsed = TokenSchema.safeParse(token)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message }
  }

  // 2) Ensure service-role key is set
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[generateNewMfaFromToken] Missing SUPABASE_SERVICE_ROLE_KEY')
    return { success: false, error: 'Server configuration error.' }
  }

  // 3) Init Supabase SSR client with full cookie support
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll().map(c => ({ name: c.name, value: c.value })),
        setAll: arr => arr.forEach(c => cookieStore.set(c.name, c.value)),
      },
    }
  )

  // 4) Lookup recovery record and validate expiration
  const { data: rec, error: recErr } = await supabase
    .from('mfa_recovery_tokens')
    .select('id, token, expires_at, user_id')
    .eq('token', parsed.data)
    .single()
  if (recErr || !rec) {
    console.error('[generateNewMfaFromToken] lookup failed:', recErr)
    return { success: false, error: 'Recovery link is invalid.' }
  }
  if (new Date() > new Date(rec.expires_at)) {
    await supabase.from('mfa_recovery_tokens').delete().eq('id', rec.id)
    return { success: false, error: 'Recovery link has expired.' }
  }

  // 5) Fetch user from Auth via the Admin API
  const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(
    rec.user_id
  )
  if (userErr || !userData.user) {
    console.error('[generateNewMfaFromToken] user fetch failed:', userErr)
    return { success: false, error: 'User not found.' }
  }
  const email: string = userData.user.email!  // non-null asserted, email must exist

  // 6) Generate new TOTP secret
  const newSecret = speakeasy.generateSecret({
    name: `YourAppName (${email})`,
    issuer: 'YourAppName',
  })

  // 7) Persist secret in user_metadata via Admin update
  const { error: updateErr } = await supabase.auth.admin.updateUserById(
    rec.user_id,
    {
      user_metadata: {
        mfa_secret: newSecret.base32,
        is_mfa_enabled: false,
      },
    }
  )
  if (updateErr) {
    console.error('[generateNewMfaFromToken] user update failed:', updateErr)
    return { success: false, error: 'Failed to set up new MFA secret.' }
  }

  // 8) Generate QR code Data URL
  let qrCodeDataUrl: string
  try {
    const otpauth = speakeasy.otpauthURL({
      secret: newSecret.base32,
      label: encodeURIComponent(email),
      issuer: 'YourAppName',
      algorithm: 'sha1',
    })
    qrCodeDataUrl = await qrcode.toDataURL(otpauth)
  } catch (qrErr) {
    console.error('[generateNewMfaFromToken] QR code error:', qrErr)
    return { success: false, error: 'Failed to generate QR code.' }
  }

  // 9) Delete the recovery token to prevent reuse
  await supabase.from('mfa_recovery_tokens').delete().eq('id', rec.id)

  // 10) Return QR code to client
  return { success: true, qrCode: qrCodeDataUrl }
}
