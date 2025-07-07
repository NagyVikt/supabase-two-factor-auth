'use client';

import supabase from '@/lib/supabase/browser';

export async function verifyMFA({ verifyCode }: { verifyCode: string }) {
  if (!verifyCode) return { success: false, error: 'Missing verification code' };
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
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
    return { success: false, error: message };
  }
}
