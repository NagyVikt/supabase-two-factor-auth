// lib/actions/mfa/recoverMfa.ts
'use server'

import React from 'react'
import { createClient } from '@/lib/supabase/server.server'
import nodemailer from 'nodemailer'
import { render } from '@react-email/render'
import RecoverMfaEmail from '@/components/emails/RecoverMfaEmail'

export const recoverMFA = async (): Promise<{ sent: boolean; error?: string }> => {
  const supabase = await createClient()

  // 1) Get current user
  const {
    data: { user },
    error: getUserError,
  } = await supabase.auth.getUser()
  if (getUserError || !user) {
    return { sent: false, error: 'Not authenticated' }
  }

  // 2) Unenroll any existing TOTP factor
  const { data: listData, error: listError } =
    await supabase.auth.mfa.listFactors()
  if (listError) {
    return { sent: false, error: listError.message }
  }
  const existing = listData.all.find((f) => f.factor_type === 'totp')
  if (existing) {
    await supabase.auth.mfa.unenroll({ factorId: existing.id })
  }

  // 3) Enroll a fresh TOTP factor
  const { data: enrollData, error: enrollError } =
    await supabase.auth.mfa.enroll({ factorType: 'totp' })
  if (enrollError || !enrollData) {
    return { sent: false, error: enrollError?.message || 'Enrollment failed' }
  }

  // 4) Ensure SMTP config is present
  const host = process.env.SMTP_HOST
  const portNum = Number(process.env.SMTP_PORT ?? '587')
  const from = process.env.MFA_EMAIL_FROM
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@your-app.com'
  if (!host || !from || !user.email) {
    return { sent: false, error: 'Email settings not configured' }
  }

  // 5) Build transporter
  const secure = portNum === 465
  const transporter = nodemailer.createTransport({
    host,
    port: portNum,
    secure,
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    ...(secure ? {} : { requireTLS: true }),
  })

  try {
    await transporter.verify()
  } catch (err: any) {
    console.error('SMTP verify failed:', err)
    return { sent: false, error: `SMTP connection error: ${err.message}` }
  }

  // 6) Render React-email component via createElement
  const element = React.createElement(RecoverMfaEmail, {
    qrCodeUrl: enrollData.totp.qr_code,
    supportEmail,
  })
  const html = render(element)

  // 7) Send the recovery email
  try {
    await transporter.sendMail({
      from,
      to: user.email,
      subject: 'Recover your MFA setup',
      html,
    })
    return { sent: true }
  } catch (err: any) {
    console.error('Error sending recovery email:', err)
    return { sent: false, error: err.message }
  }
}
