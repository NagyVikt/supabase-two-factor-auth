// lib/actions/mfa/generateNewMfaFromToken.ts
'use server';

// UPDATED: Import the Supabase server client creator
import { createClient } from '@/lib/supabase/client'; 
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { z } from 'zod';

// NOTE: You might have these types defined elsewhere, e.g., from Supabase codegen.
// These are placeholders based on the previous Prisma schema.
interface User {
  id: string;
  email: string;
  // add other user properties as needed
}

interface MfaRecoveryToken {
  id: string;
  token: string;
  expiresAt: Date;
  userId: string;
}


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

  // Instantiate the Supabase client for server-side use
  const supabase = await createClient();

  try {
    // 2. Find the recovery token in the database using Supabase
    const { data: recoveryToken, error: tokenError } = await supabase
      .from('mfa_recovery_tokens') // Assumes table name is 'mfa_recovery_tokens'
      .select('*')
      .eq('token', validation.data)
      .single<MfaRecoveryToken>();

    if (tokenError || !recoveryToken) {
      return { success: false, error: 'Recovery link is invalid.' };
    }

    // 3. Check if the token has expired
    if (new Date() > new Date(recoveryToken.expiresAt)) {
      // Clean up expired token
      await supabase.from('mfa_recovery_tokens').delete().eq('id', recoveryToken.id);
      return { success: false, error: 'Recovery link has expired. Please request a new one.' };
    }

    // 4. Find the associated user
    const { data: user, error: userError } = await supabase
        .from('users') // Assumes table name is 'users'
        .select('*')
        .eq('id', recoveryToken.userId)
        .single<User>();

    if (userError || !user) {
      return { success: false, error: 'User not found.' };
    }

    // 5. Generate a new MFA secret
    const newSecret = speakeasy.generateSecret({
      name: `YourAppName (${user.email})`, // Customize with your app name
    });

    // 6. Update the user record with the new (unverified) secret
    const { error: updateUserError } = await supabase
        .from('users')
        .update({
            mfa_secret: newSecret.base32, // Assumes column name is 'mfa_secret'
            is_mfa_enabled: false, // Assumes column name is 'is_mfa_enabled'
        })
        .eq('id', user.id);

    if (updateUserError) {
        throw updateUserError;
    }

    // 7. Generate the QR code data URL for the client
    // The otpauthURL is a standard format that authenticator apps understand.
      const otpauthUrl = speakeasy.otpauthURL({
        secret: newSecret.base32,
        label: encodeURIComponent(user.email ?? 'user'),
        issuer: 'YourAppName', // Should be the name of your application
        algorithm: 'sha1',
      });

    // We convert this URL into a Base64-encoded image (a "data URL").
    // This data URL can be used directly as the `src` for an `<img>` tag on the client-side,
    // just like in the component you provided. Example: <img src={qrCodeDataUrl} />
    const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);
    
    // 8. Invalidate the recovery token by deleting it to prevent reuse
    await supabase.from('mfa_recovery_tokens').delete().eq('id', recoveryToken.id);

    // 9. Return the QR code for the user to scan on the client.
    // The client-side component will receive this `qrCode` and display it as an image.
    return {
      success: true,
      qrCode: qrCodeDataUrl,
    };

  } catch (error) {
    console.error('MFA TOKEN GENERATION ERROR:', error);
    return {
      success: false,
      error: 'An unexpected server error occurred. Please try again later.',
    };
  }
}
