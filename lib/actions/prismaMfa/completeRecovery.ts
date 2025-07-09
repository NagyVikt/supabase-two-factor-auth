import { prisma } from '@/lib/prisma'
import { clearMfa } from '@/lib/mfaStorePrisma'

export async function completeRecovery(token: string): Promise<{ success: true } | { success: false; error: string }> {
  const user = await prisma.user.findFirst({
    where: { recoveryToken: token, recoveryExpires: { gt: new Date() } },
  })
  if (!user) return { success: false, error: 'Invalid or expired recovery link.' }

  await clearMfa(user.id)
  return { success: true }
}
