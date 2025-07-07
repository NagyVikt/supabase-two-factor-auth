'use server'

import { createClient } from '@/lib/supabase/client'
import { createAdminClient } from '@/lib/supabase/admin.server'
import nodemailer from 'nodemailer'
import { render } from '@react-email/render'
import RecoverMfaEmail from '@/components/emails/RecoverMfaEmail'
import React from 'react'

// Define a clear result interface for type safety
interface RecoverMfaResult {
  success: boolean
  error?: string
}

export const recoverMfa = async (): Promise<RecoverMfaResult> => {
  try {
    // 1. Initialize Supabase clients
    const supabase = await createClient()
    const admin = createAdminClient()

    // 2. Fetch the currently authenticated user
    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    // 3. Remove any existing TOTP factors with the admin client
    const { data: listData, error: listErr } =
      await admin.auth.admin.mfa.listFactors({ userId: user.id })
    if (listErr) {
      return { success: false, error: listErr.message }
    }
    for (const f of listData.all.filter(f => f.factor_type === 'totp')) {
      const { error: delErr } = await admin.auth.admin.mfa.deleteFactor({
        userId: user.id,
        id: f.id,
      })
      if (delErr) return { success: false, error: delErr.message }
    }

    // 4. Generate a fresh TOTP factor for the user
    const { data: enrollData, error: enrollErr } =
      await admin.auth.admin.mfa.generateTOTP({ userId: user.id })
    if (enrollErr || !enrollData) {
      return { success: false, error: enrollErr?.message || 'Failed to generate MFA' }
    }

    // 5. Configure the SMTP transporter
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MFA_EMAIL_FROM, SUPPORT_EMAIL } = process.env
    if (!SMTP_HOST || !MFA_EMAIL_FROM) {
      return { success: false, error: 'SMTP not configured' }
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT ?? 587),
      secure: Number(SMTP_PORT) === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
      tls: { rejectUnauthorized: false },
    })

    try {
      await transporter.verify()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: `SMTP error: ${message}` }
    }

    // 6. Render and send the recovery email
    const html = render(
      <RecoverMfaEmail
        qrCodeUrl={enrollData.totp.qr_code}
        supportEmail={SUPPORT_EMAIL || 'support@example.com'}
      />,
    )

    try {
      await transporter.sendMail({
        from: `"${process.env.APP_NAME || 'Your App'} Support" <${MFA_EMAIL_FROM}>`,
        to: user.email ?? '',
        subject: 'MFA Recovery for Your Account',
        html,
      })
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  } catch (err) {
    console.error('MFA recovery failed', err)
    return { success: false, error: 'Unexpected server error' }
  }
}
