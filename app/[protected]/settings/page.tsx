'use client'

import React, { useEffect, useState, FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/browser'

// ——— Typed ShadCN-style UI components ———
type DivProps = React.HTMLAttributes<HTMLDivElement>
type ButtonHTMLProps = React.ButtonHTMLAttributes<HTMLButtonElement>
type InputHTMLProps = React.InputHTMLAttributes<HTMLInputElement>
type LabelHTMLProps = React.LabelHTMLAttributes<HTMLLabelElement>

interface CardProps extends DivProps { className?: string }
const Card: React.FC<CardProps> = ({ className = '', ...props }) => (
  <div
    className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm ${className}`}
    {...props}
  />
)

interface CardHeaderProps extends DivProps { className?: string }
const CardHeader: React.FC<CardHeaderProps> = ({ className = '', ...props }) => (
  <div className={`p-6 ${className}`} {...props} />
)

interface CardTitleProps extends DivProps { className?: string }
const CardTitle: React.FC<CardTitleProps> = ({ className = '', children }) => (
  <h3 className={`text-lg font-semibold leading-none tracking-tight ${className}`}>
    {children}
  </h3>
)

interface CardDescriptionProps extends DivProps { className?: string }
const CardDescription: React.FC<CardDescriptionProps> = ({ className = '', children }) => (
  <p className={`text-sm text-gray-500 dark:text-gray-400 ${className}`}>
    {children}
  </p>
)

interface CardContentProps extends DivProps { className?: string }
const CardContent: React.FC<CardContentProps> = ({ className = '', ...props }) => (
  <div className={`p-6 pt-0 ${className}`} {...props} />
)

interface ButtonProps extends ButtonHTMLProps { className?: string; variant?: 'destructive'; size?: 'sm' }
const Button: React.FC<ButtonProps> = ({
  className = '',
  variant,
  size,
  children,
  ...props
}) => {
  let base =
    'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50'
  if (size === 'sm') base += ' px-2 py-1 text-xs'
  else base += ' px-4 py-2'
  const variantClasses =
    variant === 'destructive'
      ? 'bg-red-500 text-white hover:bg-red-600'
      : 'bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-50 dark:text-gray-900 dark:hover:bg-gray-200'

  return (
    <button className={`${base} ${variantClasses} ${className}`} {...props}>
      {children}
    </button>
  )
}

interface InputProps extends InputHTMLProps { className?: string }
const Input: React.FC<InputProps> = ({ className = '', ...props }) => (
  <input
    className={`flex h-10 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-gray-500 ${className}`}
    {...props}
  />
)

interface LabelProps extends LabelHTMLProps { className?: string }
const Label: React.FC<LabelProps> = ({ className = '', ...props }) => (
  <label className={`text-sm font-medium leading-none ${className}`} {...props} />
)

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> { className?: string }
const Badge: React.FC<BadgeProps> = ({ className = '', children, ...props }) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}
    {...props}
  >
    {children}
  </span>
)

// ——— Main Settings component ———
export default function Settings() {
  const supabase = createClient()
  const message = useSearchParams().get('message') ?? ''

  const [loading, setLoading] = useState(true)
  const [hasMfa, setHasMfa] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [code, setCode] = useState('')

  // Fetch MFA status on mount
  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/mfa/status')
        if (res.ok) {
          const json = await res.json()
          setHasMfa(json.hasMfa)
        }
      } catch {
        console.error('MFA status error')
      }
      setLoading(false)
    })()
  }, [])

  // Enroll TOTP
  const handleEnroll = async () => {
    setLoading(true)
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
    if (data && !error) {
      setQrCodeUrl(data.totp.qr_code)
    } else {
      console.error('MFA enroll error', error)
    }
    setLoading(false)
  }

  // Verify code
  const handleVerify = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { data: factorData, error: listError } = await supabase.auth.mfa.listFactors()
    if (listError || factorData.all.length === 0) {
      console.error('MFA list error', listError)
      setLoading(false)
      return
    }
    const factorId = factorData.all[0].id

    const { data: challengeData, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId })
    if (challengeError) {
      console.error('MFA challenge error', challengeError)
      setLoading(false)
      return
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code,
    })
    if (!verifyError) {
      setHasMfa(true)
      setQrCodeUrl(null)
    } else {
      console.error('MFA verify error', verifyError)
    }
    setLoading(false)
  }

  // Unenroll TOTP
  const handleUnenroll = async () => {
    setLoading(true)
    const { data, error: listError } = await supabase.auth.mfa.listFactors()
    if (listError || data.all.length === 0) {
      console.error('MFA list error', listError)
      setLoading(false)
      return
    }
    const factorId = data.all[0].id
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId })
    if (!unenrollError) {
      setHasMfa(false)
      setQrCodeUrl(null)
    } else {
      console.error('MFA unenroll error', unenrollError)
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Card className="w-full max-w-md animate-pulse">
          <CardHeader>
            <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
            <div className="h-4 w-full max-w-xs bg-gray-200 dark:bg-gray-700 rounded" />
          </CardHeader>
          <CardContent>
            <div className="h-10 w-28 bg-gray-200 dark:bg-gray-700 rounded-md" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex justify-center py-12">
      <Card className="w-full max-w-md relative">
        {hasMfa && !qrCodeUrl && (
          <div className="absolute top-4 left-6 flex items-center gap-2">
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              Enabled
            </Badge>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleUnenroll}
            >
              Disable 2FA
            </Button>
          </div>
        )}

        <CardHeader className={hasMfa && !qrCodeUrl ? 'pt-12' : ''}>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>
            Secure your account with an authenticator app.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-6">
          {!hasMfa && !qrCodeUrl && (
            <Button onClick={handleEnroll} className="self-start">
              Enable 2FA
            </Button>
          )}

          {qrCodeUrl && (
            <div className="relative h-44 w-44 self-center">
              <Image
                src={qrCodeUrl}
                alt="Scan this QR code"
                fill
                className="rounded-lg bg-white p-2"
                priority
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Scan with your authenticator app
              </p>
            </div>
          )}

          {qrCodeUrl && (
            <form onSubmit={handleVerify} className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label htmlFor="code">Verification code</Label>
                <Input
                  id="code"
                  name="code"
                  placeholder="Enter 6-digit code"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <Button type="submit" className="self-start">
                Verify
              </Button>
            </form>
          )}

          {message && (
            <p className="text-sm text-red-500 mt-4">
              {message}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
