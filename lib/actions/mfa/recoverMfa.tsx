// lib/actions/mfa/recoverMfa.tsx
'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin.server'
import { render } from '@react-email/render'
import nodemailer from 'nodemailer'
import RecoverMfaEmail from '@/components/emails/RecoverMfaEmail'

export async function recoverMfa(): Promise<{ success: boolean; error?: string }> {
  // 1) Verify service-role key
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const msg = 'Missing SUPABASE_SERVICE_ROLE_KEY in environment'
    console.error('[recoverMfa] ' + msg)
    return { success: false, error: msg }
  }

  // 2) Build SSR client and pass cookies
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () =>
          cookieStore.getAll().map(c => ({ name: c.name, value: c.value })),
        setAll: arr => arr.forEach(c => cookieStore.set(c.name, c.value)),
      },
    }
  )

  // 3) Validate user via getUser (avoids insecure getSession warning)
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()

  if (userErr || !user) {
    console.error('[recoverMfa] getUser error:', userErr?.message)
    return { success: false, error: 'Not authenticated.' }
  }

  // 4) Generate magiclink with admin client
  const admin = createAdminClient()
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    email: user.email!,
    type: 'magiclink',
    options: {
      redirectTo:
        process.env.MFA_RECOVERY_LINK || `${process.env.NEXT_PUBLIC_APP_URL}/recover`,
    },
  })
  if (linkErr || !linkData?.properties?.action_link) {
    console.error('[recoverMfa] generateLink error:', linkErr?.message)
    return { success: false, error: 'Failed to generate recovery link.' }
  }

  // 5) Render email HTML and send via nodemailer
  const html = await render(
    <RecoverMfaEmail
      recoveryLink={linkData.properties.action_link}
      supportEmail={process.env.SUPPORT_EMAIL!}
      appName={process.env.APP_NAME || 'Your App'}
    />
  )

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      tls: { rejectUnauthorized: false },
    })

    await transporter.sendMail({
      from: `"${process.env.APP_NAME || 'Your App'}" <${process.env.MFA_EMAIL_FROM}>`,
      to: user.email!,
      subject: 'Your Two-Factor Authentication Recovery Link',
      html,
    })

    return { success: true }
  } catch (e: unknown) {
    console.error('[recoverMfa] sendMail error:', e)
    const msg = e instanceof Error ? e.message : 'Unknown email error.'
    return { success: false, error: msg }
  }
}
