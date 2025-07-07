'use server';

import supabase from '@/lib/supabase/server';

export async function verifyMFA({ verifyCode }: { verifyCode: string }) {
  if (!verifyCode) return { success: false, error: 'Missing verification code' };
  try {
    // List the user's factors
    const { data: listData, error: listErr } = await supabase.auth.mfa.listFactors();
    if (listErr) return { success: false, error: listErr.message };

    // Pick the unverified factor or the first one
    const factorId =
      listData.all.find((f) => f.status === 'unverified')?.id ??
      listData.all[0]?.id;
    if (!factorId) return { success: false, error: 'No MFA factor found.' };

    // Create a challenge
    const { data: chall, error: challErr } = await supabase.auth.mfa.challenge({ factorId });
    if (challErr) return { success: false, error: challErr.message };

    // Verify the code
    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: chall.id,
      code: verifyCode,
    });
    if (verifyErr) return { success: false, error: verifyErr.message };

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return { success: false, error: message };
  }
}
