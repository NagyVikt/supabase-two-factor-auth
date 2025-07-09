import { prisma } from './prisma'

export async function getUserById(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('User not found')
  return user
}

export async function saveSecret(userId: string, base32Secret: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { mfaSecret: base32Secret },
  })
}

export async function enableMfa(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { mfaEnabled: true, recoveryToken: null, recoveryExpires: null },
  })
}

export async function setRecoveryToken(userId: string, token: string, expiresAt: Date) {
  return prisma.user.update({
    where: { id: userId },
    data: { recoveryToken: token, recoveryExpires: expiresAt },
  })
}

export async function clearMfa(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { mfaEnabled: false, mfaSecret: null },
  })
}
