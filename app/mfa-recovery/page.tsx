'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react';

// --- SERVER ACTIONS ---
// These actions are assumed to be in your project.
// generateNewMfaFromToken should be designed to accept the access_token from the Supabase redirect.
import { generateNewMfaFromToken } from '@/lib/actions/mfa/generateNewMfaFromToken'; 
import { verifyMFA } from '@/lib/actions/mfa/verifyMfa';

// --- TYPE DEFINITIONS ---
interface NewMfaResponse {
  success: boolean;
  qrCode?: string;
  error?: string;
}

interface VerifyResponse {
    success: boolean;
    error?: string;
}

// --- SKELETON COMPONENT FOR LOADING STATE ---
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
  
  // State for this specific flow
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // State for the verification step
  const [code, setCode] = useState('');
  const [isVerifying, startVerifying] = useTransition();

  useEffect(() => {
    // Supabase redirects with the token in the URL fragment (#), not a query param (?).
    // We must parse it from window.location.hash on the client side.
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.substring(1)); // Remove the '#' and parse
    const accessToken = params.get('access_token');
    const errorDescription = params.get('error_description');

    if (errorDescription) {
        setError(errorDescription);
        setIsLoading(false);
        return;
    }

    if (!accessToken) {
      setError('No recovery token found in the URL. Please use the link from your email again.');
      setIsLoading(false);
      return;
    }

    const initializeNewMfa = async (token: string) => {
      try {
        // The error "result is undefined" originates if the server action fails before returning a value.
        // The fix is in the server action itself, which was not correctly validating the accessToken.
        const result: NewMfaResponse = await generateNewMfaFromToken(token);

        if (result && result.success && result.qrCode) {
          setQrCode(result.qrCode);
        } else {
          setError(result?.error ?? 'Invalid or expired token. Please request a new recovery link.');
        }
      } catch (err) {
        console.error('MFA Reset Client Error:', err);
        setError('An unexpected error occurred while resetting your authenticator. Please try again.');
      } finally {
        setIsLoading(false);
        // Clean the URL to remove the token from the address bar
        window.history.replaceState(null, '', window.location.pathname);
      }
    };

    initializeNewMfa(accessToken);
  }, []); // Empty dependency array ensures this runs only once on mount

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
                setCode('');
            }
        } catch (err) {
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
        <div className="text-center">
          <h1 className="text-2xl font-bold text-black dark:text-white">
            Reset Two-Factor Authentication
          </h1>
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-500/50 text-red-700 dark:text-red-300 rounded-md text-sm flex items-start gap-2.5">
            <Icon icon="mdi:alert-circle-outline" className="text-lg mt-0.5 flex-shrink-0"/>
            <span>{error}</span>
          </div>
        )}

        {qrCode ? (
          <>
            <p className="text-center text-gray-700 dark:text-neutral-300 text-sm">
              Your old authenticator is disabled. Scan this new QR code with your app to secure your account.
            </p>
            <div className="flex justify-center p-3 bg-white border border-gray-300 dark:border-neutral-600 rounded-lg shadow-inner">
                <img src={qrCode} alt="New MFA QR Code" className="w-48 h-48" onError={(e) => { e.currentTarget.src = 'https://placehold.co/192x192/e2e8f0/e2e8f0?text=QR'; e.currentTarget.alt = 'QR Code Placeholder'; }} />
            </div>
            <form onSubmit={handleVerifySubmit} className="space-y-4 pt-2">
              <div>
                <label htmlFor="verifyCode" className="sr-only">Verification Code</label>
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
              </div>
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
                    If you're seeing this error, your link may be invalid or you may need to request a new one.
                </p>
                 <button
                    onClick={() => router.push('/login')} // Redirect to a safe page like login
                    className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 dark:text-neutral-200 dark:bg-neutral-700 font-semibold rounded-md hover:bg-gray-200 dark:hover:bg-neutral-600 transition-colors"
                >
                    <Icon icon="mdi:arrow-left" />
                    Back to Login
                </button>
             </div>
        )}
      </div>
    </div>
  );
}
