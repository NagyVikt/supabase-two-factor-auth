/*
================================================================================
|                                                                              |
|  Part 2: Refined Client-Side MFA Verification Component                      |
|  File: components/auth/MfaVerification.tsx                                   |
|                                                                              |
|  This component provides the UI for the user to set up and verify their      |
|  MFA code. It handles initial enrollment, code submission, and the           |
|  recovery flow. It has been improved with better state management and        |
|  clearer user feedback.                                                      |
|                                                                              |
================================================================================
*/
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { enrollMFA, verifyMFA } from '@/lib/actions/mfa'; // Assumes server actions are in this file

// Define a more specific type for the enrollment response
type EnrollResponse = {
  qrCode?: string;
  error?: string;
  alreadyEnrolled?: boolean;
};

export default function MfaVerification() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialError = searchParams.get('message');

  // State management
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(initialError);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);

  // Ref to prevent double-running useEffect in Strict Mode
  const enrollEffectRan = useRef(false);

  // Effect to enroll the user when the component mounts
  useEffect(() => {
    if (enrollEffectRan.current || process.env.NODE_ENV !== 'development') {
      const performEnrollment = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const res: EnrollResponse = await enrollMFA();
          if (res.qrCode) {
            setQrCode(res.qrCode);
          } else if (res.alreadyEnrolled) {
            setError('You are already enrolled. Please enter the code from your authenticator app.');
          } else {
            setError(res.error || 'An unknown error occurred during MFA setup.');
          }
        } catch (err) {
          setError('Failed to initialize MFA. Please refresh the page to try again.');
        } finally {
          setIsLoading(false);
        }
      };
      performEnrollment();
    }
    return () => {
      enrollEffectRan.current = true;
    };
  }, []);

  // Handler for submitting the verification code
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6 || isVerifying) return;

    setError(null);
    setSuccessMessage(null);
    setIsVerifying(true);

    try {
      const result = await verifyMFA({ verifyCode: code });
      if (result.success) {
        // On success, redirect the user.
        const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
        router.push(callbackUrl);
      } else {
        setError(result.error || 'The code you entered is invalid. Please try again.');
        setCode('');
      }
    } catch {
      setError('An unexpected error occurred during verification.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Handler for the email recovery process
  const handleRecover = async () => {
    setError(null);
    setSuccessMessage(null);
    setIsRecovering(true);

    try {
      const res = await fetch('/api/mfa/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const body = await res.json();

      if (res.ok && body.sent) {
        setSuccessMessage('Recovery email sent! Check your inbox for a new QR code.');
        // Optionally, you could refresh the page or guide the user to re-scan.
      } else {
        setError(body.error || 'Could not send the recovery email.');
      }
    } catch (err) {
      console.error('MFA Recovery Fetch Error:', err);
      setError('An unexpected network error occurred while trying to recover.');
    } finally {
      setIsRecovering(false);
    }
  };
  
  // Loading skeleton
  if (isLoading) {
    return (
      <div className="w-full max-w-md mx-auto mt-8 p-8 border rounded-lg shadow-md animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-3/4 mx-auto mb-6"></div>
        <div className="h-40 w-40 bg-gray-200 rounded-md mx-auto mb-6"></div>
        <div className="h-12 bg-gray-200 rounded w-full mb-4"></div>
        <div className="h-12 bg-gray-300 rounded w-full"></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto mt-8 p-6 md:p-8 bg-white border border-gray-200 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4 text-center text-gray-800">Two-Factor Authentication</h2>

      {error && <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-md text-sm">{error}</div>}
      {successMessage && <div className="mb-4 p-3 bg-green-100 text-green-800 rounded-md text-sm">{successMessage}</div>}

      {qrCode && (
        <div className="mb-6 p-4 border rounded-md text-center bg-gray-50">
           <p className="text-sm text-gray-600 mb-3">Scan this QR code with your authenticator app (e.g., Google Authenticator, Authy).</p>
          <img src={qrCode} alt="MFA QR Code" className="mx-auto rounded-lg" />
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="mfa-code" className="sr-only">Verification Code</label>
          <input
            id="mfa-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="123 456"
            className="w-full p-3 border rounded-md text-center text-2xl tracking-widest font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>
        <button
          type="submit"
          disabled={isVerifying || code.length !== 6}
          className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isVerifying ? 'Verifying…' : 'Verify & Sign In'}
        </button>
      </form>

      <div className="flex items-center my-6">
        <hr className="flex-1 border-t border-gray-300" />
        <span className="px-4 text-sm text-gray-500">Lost your device?</span>
        <hr className="flex-1 border-t border-gray-300" />
      </div>

      <button
        onClick={handleRecover}
        disabled={isRecovering}
        className="w-full py-3 px-4 border border-gray-300 text-gray-700 font-semibold rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isRecovering ? 'Sending Email…' : 'Recover Access via Email'}
      </button>
    </div>
  );
}