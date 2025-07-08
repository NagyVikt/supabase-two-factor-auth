// lib/actions/mfa/generateNewMfaFromToken.ts
'use server';

import { createClient } from '@/lib/supabase/client';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { z } from 'zod';

interface User {
  id: string;
  email: string;
}

interface MfaRecoveryToken {
  id: string;
  token: string;
  expiresAt: string;
  userId: string;
}

interface ActionResponse {
  success: boolean;
  qrCode?: string;
  error?: string;
}

const TokenSchema = z.string().min(1, { message: 'Token is required.' });

export async function generateNewMfaFromToken(
  token: string
): Promise<ActionResponse> {
  // 1) validate
  const parsed = TokenSchema.safeParse(token);
  if (!parsed.success) {
    return { success: false, error: 'Invalid recovery token.' };
  }
  const recoveryTokenValue = parsed.data;

  // 2) supabase client (await!)
  const supabase = await createClient();

  try {
    // 3) lookup recovery record (no generics on .from)
    const { data: rec, error: recErr } = await supabase
      .from('mfa_recovery_tokens')
      .select('id, token, expiresAt, userId')
      .eq('token', recoveryTokenValue)
      .single<MfaRecoveryToken>();

    if (recErr || !rec) {
      return { success: false, error: 'Recovery link is invalid.' };
    }

    // 4) expiry check
    if (new Date() > new Date(rec.expiresAt)) {
      await supabase.from('mfa_recovery_tokens').delete().eq('id', rec.id);
      return { success: false, error: 'Recovery link has expired.' };
    }

    // 5) lookup user
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', rec.userId)
      .single<User>();

    if (userErr || !user) {
      return { success: false, error: 'User not found.' };
    }

    // 6) generate secret
    const newSecret = speakeasy.generateSecret({
      name: `YourAppName (${user.email})`,
    });

    // 7) update user
    const { error: updateErr } = await supabase
      .from('users')
      .update({
        mfa_secret: newSecret.base32,
        is_mfa_enabled: false,
      })
      .eq('id', user.id);

    if (updateErr) throw updateErr;

    // 8) build QR
    const otpauthUrl = speakeasy.otpauthURL({
      secret: newSecret.base32,
      label: encodeURIComponent(user.email),
      issuer: 'YourAppName',
      algorithm: 'sha1',
    });
    const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);

    // 9) invalidate recovery token
    await supabase.from('mfa_recovery_tokens').delete().eq('id', rec.id);

    // 10) done
    return { success: true, qrCode: qrCodeDataUrl };
  } catch (err) {
    console.error('Error in generateNewMfaFromToken:', err);
    return { success: false, error: 'Unexpected server error. Please try again later.' };
  }
}
