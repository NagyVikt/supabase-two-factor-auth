'use client'; // This directive is not strictly needed but clarifies intent

import supabase from '@/lib/supabase/browser'; // Your client-side Supabase singleton

export interface VerifyMFAResult {
  success: boolean;
  error?: string;
}

export async function verifyMFA({ verifyCode }: { verifyCode: string }): Promise<VerifyMFAResult> {
  if (!verifyCode) {
    return { success: false, error: 'Missing verification code' };
  }
  try {
    const { data: listData, error: listErr } = await supabase.auth.mfa.listFactors();
    if (listErr) return { success: false, error: listErr.message };

    const factorId = listData.all.find(f => f.status === 'unverified')?.id ?? listData.all[0]?.id;
    if (!factorId) return { success: false, error: 'No MFA factor found to verify.' };

    const { data: chall, error: challErr } = await supabase.auth.mfa.challenge({ factorId });
    if (challErr) return { success: false, error: challErr.message };

    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: chall.id,
      code: verifyCode,
    });
    if (verifyErr) return { success: false, error: verifyErr.message };

    // On successful verification, Supabase automatically elevates the session.
    // Manually calling setSession is often not needed with recent library versions.
    // The session is now AAL2.

    return { success: true };
  } catch (_err) {
    const message = _err instanceof Error ? _err.message : 'An unexpected error occurred.';
    return { success: false, error: message };
  }
}