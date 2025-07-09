import { randomUUID } from 'crypto'
import { setRecoveryToken, getUserById } from '@/lib/mfaStorePrisma'
import sendEmail from '../sendEmail'

export async function recoverMfa(userId: string): Promise<{ success: true } | { success: false; error: string }> {
  const token = randomUUID()
  const expires = new Date(Date.now() + 60 * 60 * 1000)

  await setRecoveryToken(userId, token, expires)

  const link = `${process.env.APP_URL}/mfa/recover?token=${token}`
  await sendEmail({
    to: (await getUserById(userId)).email,
    subject: 'Recover your MFA',
    html: `<p>Click <a href="${link}">here</a> to reset your two-factor authentication. Expires in 1 hour.</p>`
  })

  return { success: true }
}
