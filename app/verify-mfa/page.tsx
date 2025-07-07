'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { enrollMFA } from '@/lib/actions/mfa/enrollMfa'
import { verifyMFA } from '@/lib/actions/mfa/verifyMfa'
import { recoverMFA } from '@/lib/actions/mfa/recoverMfa'

type EnrollResponse =
  | { totp: { qr_code: string } }
  | { alreadyEnrolled: boolean }

export default function MfaVerification() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialMessage = searchParams.get('message') ?? null

  const [qrCode, setQrCode] = useState<string | null>(null)
  const [isAlreadyEnrolled, setIsAlreadyEnrolled] = useState(false)
  const [error, setError] = useState<string | null>(initialMessage)
  const [code, setCode] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [isEnrolling, setIsEnrolling] = useState(true)
  const [recoverMsg, setRecoverMsg] = useState<string | null>(null)
  const [isRecovering, setIsRecovering] = useState(false)

  // Enroll on mount
  useEffect(() => {
    ;(async () => {
      setIsEnrolling(true)
      try {
        const res: EnrollResponse = await enrollMFA()
        if ('totp' in res) {
          setQrCode(res.totp.qr_code)
        } else {
          setIsAlreadyEnrolled(true)
        }
      } catch {
        setError('Failed to enroll for MFA setup.')
      } finally {
        setIsEnrolling(false)
      }
    })()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsVerifying(true)

    try {
      const result = await verifyMFA({ verifyCode: code })
      if (result.success) {
        router.push('/protected')
      } else {
        setError(result.error ?? 'Invalid code')
      }
    } catch {
      setError('Verification failed. Try again.')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleRecover = async () => {
    setRecoverMsg(null)
    setIsRecovering(true)
    try {
      const result = await recoverMFA()
      if (result.sent) {
        setRecoverMsg('Recovery email sent – check your inbox.')
      } else {
        setRecoverMsg(result.error ?? 'Unable to send recovery email.')
      }
    } catch {
      setRecoverMsg('Unable to send recovery email.')
    } finally {
      setIsRecovering(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-xl bg-white border border-black rounded-lg shadow p-6 flex flex-col md:flex-row gap-6">
        {/* QR Code / Skeleton (hidden if already enrolled) */}
        {!isAlreadyEnrolled && (
          <div className="flex-1 flex items-center justify-center">
            {isEnrolling ? (
              <div className="w-40 h-40 bg-gray-200 animate-pulse rounded-lg" />
            ) : qrCode ? (
              <div className="p-4 bg-white border border-black rounded-lg">
                <img src={qrCode} alt="MFA QR Code" className="w-40 h-40" />
                <p className="mt-2 text-xs text-black text-center">
                  Scan with your Authenticator app
                </p>
              </div>
            ) : (
              <p className="text-black">Unable to load QR code.</p>
            )}
          </div>
        )}

        {/* Verification & Recovery Form */}
        <div className="flex-1 flex flex-col">
          <h2 className="text-2xl font-bold text-black mb-4 text-center md:text-left">
            Enter Your Code
          </h2>

          {error && (
            <div className="mb-4 px-3 py-2 bg-red-50 border border-red-500 text-red-700 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 mb-4">
            <div>
              <label
                htmlFor="verifyCode"
                className="block text-sm font-medium text-black mb-1"
              >
                6-digit code
              </label>
              <input
                id="verifyCode"
                name="verifyCode"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                className="w-full px-4 py-2 border border-black rounded text-black placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>
            <button
              type="submit"
              disabled={isVerifying}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-black text-white font-medium rounded hover:bg-white hover:text-black hover:border hover:border-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isVerifying && (
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8z"
                  />
                </svg>
              )}
              Verify
            </button>
          </form>

          <button
            onClick={handleRecover}
            disabled={isRecovering}
            className="w-full px-4 py-2 border border-black rounded text-black hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRecovering ? 'Sending recovery email…' : 'Lost your code? Recover via email'}
          </button>
          {recoverMsg && (
            <p className="mt-3 text-sm text-gray-700">{recoverMsg}</p>
          )}
        </div>
      </div>
    </div>
  )
}
