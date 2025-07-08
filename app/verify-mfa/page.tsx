'use client';

export const dynamic = 'force-dynamic';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Icon } from '@iconify/react';
import Image from 'next/image';
// --- SERVER ACTIONS ---
// These are now imported from your project's lib/actions directory.
import { enrollMFA } from '@/lib/actions/mfa/enrollMfa';
import { verifyMFA } from '@/lib/actions/mfa/verifyMfa';
import { recoverMfa } from '@/lib/actions/mfa/recoverMfa';

// --- TYPE DEFINITION ---
type EnrollResponse =
  | { totp: { qr_code: string } }
  | { alreadyEnrolled: boolean }
  | { error: string };

// --- SKELETON COMPONENT FOR A BETTER LOADING EXPERIENCE ---
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

// --- MAIN MFA COMPONENT ---
function MfaVerificationInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMessage = searchParams.get('message') ?? null;

  // Component State
  const [isLoading, setIsLoading] = useState(true);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isAlreadyEnrolled, setIsAlreadyEnrolled] = useState(false);
  const [error, setError] = useState<string | null>(initialMessage);
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [recoverMsg, setRecoverMsg] = useState<string | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);

  // Rate Limiting State
  const [attempts, setAttempts] = useState(0);
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null);

  // Load attempts data from localStorage on component mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('mfaAttempts');
      if (raw) {
        const { attempts: a, blockedUntil: b } = JSON.parse(raw);
        if (typeof a === 'number') setAttempts(a);
        if (typeof b === 'number' && Date.now() < b) {
            setBlockedUntil(b);
        }
      }
    } catch {
      // Ignore malformed data in localStorage
      localStorage.removeItem('mfaAttempts');
    }
  }, []);

  // Persist attempts data whenever it changes
  useEffect(() => {
    localStorage.setItem(
      'mfaAttempts',
      JSON.stringify({ attempts, blockedUntil })
    );
  }, [attempts, blockedUntil]);

  // Effect to handle the initial MFA enrollment check
  useEffect(() => {
    const performEnrollment = async () => {
      setIsLoading(true);
      try {
        const res: EnrollResponse = await enrollMFA();
        if ('totp' in res && res.totp) {
          setQrCode(res.totp.qr_code);
          setIsAlreadyEnrolled(false);
        } else if ('alreadyEnrolled' in res && res.alreadyEnrolled) {
          setIsAlreadyEnrolled(true);
          setQrCode(null);
        } else if ('error' in res) {
           setError(res.error as string | null);
        }
      } catch (err) {
        console.error("MFA Enrollment Error:", err);
        setError('Failed to initialize MFA setup. Please try refreshing the page.');
      } finally {
        setIsLoading(false);
      }
    };
    performEnrollment();
  }, []);

  // Handler for submitting the verification code
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.length < 6 || isVerifying || isRecovering) return;
    
    const now = Date.now();
    if (blockedUntil && now < blockedUntil) {
      const mins = Math.ceil((blockedUntil - now) / 60000);
      setError(`Too many incorrect codes. Try again in ${mins} minute${mins > 1 ? 's' : ''}.`);
      return;
    }

    setError(null);
    setRecoverMsg(null);
    setIsVerifying(true);

    try {
      const result = await verifyMFA({ verifyCode: code });
      if (result.success) {
        setAttempts(0);
        setBlockedUntil(null);
        const redirectTo = searchParams.get('callbackUrl') || '/protected';
        router.push(redirectTo);
      } else {
        const newAttempts = attempts + 1;
        if (newAttempts >= 5) {
          const blockDuration = 5 * 60 * 1000; // 5 minutes
          setBlockedUntil(Date.now() + blockDuration);
          setAttempts(0); // Reset attempts after blocking
          setError('Too many incorrect codes. For your security, please wait 5 minutes before trying again.');
        } else {
          setAttempts(newAttempts);
          setError(result.error ?? 'Invalid verification code. Please try again.');
        }
        setCode('');
      }
    } catch (_err) {
      console.error("MFA Verification Error:", _err);
      setError('An unexpected error occurred during verification.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Handler for the email recovery flow
  const handleRecover = async () => {
    setError(null);
    setRecoverMsg(null);
    setIsRecovering(true);
    try {
      const result = await recoverMfa();
      if (result.success) {
        setRecoverMsg('Recovery email sent. Please check your inbox and follow the instructions.');
      } else {
        setError(result.error ?? 'Could not send recovery email. Please try again later.');
      }
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
      <div className={`w-full max-w-xl bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg shadow-lg p-6 sm:p-8 flex flex-col md:flex-row gap-6 sm:gap-8 transition-all duration-300`}>
        
        {/* QR Code Section (Only for new enrollment) */}
        {qrCode && !isAlreadyEnrolled && (
          <div className="w-full md:w-52 flex-shrink-0 flex flex-col items-center justify-center text-center">
            <h3 className="text-lg font-semibold text-black dark:text-white mb-3">Scan to Enroll</h3>
            <div className="p-3 bg-white border border-gray-300 dark:border-neutral-600 rounded-lg shadow-inner">
            <Image
              src={qrCode!}
              alt="MFA QR Code"
              width={160}
              height={160}
              className="border rounded-lg"
              priority
            />
            </div>
            <p className="mt-3 text-xs text-gray-600 dark:text-neutral-400">
              Use an authenticator app like Google Authenticator or Authy.
            </p>
          </div>
        )}

        {/* Verification Form Section */}
        <div className={`flex-1 flex flex-col justify-center ${!qrCode ? 'w-full md:max-w-sm mx-auto' : ''}`}>
          <h2 className="text-2xl font-bold text-black dark:text-white mb-2 text-center">
            Two-Factor Authentication
          </h2>
          <p className="text-sm text-gray-600 dark:text-neutral-400 mb-6 text-center">
            {isAlreadyEnrolled
              ? 'Your account is protected. Enter the 6-digit code from your authenticator app.'
              : 'To complete setup, scan the QR code and enter the 6-digit code from your app.'}
          </p>

          {/* Dynamic Message Area */}
          {error && <div className="mb-4 px-3 py-2 bg-red-50 dark:bg-red-900/30 border border-red-500/50 text-red-700 dark:text-red-300 rounded-md text-sm flex items-start gap-2.5"><Icon icon="mdi:alert-circle-outline" className="text-lg mt-0.5 flex-shrink-0"/><span>{error}</span></div>}
          {recoverMsg && <div className="mb-4 px-3 py-2 bg-green-50 dark:bg-green-900/30 border border-green-500/50 text-green-700 dark:text-green-300 rounded-md text-sm flex items-start gap-2.5"><Icon icon="mdi:check-circle-outline" className="text-lg mt-0.5 flex-shrink-0"/><span>{recoverMsg}</span></div>}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="verifyCode" className="sr-only">Verification Code</label>
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
                className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-md text-black dark:text-white bg-white dark:bg-neutral-700 placeholder-gray-500 dark:placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-center text-3xl tracking-[0.3em] font-mono" 
                placeholder="------" 
              />
            </div>
            <button 
              type="submit" 
              disabled={isVerifying || code.length !== 6 || !!blockedUntil || isRecovering} 
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-black text-white font-semibold rounded-md hover:bg-neutral-800 dark:bg-blue-600 dark:hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isVerifying && <Icon icon="mdi:loading" className="animate-spin h-5 w-5" />}
              Verify Code
            </button>
          </form>

          {/* Recovery Option (Only for enrolled users) */}
          {isAlreadyEnrolled && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-gray-300 dark:border-neutral-600" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-neutral-800 text-gray-500 dark:text-neutral-400">Or</span>
                </div>
              </div>

              <div className="text-center">
                 <button 
                    onClick={handleRecover} 
                    disabled={isRecovering || isVerifying}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 dark:text-neutral-200 dark:bg-neutral-700 font-semibold rounded-md hover:bg-gray-200 dark:hover:bg-neutral-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                   {isRecovering ? (
                      <>
                        <Icon icon="mdi:loading" className="animate-spin h-5 w-5" />
                        <span>Sending...</span>
                      </>
                   ) : (
                     <>
                        <Icon icon="mdi:email-fast-outline" className="h-5 w-5" />
                        <span>Reset with Email</span>
                     </>
                   )}
                 </button>
                 <p className="mt-2 text-xs text-gray-500 dark:text-neutral-500">
                    Lost your device? We&apos;ll send a recovery link to your email.
                 </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MfaVerification() {
  return (
    <Suspense fallback={<MfaPageSkeleton />}>
      <MfaVerificationInner />
    </Suspense>
  );
}
