import speakeasy from 'speakeasy'
import { getUserById, enableMfa } from '@/lib/mfaStorePrisma'

export async function verifyMFA({
  userId,
  verifyCode,
}: {
  userId: string
  verifyCode: string
}): Promise<{ success: true } | { success: false; error: string }> {
  const user = await getUserById(userId)
  if (!user.mfaSecret) {
    return { success: false, error: 'MFA not initialized.' }
  }

  const valid = speakeasy.totp.verify({
    secret: user.mfaSecret,
    encoding: 'base32',
    token: verifyCode,
    window: 1,
  })

  if (!valid) {
    return { success: false, error: 'Invalid TOTP code.' }
  }

  await enableMfa(userId)
  return { success: true }
}
