'use server'

import { createAdminClient } from '@/lib/supabase/admin.server'
import nodemailer from 'nodemailer'
import { render } from '@react-email/render'
import { randomBytes } from 'crypto'
import RecoverMfaEmail from '@/components/emails/RecoverMfaEmail'

export async function sendMfaRecoveryEmail(userId: string, email: string) {
  const supabase = createAdminClient()
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

  const { error: insertErr } = await supabase
    .from('mfa_recovery_tokens')
    .insert({ userId, token, expiresAt })
    .single()

  if (insertErr) throw insertErr

  const link = `${process.env.MFA_RECOVERY_LINK ?? 'http://localhost:3000/mfa-recovery'}?token=${token}`

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    tls: { rejectUnauthorized: false },
  })

  const html = await render(
    <RecoverMfaEmail
      recoveryLink={link}
      supportEmail={process.env.SUPPORT_EMAIL!}
      appName={process.env.APP_NAME || 'Your App'}
    />
  )

  await transporter.sendMail({
    from: `"${process.env.APP_NAME || 'Your App'}" <${process.env.MFA_EMAIL_FROM}>`,
    to: email,
    subject: 'Your Two-Factor Authentication Recovery',
    html,
  })
}
