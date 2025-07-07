// lib/actions/mfa/generateNewMfaFromToken.ts
'use server';

// UPDATED: Import the Supabase server client creator
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
} from '@/lib/supabase/utils';



// Define the expected response shape for type safety
interface ActionResponse {
  success: boolean;
  qrCode?: string;
  error?: string;
}

// Schema to validate the input token
const TokenSchema = z.string().min(1, { message: 'Token is required.' });

/**
 * Validates an MFA recovery token, disables the user's old MFA,
 * and generates a new secret and QR code for re-enrollment using Supabase.
 *
 * @param token The single-use recovery token from the email link.
 * @returns An object containing the success status and either a QR code or an error message.
 */
export async function generateNewMfaFromToken(
  token: string
): Promise<ActionResponse> {
  // 1. Validate the input
  const validation = TokenSchema.safeParse(token);
  if (!validation.success) {
    return { success: false, error: 'Invalid token provided.' };
  }

  // Clients used to validate the token and perform MFA actions
  const adminClient = createSupabaseClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const userClient = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${validation.data}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // 2. Validate the access token and retrieve the user
    const {
      data: { user },
      error: userError,
    } = await adminClient.auth.getUser(validation.data);

    if (userError || !user) {
      return {
        success: false,
        error: 'Invalid or expired token. Please request a new recovery link.',
      };
    }

    // 3. Remove any existing TOTP factors for this user
    const { data: factors, error: listErr } = await adminClient.auth.admin.mfa.listFactors({
      userId: user.id,
    });
    if (listErr) {
      console.error('List factors error:', listErr);
      return { success: false, error: 'Failed to reset existing factors.' };
    }
    for (const f of factors.factors.filter((f) => f.factor_type === 'totp')) {
      const { error: delErr } = await adminClient.auth.admin.mfa.deleteFactor({
        userId: user.id,
        id: f.id,
      });
      if (delErr) {
        console.error('Delete factor error:', delErr);
        return { success: false, error: 'Failed to disable old authenticator.' };
      }
    }

    // 4. Enroll a new TOTP factor using the user's token
    const { data: enrollData, error: enrollErr } = await userClient.auth.mfa.enroll({
      factorType: 'totp',
    });
    if (enrollErr || !enrollData?.totp?.qr_code) {
      console.error('Enroll MFA error:', enrollErr);
      return { success: false, error: 'Failed to create new authenticator factor.' };
    }

    return { success: true, qrCode: enrollData.totp.qr_code };

  } catch (error) {
    console.error('MFA TOKEN GENERATION ERROR:', error);
    return {
      success: false,
      error: 'An unexpected server error occurred. Please try again later.',
    };
  }
}
