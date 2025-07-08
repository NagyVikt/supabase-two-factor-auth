// lib/actions/mfa/generateNewMfaFromToken.ts
'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { z } from 'zod';

const TokenSchema = z.string().uuid({ message: 'Invalid token format.' });

interface ActionResponse {
  success: boolean;
  qrCode?: string;
  error?: string;
}

export async function generateNewMfaFromToken(
  token: string
): Promise<ActionResponse> {
  // 1) Validate the incoming token
  const parsed = TokenSchema.safeParse(token);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  // 2) Ensure we have a service-role key
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const msg = 'Server configuration error: Missing SUPABASE_SERVICE_ROLE_KEY.';
    console.error('[generateNewMfaFromToken] ' + msg);
    return { success: false, error: msg };
  }

  // 3) Initialize Supabase SSR client with cookie handling
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () =>
          cookieStore.getAll().map(c => ({ name: c.name, value: c.value })),
        setAll: arr => arr.forEach(c => cookieStore.set(c.name, c.value)),
      },
    }
  );

  // 4) Look up the recovery record including expiration
  const { data: rec, error: recErr } = await supabase
    .from('mfa_recovery_tokens')
    .select('id, token, expires_at, user_id')
    .eq('token', parsed.data)
    .single();
  if (recErr) {
    console.error('[generateNewMfaFromToken] recovery lookup failed:', recErr);
    return { success: false, error: 'Recovery link is invalid.' };
  }
  if (!rec) {
    return { success: false, error: 'Recovery link is invalid.' };
  }

  // 5) Check expiration
  if (new Date() > new Date(rec.expires_at)) {
    await supabase.from('mfa_recovery_tokens').delete().eq('id', rec.id);
    return { success: false, error: 'Recovery link has expired.' };
  }

  // 6) Fetch the user record
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('id, email')
    .eq('id', rec.user_id)
    .single();
  if (userErr || !user) {
    console.error('[generateNewMfaFromToken] user lookup failed:', userErr);
    return { success: false, error: 'User not found.' };
  }

  // 7) Generate a new TOTP secret
  const newSecret = speakeasy.generateSecret({
    name: `YourAppName (${user.email})`,
    issuer: 'YourAppName',
  });

  // 8) Update the user's MFA settings in the database
  const { error: updateErr } = await supabase
    .from('users')
    .update({
      mfa_secret: newSecret.base32,
      is_mfa_enabled: false,
    })
    .eq('id', user.id);
  if (updateErr) {
    console.error('[generateNewMfaFromToken] user update failed:', updateErr);
    return { success: false, error: 'Failed to set up new MFA secret.' };
  }

  // 9) Generate QR code data URL from the TOTP URI
  let qrCodeDataUrl: string;
  try {
    const otpauthUrl = speakeasy.otpauthURL({
      secret: newSecret.base32,
      label: encodeURIComponent(user.email),
      issuer: 'YourAppName',
      algorithm: 'sha1',
    });
    qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);
  } catch (qrErr) {
    console.error('[generateNewMfaFromToken] QR code generation failed:', qrErr);
    return { success: false, error: 'Failed to generate QR code.' };
  }

  // 10) Invalidate the recovery token to prevent reuse
  await supabase.from('mfa_recovery_tokens').delete().eq('id', rec.id);

  // 11) Return the QR code to the client
  return { success: true, qrCode: qrCodeDataUrl };
}
