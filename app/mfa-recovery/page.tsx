'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react';
import Image from 'next/image';
import { generateNewMfaFromToken } from '@/lib/actions/mfa/generateNewMfaFromToken';
import { verifyMFA } from '@/lib/actions/mfa/verifyMfa';

interface NewMfaResponse {
  success: boolean;
  qrCode?: string;
  error?: string;
}

interface VerifyResponse {
  success: boolean;
  error?: string;
}

const MfaResetSkeleton = () => (
  <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-neutral-900 p-4">
    <div className="w-full max-w-md text-center">
      <Icon icon="mdi:loading" className="animate-spin h-8 w-8 text-blue-500 mb-4" />
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
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [code, setCode] = useState('');
  const [isVerifying, startVerifying] = useTransition();

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const token = searchParams.get('token') || hashParams.get('access_token');
    const errorDesc = searchParams.get('error') || hashParams.get('error');

    if (errorDesc) {
      setError(errorDesc);
      setIsLoading(false);
      return;
    }

    if (!token) {
      setError('No token provided.');
      setIsLoading(false);
      return;
    }

    (async (t: string) => {
      try {
        const result: NewMfaResponse = await generateNewMfaFromToken(t);
        if (result.success && result.qrCode) {
          setQrCode(result.qrCode);
        } else {
          setError(result.error ?? 'Invalid or expired token. Please request a new link.');
        }
      } catch (e) {
        console.error('MFA Reset Client Error:', e);
        setError('An unexpected error occurred.');
      } finally {
        setIsLoading(false);
        window.history.replaceState(null, '', window.location.pathname);
      }
    })(token);
  }, []);

  const handleVerifySubmit = async (e: React.FormEvent) => {
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
      } catch (e) {
        console.error('Verification Error:', e);
        setError('Verification failed. Please try again.');
      }
    });
  };

  if (isLoading) return <MfaResetSkeleton />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-900 p-4 font-sans">
      <div className="w-full max-w-md bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg shadow-lg p-8 space-y-6">
        <h1 className="text-2xl font-bold text-black dark:text-white text-center">
          Reset Two-Factor Authentication
        </h1>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-500/50 text-red-700 dark:text-red-300 rounded-md text-sm flex items-start gap-2">
            <Icon icon="mdi:alert-circle-outline" className="text-lg mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {qrCode ? (
          <>
            <p className="text-center text-gray-700 dark:text-neutral-300 text-sm">
              Scan this new QR code with your authenticator app.
            </p>
            <div className="flex justify-center p-3 bg-white border border-gray-300 dark:border-neutral-600 rounded-lg shadow-inner">
              <Image src={qrCode} alt="new MFA QR code" width={160} height={160} priority />
            </div>
            <form onSubmit={handleVerifySubmit} className="space-y-4 pt-2">
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]{6}"
                title="Please enter exactly 6 digits"
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-2 text-center text-3xl font-mono border border-gray-300 dark:border-neutral-600 rounded-md"
                placeholder="------"
                required
              />
              <button
                type="submit"
                disabled={isVerifying || code.length !== 6}
                className="w-full py-2 bg-black text-white rounded-md disabled:opacity-50"
              >
                {isVerifying ? <Icon icon="mdi:loading" className="animate-spin h-5 w-5" /> : 'Enable and Finish'}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-neutral-400">
              No valid QR code. Your link may have expired.
            </p>
            <button
              onClick={() => router.push('/login')}
              className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-md"
            >
              Back to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
