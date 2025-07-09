import speakeasy from 'speakeasy'
import QRCode from 'qrcode'
import { getUserById, saveSecret } from '@/lib/mfaStorePrisma'

export async function enrollMFA(userId: string) {
  const user = await getUserById(userId)
  if (user.mfaEnabled && user.mfaSecret) {
    return { alreadyEnrolled: true as const }
  }

  const secret = speakeasy.generateSecret({
    name: `MyApp (${user.email})`,
    length: 20,
  })

  await saveSecret(userId, secret.base32)
  const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url!)

  return { totp: { qr_code: qrCodeDataUrl } }
}
