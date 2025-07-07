'use server';

import supabase from '@/lib/supabase/server';

export async function enrollMFA() {
  try {
    // Attempt TOTP enrollment
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    if (error) {
      // If already enrolled, Supabase returns an error with code '23505'
      if ((error as any).code === '23505') {
        return { alreadyEnrolled: true };
      }
      return { error: error.message };
    }
    // data: { secret: string; qr_code: string; }
    return { totp: { qr_code: data.qr_code } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return { error: message };
  }
}
