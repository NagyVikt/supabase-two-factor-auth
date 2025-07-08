'use client';

export const dynamic = 'force-dynamic';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Icon } from '@iconify/react';

import { enrollMFA } from '@/lib/actions/mfa/enrollMfa';
import { verifyMFA } from '@/lib/actions/mfa/verifyMfa';
import { recoverMfa } from '@/lib/actions/mfa/recoverMfa';

type EnrollResponse =
  | { totp: { qr_code: string } }
  | { alreadyEnrolled: boolean }
  | { error: string | null };

const MfaPageSkeleton = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-900 p-4">
    {/* ...same skeleton as before */}
    <div className="animate-pulse">Loading MFA…</div>
  </div>
);

function MfaVerificationInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMessage = searchParams.get('message') ?? null;

  const [isLoading, setIsLoading] = useState(true);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isAlreadyEnrolled, setIsAlreadyEnrolled] = useState(false);
  const [error, setError] = useState<string | null>(initialMessage);
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [recoverMsg, setRecoverMsg] = useState<string | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('mfaEnrollAttempts');
      if (raw) {
        const { attempts: a, blockedUntil: b } = JSON.parse(raw);
        if (typeof a === 'number') setAttempts(a);
        if (typeof b === 'number') setBlockedUntil(b);
      }
    } catch {
      // ignore malformed data
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      'mfaEnrollAttempts',
      JSON.stringify({ attempts, blockedUntil })
    );
  }, [attempts, blockedUntil]);

  useEffect(() => {
    const performEnrollment = async () => {
      setIsLoading(true);
      const res: EnrollResponse = await enrollMFA();
      if ('totp' in res) {
        setQrCode(res.totp.qr_code);
      } else if ('alreadyEnrolled' in res && res.alreadyEnrolled) {
        setIsAlreadyEnrolled(true);
      } 
      else if ('error' in res) {
        setError(res.error as string | null);
      } else {
        setError('Unexpected response from server.');
      }

      setIsLoading(false);
    };
    performEnrollment();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6 || isVerifying) return;
    const now = Date.now();
    if (blockedUntil && now < blockedUntil) {
      const mins = Math.ceil((blockedUntil - now) / 60000);
      setError(`Too many incorrect codes. Try again in ${mins} minute${mins > 1 ? 's' : ''}.`);
      return;
    }
    setError(null);
    setIsVerifying(true);
    const result = await verifyMFA({ verifyCode: code });
    setIsVerifying(false);

    if (result.success) {
      setAttempts(0);
      setBlockedUntil(null);
      router.push(searchParams.get('callbackUrl') || '/protected');
    } else {
      const newAttempts = attempts + 1;
      if (newAttempts >= 3) {
        setBlockedUntil(Date.now() + 10 * 60 * 1000);
        setAttempts(0);
        setError('Too many incorrect codes. Please wait 10 minutes before trying again.');
      } else {
        setAttempts(newAttempts);
        setError(result.error ?? 'Invalid code.');
      }
      setCode('');
    }
  };

  const handleRecover = async () => {
    if (isRecovering) return;
    setError(null);
    setIsRecovering(true);
    const result = await recoverMfa();
    setIsRecovering(false);

    if (result.success) {
      setRecoverMsg('Recovery email sent — check your inbox.');
    } else {
      setError(result.error ?? 'Failed to send recovery email.');
    }
  };

  if (isLoading) return <MfaPageSkeleton />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-900 p-4">
      <div className="w-full max-w-xl bg-white dark:bg-neutral-800 border rounded-lg shadow-md p-6 flex flex-col md:flex-row gap-6 transition-all">
        {qrCode && (
          <div className="md:w-52 flex flex-col items-center">
            <h3 className="text-lg font-semibold mb-2">Scan to Enroll</h3>
            <img src={qrCode} alt="MFA QR Code" className="w-40 h-40 border rounded-lg" />
            <p className="mt-2 text-xs text-gray-600 dark:text-neutral-400 text-center">
              Use your authenticator app to scan.
            </p>
          </div>
        )}
        <div className="flex-1">
          <h2 className="text-2xl font-bold mb-2 text-center">Two-Factor Authentication</h2>
          <p className="text-sm text-gray-600 mb-4 text-center">
            {isAlreadyEnrolled
              ? 'Enter the code from your authenticator app.'
              : 'To finish setup, enter the code from your authenticator app.'}
          </p>

          {error && (
            <div className="mb-4 px-3 py-2 bg-red-50 border border-red-500 text-red-700 rounded-md flex items-center gap-2">
              <Icon icon="mdi:alert-circle-outline" />
              <span>{error}</span>
            </div>
          )}
          {recoverMsg && (
            <div className="mb-4 px-3 py-2 bg-green-50 border border-green-500 text-green-700 rounded-md flex items-center gap-2">
              <Icon icon="mdi:check-circle-outline" />
              <span>{recoverMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 mb-4">
            <input
              type="text"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full text-center text-2xl tracking-[0.5em] p-2 border rounded-md"
              placeholder="------"
            />
            <button
              type="submit"
              disabled={code.length !== 6 || isVerifying}
              className="w-full py-2 bg-black text-white rounded-md disabled:opacity-50"
            >
              {isVerifying ? <Icon icon="mdi:loading" className="animate-spin" /> : 'Verify Code'}
            </button>
          </form>

          <div className="flex items-center mb-4">
            <div className="flex-grow border-t" />
            <span className="px-2 text-xs text-gray-400">Or</span>
            <div className="flex-grow border-t" />
          </div>

          <button
            onClick={handleRecover}
            disabled={isRecovering}
            className="w-full py-2 border rounded-md disabled:opacity-50"
          >
            {isRecovering ? 'Sending…' : 'Lost your device? Recover via email'}
          </button>
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
