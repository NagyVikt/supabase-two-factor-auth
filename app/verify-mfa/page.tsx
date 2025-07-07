'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { enrollMFA } from '@/lib/actions/mfa/enrollMfa'
import { verifyMFA } from '@/lib/actions/mfa/verifyMfa'
import { Icon } from '@iconify/react';
import supabase from '@/lib/supabase/browser'          // new singleton
type EnrollResponse =
  | { totp: { qr_code: string } }
  | { alreadyEnrolled: boolean }

// --- Skeleton Component for Initial Loading ---
const MfaPageSkeleton = () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-900 p-4">
        <div className="w-full max-w-xl bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg shadow-md p-6 sm:p-8 flex flex-col md:flex-row gap-6 sm:gap-8 animate-pulse">
            {/* QR Code Skeleton */}
            <div className="w-full md:w-52 flex-shrink-0 flex flex-col items-center justify-center p-4 border border-dashed border-gray-300 dark:border-neutral-600 rounded-lg">
                <div className="w-40 h-40 bg-gray-200 dark:bg-neutral-700 rounded-lg" />
                <div className="h-2.5 bg-gray-200 dark:bg-neutral-700 rounded-full w-32 mt-3" />
            </div>

            {/* Form Skeleton */}
            <div className="flex-1 flex flex-col justify-center">
                <div className="h-6 bg-gray-200 dark:bg-neutral-700 rounded-full w-3/4 mb-6" />
                <div className="space-y-4">
                    <div className="h-4 bg-gray-200 dark:bg-neutral-700 rounded-full w-1/4 mb-2" />
                    <div className="h-10 bg-gray-200 dark:bg-neutral-700 rounded-lg w-full" />
                    <div className="h-10 bg-gray-300 dark:bg-neutral-600 rounded-lg w-full mt-2" />
                </div>
                <div className="h-px bg-gray-200 dark:bg-neutral-700 my-6" />
                <div className="h-10 bg-gray-200 dark:bg-neutral-700 rounded-lg w-full" />
            </div>
        </div>
    </div>
);


export default function MfaVerification() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMessage = searchParams.get('message') ?? null;

  const [isLoading, setIsLoading] = useState(true); // Start with loading state
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isAlreadyEnrolled, setIsAlreadyEnrolled] = useState(false);
  const [error, setError] = useState<string | null>(initialMessage);
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [recoverMsg, setRecoverMsg] = useState<string | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);

  // Enroll on mount
  useEffect(() => {
    const performEnrollment = async () => {
      setIsLoading(true); // Ensure loading is true at the start
      try {
        const res: EnrollResponse = await enrollMFA();
        if ('totp' in res) {
          setQrCode(res.totp.qr_code);
          setIsAlreadyEnrolled(false);
        } else if (res.alreadyEnrolled) {
          setIsAlreadyEnrolled(true);
          setQrCode(null); // Ensure QR code is null if already enrolled
        }
      } catch (err) {
        console.error("MFA Enrollment Error:", err);
        setError('Failed to initialize MFA setup. Please try refreshing the page.');
      } finally {
        setIsLoading(false); // Stop loading once done
      }
    };

    performEnrollment();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.length < 6 || isVerifying) return;

    setError(null);
    setRecoverMsg(null);
    setIsVerifying(true);

    try {
      const result = await verifyMFA({ verifyCode: code });
      if (result.success) {
        // On success, redirect to the intended protected page or dashboard
        const redirectTo = searchParams.get('callbackUrl') || '/protected';
        router.push(redirectTo);
      } else {
        setError(result.error ?? 'Invalid verification code. Please try again.');
        setCode(''); // Clear input on error
      }
    } catch (err) {
      console.error("MFA Verification Error:", err);
      setError('An unexpected error occurred during verification. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRecover = async () => {
    setError(null); setRecoverMsg(null); setIsRecovering(true);
  
    try {
      // ① fetch the in-memory JWT (still aal-1; no cookies yet)
      const {
        data: { session },
        error: sessionErr,
      } = await supabase.auth.getSession();                // docs example  :contentReference[oaicite:3]{index=3}
      if (sessionErr || !session) throw new Error('No session found');
  
      // ② send it as a Bearer token
      const res = await fetch('/api/mfa/recover', {
        method: 'POST',
        credentials: 'include',                            // keeps working once cookies exist
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
  
      const body: { sent: boolean; error?: string } = await res.json();
      if (body.sent) setRecoverMsg('Recovery email sent — check your inbox.');
      else           setError(body.error ?? 'Could not send recovery email.');
    } catch (err) {
      console.error('MFA Recovery Error:', err);
      setError('An unexpected error occurred while trying to send a recovery email.');
    } finally {
      setIsRecovering(false);
    }
  };
  

  if (isLoading) {
    return <MfaPageSkeleton />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-900 p-4 font-sans">
      <div className={`w-full max-w-xl bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg shadow-md p-6 sm:p-8 flex flex-col md:flex-row gap-6 sm:gap-8 transition-all duration-300`}>
        
        {/* QR Code Section: Render only if a QR code is available */}
        {qrCode && (
          <div className="w-full md:w-52 flex-shrink-0 flex flex-col items-center justify-center text-center">
            <h3 className="text-lg font-semibold text-black dark:text-white mb-3">Scan to Enroll</h3>
            <div className="p-3 bg-white border border-gray-300 dark:border-neutral-600 rounded-lg shadow-inner">
              <img src={qrCode} alt="MFA QR Code" className="w-40 h-40" />
            </div>
            <p className="mt-3 text-xs text-gray-600 dark:text-neutral-400">
              Scan this code with your preferred authenticator app (e.g., Google Authenticator, Authy).
            </p>
          </div>
        )}

        {/* Verification & Recovery Form */}
        <div className={`flex-1 flex flex-col justify-center ${!qrCode ? 'w-full md:max-w-sm mx-auto' : ''}`}>
          <h2 className="text-2xl font-bold text-black dark:text-white mb-2 text-center">
            Two-Factor Authentication
          </h2>
          <p className="text-sm text-gray-600 dark:text-neutral-400 mb-6 text-center">
            {isAlreadyEnrolled
              ? 'Your account is protected. Enter the code from your authenticator app.'
              : 'To complete setup, enter the code shown in your authenticator app.'}
          </p>

          {error && (
            <div className="mb-4 px-3 py-2 bg-red-50 dark:bg-red-900/30 border border-red-500 text-red-700 dark:text-red-300 rounded-md text-sm flex items-center gap-2">
              <Icon icon="mdi:alert-circle-outline" className="text-lg"/>
              <span>{error}</span>
            </div>
          )}
          {recoverMsg && (
            <div className="mb-4 px-3 py-2 bg-green-50 dark:bg-green-900/30 border border-green-500 text-green-700 dark:text-green-300 rounded-md text-sm flex items-center gap-2">
              <Icon icon="mdi:check-circle-outline" className="text-lg"/>
              <span>{recoverMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 mb-4">
            <div>
              <label htmlFor="verifyCode" className="block text-sm font-medium text-black dark:text-neutral-200 mb-1">
                Verification Code
              </label>
              <input
                id="verifyCode"
                name="verifyCode"
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-md text-black dark:text-white bg-white dark:bg-neutral-700 placeholder-gray-500 dark:placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 text-center text-2xl tracking-[0.5em]"
                placeholder="------"
              />
            </div>
            <button
              type="submit"
              disabled={isVerifying || code.length !== 6}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-black text-white font-semibold rounded-md hover:bg-neutral-800 dark:bg-primary-600 dark:hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isVerifying && (
                <Icon icon="mdi:loading" className="animate-spin h-5 w-5" />
              )}
              Verify Code
            </button>
          </form>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-200 dark:border-neutral-700"></div>
            <span className="flex-shrink mx-4 text-xs text-gray-400 dark:text-neutral-500">Or</span>
            <div className="flex-grow border-t border-gray-200 dark:border-neutral-700"></div>
          </div>

          <button
            onClick={handleRecover}
            disabled={isRecovering}
            className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-md text-black dark:text-neutral-200 text-sm hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRecovering ? 'Sending recovery email…' : 'Lost your device? Recover via email'}
          </button>
        </div>
      </div>
    </div>
  )
}
