// app/verify-mfa/page.tsx
'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { verifyMFA } from '@/lib/actions/mfa/verifyMfa';
import { recoverMFA } from '@/lib/actions/mfa/recoverMfa';

export default function MfaVerification() {
  const searchParams = useSearchParams();
  const message = searchParams.get('message') || undefined;
  const [showMessage, setShowMessage] = useState(true);
  const [recoveryMsg, setRecoveryMsg] = useState<string | null>(null);

  const handleRecovery = async () => {
    try {
      await recoverMFA();
      setRecoveryMsg('Recovery email sent. Check your inbox.');
    } catch (err) {
      setRecoveryMsg('Unable to send recovery email');
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full sm:max-w-md">
        {/* Error alert positioned above title */}
        {message && showMessage && (
          <div className="relative mb-6 border border-red-400 bg-red-50 text-red-700 px-4 py-3 rounded-md">
            <span className="block text-sm">{message}</span>
            <button
              type="button"
              onClick={() => setShowMessage(false)}
              className="absolute top-1 right-2 text-red-700 hover:text-red-900 text-lg leading-none"
              aria-label="Close"
            >
              &times;
            </button>
          </div>
        )}

        <h2 className="mt-0 text-center text-3xl font-bold text-black">
          2FA Verification
        </h2>

        <form
          action={verifyMFA}
          className="mt-8 space-y-6 flex flex-col w-full"
        >
          <div>
            <label
              htmlFor="verifyCode"
              className="block text-sm font-medium text-black"
            >
              Enter your 6-digit verification code
            </label>
            <input
              id="verifyCode"
              name="verifyCode"
              type="text"
              maxLength={6}
              required
              placeholder="••••••"
              className="mt-1 block w-full px-3 py-2 bg-white border border-black rounded-md text-black placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-offset-0 focus:ring-black focus:border-black"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2 px-4 border border-black rounded-md text-sm font-medium text-white bg-black hover:bg-white hover:text-black focus:outline-none focus:ring-1 focus:ring-offset-0 focus:ring-black"
          >
            Verify
          </button>
          <button
            type="button"
            onClick={handleRecovery}
            className="w-full py-2 px-4 border border-gray-300 rounded-md text-sm mt-4"
          >
            Send recovery email
          </button>
          {recoveryMsg && (
            <p className="text-center text-sm text-gray-700 mt-2">{recoveryMsg}</p>
          )}
        </form>
      </div>
    </div>
  );
}
