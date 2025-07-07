'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { enrollMFA } from '@/lib/actions/mfa/enrollMfa'
import { verifyMFA } from '@/lib/actions/mfa/verifyMfa'

interface EnrollResponse {
  totp?: { qr_code: string }
  alreadyEnrolled?: boolean
  error?: string
}

export default function MfaRecoveryPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [qrCode, setQrCode] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const res: EnrollResponse = await enrollMFA()
        if (res.totp?.qr_code) {
          setQrCode(res.totp.qr_code)
        } else if (res.error) {
          setError(res.error)
        }
      } catch (err) {
        setError('Failed to start MFA recovery.')
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length !== 6 || isVerifying) return
    setIsVerifying(true)
    setError(null)
    try {
      const result = await verifyMFA({ verifyCode: code })
      if (result.success) {
        const redirect = searchParams.get('callbackUrl') || '/protected'
        router.push(redirect)
      } else {
        setError(result.error || 'Invalid code')
      }
    } catch (err) {
      setError('Verification failed')
    } finally {
      setIsVerifying(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">Loading...</div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg shadow-md p-6 space-y-6">
        <h2 className="text-center text-2xl font-bold">Recover Two-Factor Authentication</h2>
        {error && <p className="text-red-600 text-sm text-center">{error}</p>}
        {qrCode && (
          <div className="text-center">
            <p className="text-sm mb-2">Scan this QR code with your authenticator app</p>
            <img src={qrCode} alt="MFA QR" className="mx-auto rounded" />
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            pattern="\\d{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\\D/g, ''))}
            className="w-full border rounded p-2 text-center text-xl tracking-widest"
            placeholder="123456"
            required
          />
          <button
            type="submit"
            disabled={isVerifying || code.length !== 6}
            className="w-full py-2 px-4 bg-black text-white rounded disabled:opacity-50"
          >
            {isVerifying ? 'Verifying…' : 'Verify Code'}
          </button>
        </form>
      </div>
    </div>
  )
}
