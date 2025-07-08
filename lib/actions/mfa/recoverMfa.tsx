// lib/actions/mfa/recoverMfa.tsx
'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'
import { render } from '@react-email/render'
import nodemailer from 'nodemailer'
import RecoverMfaEmail from '@/components/emails/RecoverMfaEmail'

export async function recoverMfa(): Promise<{ success: boolean; error?: string }> {
  // 1) Ensure service-role key
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const msg = 'Server configuration error: Missing SUPABASE_SERVICE_ROLE_KEY.'
    console.error('[recoverMfa] ' + msg)
    return { success: false, error: msg }
  }

  // 2) Setup Supabase SSR client with cookies
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

  // 3) Get authenticated user
  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr || !user) {
    console.error('[recoverMfa] getUser error:', userErr?.message)
    return { success: false, error: 'Not authenticated.' }
  }

  // 4) Generate one-time UUID token and store
  const token = randomUUID()
  const expiration = new Date(Date.now() + (process.env.MFA_TOKEN_TTL_MINUTES ? Number(process.env.MFA_TOKEN_TTL_MINUTES)*60000 : 60*60000))
  const { error: dbErr } = await supabase
    .from('mfa_recovery_tokens')
    .insert([{ user_id: user.id, token, created_at: new Date(), expires_at: expiration }])
  if (dbErr) {
    console.error('[recoverMfa] DB insert error:', dbErr)
    return { success: false, error: dbErr.message }
  }

  // 5) Build recovery link using custom token
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
  const recoveryUrl = `${baseUrl}/mfa-recovery?token=${encodeURIComponent(token)}`

  // 6) Render email template
  const html = await render(
    <RecoverMfaEmail
      recoveryLink={recoveryUrl}
      supportEmail={process.env.SUPPORT_EMAIL!}
      appName={process.env.APP_NAME || 'Your App'}
    />
  )

  // 7) Send email via SMTP
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
      tls: { rejectUnauthorized: false },
    })
    await transporter.sendMail({
      from: `"${process.env.APP_NAME || 'Your App'}" <${process.env.MFA_EMAIL_FROM}>`,
      to: user.email!,
      subject: 'Reset Your Two-Factor Authentication',
      html,
    })
    return { success: true }
  } catch (e: unknown) {
    console.error('[recoverMfa] sendMail error:', e)
    const msg = e instanceof Error ? e.message : 'Email send failed.'
    return { success: false, error: msg }
  }
}
