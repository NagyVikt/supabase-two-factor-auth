'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { enrollMFA } from '@/lib/actions/mfa/enrollMfa';
import { verifyMFA } from '@/lib/actions/mfa/verifyMfa';

type EnrollResponse =
  | { totp: { qr_code: string } }
  | { alreadyEnrolled: boolean };

export default function MfaVerification() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const initialMsg   = searchParams.get('message');

  const [qrCode, setQrCode]         = useState<string | null>(null);
  const [code, setCode]             = useState('');
  const [error, setError]           = useState<string | null>(initialMsg);
  const [isVerifying, setIsVerifying]     = useState(false);
  const [recoverMsg, setRecoverMsg]       = useState<string | null>(null);
  const [isRecovering, setIsRecovering]   = useState(false);

  // Enroll on mount
  useEffect(() => {
    (async () => {
      try {
        const res: EnrollResponse = await enrollMFA();
        if ('totp' in res) setQrCode(res.totp.qr_code);
        else setError('Already enrolled; please enter your existing code.');
      } catch {
        setError('Failed to initialize MFA; please refresh.');
      }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6 || isVerifying) return;
    setError(null);
    setIsVerifying(true);
    try {
      const result = await verifyMFA({ verifyCode: code });
      if (result.success) {
        router.push(searchParams.get('callbackUrl') || '/protected');
      } else {
        setError(result.error || 'Invalid code.');
        setCode('');
      }
    } catch {
      setError('Verification failed.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRecover = async () => {
    setError(null);
    setRecoverMsg(null);
    setIsRecovering(true);
    try {
      const res = await fetch('/api/mfa/recover', {
        method:      'POST',
        credentials: 'include',    // ← ensures sb-access-token is sent
      });
      const body = (await res.json()) as { sent: boolean; error?: string };
      if (body.sent) {
        setRecoverMsg('Recovery email sent—check your inbox.');
      } else {
        setError(body.error || 'Could not send recovery email.');
      }
    } catch (err) {
      console.error('MFA Recovery Error:', err);
      setError('Unexpected error sending recovery email.');
    } finally {
      setIsRecovering(false);
    }
  };

  // Show skeleton until we have a QR code (or an error)
  if (qrCode === null && error === null) {
    return <p>Loading MFA setup…</p>;
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4 text-center">Two-Factor Authentication</h2>

      {error && <div className="mb-4 p-2 bg-red-100 text-red-800 rounded">{error}</div>}
      {recoverMsg && <div className="mb-4 p-2 bg-green-100 text-green-800 rounded">{recoverMsg}</div>}

      {qrCode && (
        <div className="mb-4 text-center">
          <img src={qrCode} alt="MFA QR Code" className="mx-auto" />
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          placeholder="123456"
          className="w-full p-2 border rounded text-center text-xl tracking-widest"
        />
        <button
          type="submit"
          disabled={isVerifying || code.length !== 6}
          className="w-full py-2 bg-black text-white rounded disabled:opacity-50"
        >
          {isVerifying ? 'Verifying…' : 'Verify Code'}
        </button>
      </form>

      <div className="flex items-center my-4">
        <hr className="flex-1" />
        <span className="px-2 text-gray-400">Or</span>
        <hr className="flex-1" />
      </div>

      <button
        onClick={handleRecover}
        disabled={isRecovering}
        className="w-full py-2 border rounded disabled:opacity-50"
      >
        {isRecovering ? 'Sending recovery email…' : 'Lost your device? Recover via email'}
      </button>
    </div>
  );
}
