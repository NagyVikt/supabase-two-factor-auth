'use server';

import { createServerActionClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin.server';
import nodemailer from 'nodemailer';
import React from 'react';
import { render } from '@react-email/render';
import RecoverMfaEmail from '@/components/emails/RecoverMfaEmail';

// Enroll a user in TOTP MFA
export async function enrollMFA() {
  const supabase = createServerActionClient({ cookies });
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return { error: 'User not found or not authenticated' };
  }

  const { data: listData } = await supabase.auth.mfa.listFactors();
  const existing = listData?.totp?.[0];
  if (existing?.status === 'verified') {
    return { alreadyEnrolled: true };
  }

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
  if (error || !data) {
    return { error: error?.message ?? 'Failed to enroll MFA.' };
  }
  return { qrCode: data.totp.qr_code };
}

// Verify TOTP code and complete login
export async function verifyMFA(payload: { verifyCode: string }) {
  const supabase = createServerActionClient({ cookies });
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return { error: 'User not authenticated' };
  }

  const { data: listData } = await supabase.auth.mfa.listFactors();
  const factor = listData?.totp?.[0];
  if (!factor) {
    return { error: 'MFA is not set up for this account.' };
  }

  const { data: challengeData, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId: factor.id });
  if (challengeError || !challengeData) {
    return { error: challengeError?.message ?? 'Failed to start MFA challenge.' };
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: factor.id,
    challengeId: challengeData.id,
    code: payload.verifyCode,
  });
  if (verifyError) {
    return { error: 'Invalid MFA code.' };
  }

  await supabase.auth.refreshSession();
  revalidatePath('/', 'layout');

  return { success: true };
}

// Recover MFA: delete existing TOTP factors and send new QR via email
export async function recoverMfa(): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createServerActionClient({ cookies });
    const admin = createAdminClient();

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      throw new Error('Not authenticated');
    }

    // Delete old TOTP factors as admin
    const { data: listData, error: listErr } =
      await admin.auth.admin.mfa.listFactors({ userId: user.id });
    if (listErr) throw listErr;
    for (const f of listData.factors.filter(f => f.factor_type === 'totp')) {
      const { error: delErr } =
        await admin.auth.admin.mfa.deleteFactor({ userId: user.id, id: f.id });
      if (delErr) throw delErr;
    }

    // Enroll new TOTP factor for this user session
    const { data: enrollData, error: enrollErr } =
      await supabase.auth.mfa.enroll({ factorType: 'totp' });
    if (enrollErr || !enrollData) throw enrollErr ?? new Error('Failed to generate MFA factor.');

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      email: user.email!,
      type: 'magiclink',
      options: { redirectTo: process.env.MFA_RECOVERY_LINK ?? 'http://localhost:3000/mfa-recovery' },
    });
    if (linkErr || !linkData?.properties?.action_link) {
      throw linkErr ?? new Error('Failed to create recovery link.');
    }

    // Send recovery email
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      tls: { rejectUnauthorized: false },
    });

    const html = await render(
      React.createElement(RecoverMfaEmail, {
        recoveryLink: linkData.properties.action_link,
      })
    );
    await transporter.sendMail({
      from: `"${process.env.APP_NAME!}" <${process.env.MFA_EMAIL_FROM!}>`,
      to: user.email!,
      subject: 'Your Two-Factor Authentication Recovery',
      html,
    });

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('MFA Recovery Failed SOP:', message);
    return { success: false, error: message };
  }
}
