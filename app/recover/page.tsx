// app/recover/page.tsx
'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react';
import Image from 'next/image';

// --- SERVER ACTIONS ---
import { generateNewMfaFromToken } from '@/lib/actions/mfa/generateNewMfaFromToken';
import { verifyMFA } from '@/lib/actions/mfa/verifyMfa';

// --- TYPES ---
interface NewMfaResponse {
  success: boolean;
  qrCode?: string;
  error?: string;
}

interface VerifyResponse {
  success: boolean;
  error?: string;
}

// --- SKELETON WHILE LOADING ---
const MfaResetSkeleton = () => (
  <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-neutral-900 p-4">
    <div className="w-full max-w-md text-center">
      <div className="flex justify-center items-center mb-4">
        <Icon icon="mdi:loading" className="animate-spin h-8 w-8 text-blue-500" />
      </div>
      <h1 className="text-xl font-semibold text-gray-700 dark:text-neutral-300">
        Validating recovery link...
      </h1>
      <p className="text-sm text-gray-500 dark:text-neutral-500 mt-2">
        Please wait a moment.
      </p>
    </div>
  </div>
);

export default function MfaResetFlowPage() {
  const router = useRouter();

  // State for initial MFA reset
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // State for the verify step
  const [code, setCode] = useState('');
  const [isVerifying, startVerifying] = useTransition();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const errorDescription = params.get('error');

    if (errorDescription) {
      setError(decodeURIComponent(errorDescription));
      setIsLoading(false);
      return;
    }

    if (!token) {
      setError('No token provided');
      setIsLoading(false);
      return;
    }

    (async () => {
      try {
        const result: NewMfaResponse = await generateNewMfaFromToken(token!);
        if (result.success && result.qrCode) {
          setQrCode(result.qrCode);
        } else {
          setError(result.error ?? 'Invalid or expired token. Please request a new recovery link.');
        }
      } catch (err) {
        console.error('MFA Reset Client Error:', err);
        setError('An unexpected error occurred. Please try again.');
      } finally {
        setIsLoading(false);
        // clean the URL
        window.history.replaceState(null, '', window.location.pathname);
      }
    })();
  }, []);

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6 || isVerifying) return;
    setError(null);

    startVerifying(async () => {
      try {
        const result: VerifyResponse = await verifyMFA({ verifyCode: code });
        if (result.success) {
          router.push('/protected');
        } else {
          setError(result.error || 'Invalid code. Please try again.');
          setCode('');
        }
      } catch {
        setError('Verification failed. An unexpected error occurred.');
      }
    });
  };

  if (isLoading) {
    return <MfaResetSkeleton />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-900 p-4 font-sans">
      <div className="w-full max-w-md bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg shadow-lg p-8 space-y-6">
        <h1 className="text-2xl font-bold text-black dark:text-white text-center">
          Reset Two-Factor Authentication
        </h1>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-500/50 text-red-700 dark:text-red-300 rounded-md text-sm flex items-start gap-2.5">
            <Icon icon="mdi:alert-circle-outline" className="text-lg mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {qrCode ? (
          <>
            <p className="text-center text-gray-700 dark:text-neutral-300 text-sm">
              Your old authenticator is disabled. Scan this QR code with your app to secure your account.
            </p>
            <div className="flex justify-center p-3 bg-white border border-gray-300 dark:border-neutral-600 rounded-lg shadow-inner">
              <Image
                src={qrCode}
                alt="New MFA QR Code"
                width={160}
                height={160}
                className="border rounded-lg"
                priority
              />
            </div>

            <form onSubmit={handleVerifySubmit} className="space-y-4 pt-2">
              <input
                id="verifyCode"
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-md text-black dark:text-white bg-white dark:bg-neutral-700 placeholder-gray-500 dark:placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-center text-3xl tracking-[0.3em] font-mono"
                placeholder="------"
                required
              />
              <button
                type="submit"
                disabled={isVerifying || code.length !== 6}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-black text-white font-semibold rounded-md hover:bg-neutral-800 dark:bg-blue-600 dark:hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isVerifying && <Icon icon="mdi:loading" className="animate-spin h-5 w-5" />}
                Enable and Finish
              </button>
            </form>
          </>
        ) : (
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-neutral-400">
              If you&apos;re seeing this, your link may be invalid or expired.
            </p>
            <button
              onClick={() => router.push('/login')}
              className="mt-4 w-full px-4 py-2.5 bg-gray-100 text-gray-700 dark:bg-neutral-700 dark:text-neutral-200 rounded-md hover:bg-gray-200 dark:hover:bg-neutral-600 transition-colors"
            >
              <Icon icon="mdi:arrow-left" className="inline-block mr-2" />
              Back to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
