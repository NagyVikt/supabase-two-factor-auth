'use server';

import { createServerActionClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin.server';
import nodemailer from 'nodemailer';
import React from 'react';
import { render } from '@react-email/render';
import RecoverMfaEmail from '@/components/emails/RecoverMfaEmail';

export async function enrollMFA() {
  const cookieStore = await cookies();
  const supabase = createServerActionClient({ cookies: () => cookieStore });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'User not found' };

  const { data: listData } = await supabase.auth.mfa.listFactors();
  if (listData?.totp[0]?.status === 'verified') {
    return { alreadyEnrolled: true };
  }
  
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
  if (error) return { error: error.message };

  return { totp: data.totp };
}

export async function recoverMfa(): Promise<{ success: boolean; error?: string }> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerActionClient({ cookies: () => cookieStore });
    const admin = createAdminClient();
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) throw new Error('Not authenticated');

    const { data: listData, error: listErr } = await admin.auth.admin.mfa.listFactors({ userId: user.id });
    if (listErr) throw listErr;

    for (const f of listData.factors.filter(f => f.factor_type === 'totp')) {
      const { error: delErr } = await admin.auth.admin.mfa.deleteFactor({ userId: user.id, id: f.id });
      if (delErr) throw delErr;
    }

    const { data: enrollData, error: enrollErr } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    if (enrollErr || !enrollData) throw enrollErr || new Error('Failed to generate MFA factor.');

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      tls: { rejectUnauthorized: false },
    });

    const html = render(<RecoverMfaEmail qrCodeUrl={enrollData.totp.qr_code} supportEmail={process.env.SUPPORT_EMAIL!} />);
    await transporter.sendMail({
      from: `"${process.env.APP_NAME}" <${process.env.MFA_EMAIL_FROM}>`,
      to: user.email!,
      subject: 'Your Two-Factor Authentication Recovery',
      html,
    });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unknown error occurred.';
    console.error('MFA Recovery Failed:', message);
    return { success: false, error: message };
  }
}
