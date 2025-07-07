'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function enrollMFA() {
  const cookieStore = await cookies();

  // Use the recommended createServerClient from @supabase/ssr
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

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { error: 'User not authenticated.' };
    }

    const { data: listData } = await supabase.auth.mfa.listFactors();
    if (listData?.totp[0]?.status === 'verified') {
      return { alreadyEnrolled: true };
    }
    
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    if (error) {
      return { error: error.message };
    }

    return { totp: data.totp };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
    return { error: message };
  }
}