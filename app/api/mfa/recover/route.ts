// app/api/mfa/recover/route.ts
import { NextResponse, NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin.server'
import nodemailer from 'nodemailer'
import React from 'react'
import { render } from '@react-email/render'
import RecoverMfaEmail from '@/components/emails/RecoverMfaEmail'

export async function POST(request: NextRequest) {
  // 1) initialize admin client
  const supabaseAdmin = createAdminClient()

  // 2) extract Supabase access token from cookies
  const accessToken = request.cookies.get('sb-access-token')?.value
  if (!accessToken) {
    return NextResponse.json(
      { sent: false, error: 'Not authenticated (no token)' },
      { status: 401 }
    )
  }

  // 3) verify user against Supabase
  const {
    data: { user },
    error: userErr,
  } = await supabaseAdmin.auth.getUser(accessToken)
  if (userErr || !user) {
    return NextResponse.json(
      { sent: false, error: 'Not authenticated' },
      { status: 401 }
    )
  }

  // 4) list & delete existing TOTP factors
  const { data: { all: factors }, error: listErr } =
    await supabaseAdmin.auth.admin.mfa.listFactors({ userId: user.id })
  if (listErr) {
    return NextResponse.json(
      { sent: false, error: listErr.message },
      { status: 500 }
    )
  }
  for (const f of factors.filter(f => f.factor_type === 'totp')) {
    const { error: delErr } = await supabaseAdmin.auth.admin.mfa.deleteFactor({
      userId: user.id,
      id: f.id,
    })
    if (delErr) {
      return NextResponse.json(
        { sent: false, error: delErr.message },
        { status: 500 }
      )
    }
  }

  // 5) enroll a fresh TOTP factor
  const { data: enrollData, error: enrollErr } =
    await supabaseAdmin.auth.admin.mfa.generateTOTP({ userId: user.id })
  if (enrollErr || !enrollData) {
    return NextResponse.json(
      { sent: false, error: enrollErr?.message },
      { status: 500 }
    )
  }

  // 6) configure SMTP transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: false },
  })
  try {
    await transporter.verify()
  } catch (err: any) {
    return NextResponse.json(
      { sent: false, error: `SMTP error: ${err.message}` },
      { status: 500 }
    )
  }

  // 7) render and send the email
  const emailElement = React.createElement(RecoverMfaEmail, {
    qrCodeUrl:    enrollData.totp.qr_code,
    supportEmail: process.env.SUPPORT_EMAIL!,
  })
  const html = render(emailElement)

  try {
    await transporter.sendMail({
      from:    process.env.MFA_EMAIL_FROM,
      to:      user.email!,
      subject: 'Recover your MFA setup',
      html,
    })
    return NextResponse.json({ sent: true })
  } catch (err: any) {
    return NextResponse.json(
      { sent: false, error: err.message },
      { status: 500 }
    )
  }
}
