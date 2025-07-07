'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { generateNewMfaFromToken } from '@/lib/actions/mfa/generateNewMfaFromToken'; // Server action to validate token and get new QR
import { verifyMFA } from '@/lib/actions/mfa/verifyMfa'; // Reuse the existing verification action

interface NewMfaResponse {
  success: boolean;
  qrCode?: string;
  error?: string;
}

interface VerifyResponse {
    success: boolean;
    error?: string;
}

export default function MfaResetFlowPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // State for this specific flow
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // State for the verification step
  const [code, setCode] = useState('');
  const [isVerifying, startVerifying] = useTransition();

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setError('No recovery token found. Please use the link from your email.');
      setIsLoading(false);
      return;
    }

    const initializeNewMfa = async () => {
      try {
        // Call a new server action to validate the token and generate a new MFA secret/QR code
        const result: NewMfaResponse = await generateNewMfaFromToken(token);

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
      }
    };

    initializeNewMfa();
  }, [searchParams]);

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6 || isVerifying) return;
    setError(null);

    startVerifying(async () => {
        try {
            const result: VerifyResponse = await verifyMFA({ verifyCode: code });
            if (result.success) {
                // Redirect to the protected area or dashboard after successful re-enrollment
                router.push('/protected'); 
            } else {
                setError(result.error || 'Invalid code. Please try again.');
            }
        } catch (err) {
            setError('Verification failed. An unexpected error occurred.');
        }
    });
  };

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center">Validating token...</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-900 p-4 font-sans">
      <div className="w-full max-w-md bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg shadow-md p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-black dark:text-white">
            Reset Two-Factor Authentication
          </h1>
        </div>

        {error && (
          <div className="px-3 py-2 bg-red-50 dark:bg-red-900/30 border border-red-500 text-red-700 dark:text-red-300 rounded-md text-sm text-center">
            {error}
          </div>
        )}

        {qrCode ? (
          <>
            <p className="text-center text-gray-700 dark:text-neutral-300 text-sm">
              Your previous authenticator has been disabled. Scan the new QR code with your authenticator app to re-enable MFA on your account.
            </p>
            <div className="flex justify-center">
                <img src={qrCode} alt="New MFA QR Code" className="p-2 bg-white border rounded-lg" />
            </div>
            <form onSubmit={handleVerifySubmit} className="space-y-4 pt-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="w-full border rounded p-2 text-center text-xl tracking-widest dark:bg-neutral-700 dark:text-white"
                placeholder="123456"
                required
              />
              <button
                type="submit"
                disabled={isVerifying || code.length !== 6}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-black text-white font-semibold rounded-md hover:bg-neutral-800 dark:bg-blue-600 dark:hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isVerifying ? 'Verifying...' : 'Enable and Finish'}
              </button>
            </form>
          </>
        ) : (
             <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-neutral-400">
                    If you're seeing this, you may need to request a new recovery link.
                </p>
                 <button
                    onClick={() => router.push('/mfa/recover')} // Path to your MfaRecoveryPage
                    className="mt-4 w-full px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-md text-black dark:text-neutral-200 text-sm font-medium hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
                >
                    Request New Link
                </button>
             </div>
        )}
      </div>
    </div>
  );
}
