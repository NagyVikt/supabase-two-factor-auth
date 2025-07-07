'use server'

import { createClient } from '@/lib/supabase/server.server'
import nodemailer from 'nodemailer'

export const recoverMFA = async () => {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Not authenticated')
  }

  const factors = await supabase.auth.mfa.listFactors()
  if (factors.error) {
    throw factors.error
  }
  const existing = factors.data.all.find((f) => f.factor_type === 'totp')
  if (existing) {
    await supabase.auth.mfa.unenroll({ factorId: existing.id })
  }

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
  if (error || !data) {
    throw error || new Error('Enroll failed')
  }

  if (process.env.SMTP_HOST && process.env.MFA_EMAIL_FROM && user.email) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? '587'),
      secure: false,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    })

    await transporter.sendMail({
      from: process.env.MFA_EMAIL_FROM,
      to: user.email,
      subject: 'Recover your MFA setup',
      html: `<p>Scan this QR code with your authenticator app.</p><img src="${data.totp.qr_code}" alt="MFA QR Code" />`,
    })
  }

  return { sent: true }
}
