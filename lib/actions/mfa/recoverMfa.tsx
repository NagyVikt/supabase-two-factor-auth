// lib/actions/mfa/recoverMfa.tsx
'use server'

import { createClient } from '@/lib/supabase/client'   // SSR helper
import { createAdminClient } from '@/lib/supabase/admin.server' // Service-role helper
import nodemailer from 'nodemailer'
import { render } from '@react-email/render'
import RecoverMfaEmail from '@/components/emails/RecoverMfaEmail'

interface RecoverMFAResult {
  sent: boolean
  error?: string
}

export const recoverMFA = async (): Promise<RecoverMFAResult> => {
  // 1) Build both clients
  const userClient  = createClient()
  const adminClient = createAdminClient()

  // 2) Make sure the user is authenticated
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser()
  if (userErr || !user) {
    return { sent: false, error: 'Not authenticated' }
  }

  // 3) List & delete all existing TOTP factors (admin API bypasses AAL2)
  const { data: listData, error: listErr } =
    await userClient.auth.mfa.listFactors()
  if (listErr) {
    return { sent: false, error: listErr.message }
  }

  for (const factor of listData.all.filter((f) => f.factor_type === 'totp')) {
    const { error: delErr } = await adminClient.auth.admin.mfa.deleteFactor({
      userId: user.id,
      id:     factor.id,
    })
    if (delErr) {
      return { sent: false, error: delErr.message }
    }
  }

  // 4) Enroll a new TOTP factor (user client at AAL1)
  const { data: enrollData, error: enrollErr } =
    await userClient.auth.mfa.enroll({
      factorType:   'totp',
      friendlyName: 'Recovery',
    })
  if (enrollErr || !enrollData) {
    return { sent: false, error: enrollErr?.message || 'Enrollment failed' }
  }

  // 5) Configure SMTP
  const host = process.env.SMTP_HOST!
  const port = Number(process.env.SMTP_PORT ?? '587')
  const from = process.env.MFA_EMAIL_FROM!
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@your-app.com'
  const secure = port === 465

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS! }
      : undefined,
    connectionTimeout: 10_000,
    greetingTimeout:   10_000,
    ...(secure ? {} : { requireTLS: true }),
  })

  try {
    await transporter.verify()
  } catch (err: any) {
    return { sent: false, error: `SMTP connection error: ${err.message}` }
  }

  // 6) Render & send the email
  const html = render(
    <RecoverMfaEmail
      qrCodeUrl   ={enrollData.totp.qr_code}
      supportEmail={supportEmail}
    />
  )

  try {
    await transporter.sendMail({
      from,
      to:      user.email!,
      subject: 'Recover your MFA setup',
      html,
    })
    return { sent: true }
  } catch (err: any) {
    return { sent: false, error: err.message }
  }
}
