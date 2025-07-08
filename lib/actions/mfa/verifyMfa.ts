// lib/actions/mfa/verifyMfa.ts
"use client";

import { createClient } from "@/lib/supabase/browser";
import type { Factor } from "@supabase/auth-js";

export interface VerifyMfaResult {
  success: boolean;
  error?: string;
}

export async function verifyMFA({
  verifyCode,
}: {
  verifyCode: string;
}): Promise<VerifyMfaResult> {
  if (!verifyCode) {
    return { success: false, error: "Missing verification code" };
  }

  try {
    const supabase = createClient();
    // 1) List existing MFA factors for the user
    const { data: listData, error: listErr } =
      await supabase.auth.mfa.listFactors();
    if (listErr) {
      return { success: false, error: listErr.message };
    }

    // 2) Pick an unverified factor if available, otherwise fall back to the first one
    const factorId =
      listData.all.find((f: Factor) => f.status === "unverified")?.id ??
      listData.all[0]?.id;
    if (!factorId) {
      return { success: false, error: "No MFA factor found to verify." };
    }

    // 3) Initiate a challenge for that factor
    const { data: chall, error: challErr } = await supabase.auth.mfa.challenge({
      factorId,
    });
    if (challErr) {
      return { success: false, error: challErr.message };
    }

    // 4) Verify the code against the challenge
    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: chall.id,
      code: verifyCode,
    });
    if (verifyErr) {
      return { success: false, error: verifyErr.message };
    }

    // 5) Success!
    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred.";
    return { success: false, error: message };
  }
}
