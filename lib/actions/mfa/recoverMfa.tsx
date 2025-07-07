'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin.server';
import nodemailer from 'nodemailer';
import React from 'react';
import { render } from '@react-email/render';
import RecoverMfaEmail from '@/components/emails/RecoverMfaEmail';

export async function recoverMfa(): Promise<{ success: boolean; error?: string }> {
  // ADDED: Explicitly check for the required environment variable.
  // This helps debug the "Invalid API Key" error.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const errorMessage = 'Server configuration error: The SUPABASE_SERVICE_ROLE_KEY is missing from your environment variables. This is required for MFA recovery.';
    console.error(errorMessage);
    return { success: false, error: errorMessage };
  }
  
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );
  
  const admin = createAdminClient();

  try {
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      throw new Error('Not authenticated. This may be due to invalid cookies or an authentication issue.');
    }

    const { data: listData, error: listErr } = await admin.auth.admin.mfa.listFactors({ userId: user.id });
    if (listErr) throw listErr;

    for (const f of listData.factors.filter(f => f.factor_type === 'totp')) {
      const { error: delErr } = await admin.auth.admin.mfa.deleteFactor({ userId: user.id, id: f.id });
      if (delErr) throw delErr;
    }

    const { data: enrollData, error: enrollErr } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    if (enrollErr || !enrollData) throw enrollErr || new Error('Failed to generate a new MFA factor.');

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      tls: { rejectUnauthorized: false },
    });

    const html = await render(<RecoverMfaEmail qrCodeUrl={enrollData.totp.qr_code} supportEmail={process.env.SUPPORT_EMAIL!} />);
    await transporter.sendMail({
      from: `"${process.env.APP_NAME || 'Your App'}" <${process.env.MFA_EMAIL_FROM}>`,
      to: user.email!,
      subject: 'Your Two-Factor Authentication Recovery',
      html,
    });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unknown error occurred.';
    console.error('MFA Recovery Failed S>DASS:', message);
    return { success: false, error: message };
  }
}
