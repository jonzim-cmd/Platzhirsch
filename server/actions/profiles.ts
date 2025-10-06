"use server"
import { prisma } from '@/server/db/client'
import { checkPolicy, currentActor } from '@/server/policies/policy'
import { revalidatePath } from 'next/cache'

export async function listProfiles() {
  const actor = currentActor()
  if (!checkPolicy(actor, 'read', 'profile')) throw new Error('forbidden')
  return prisma.profile.findMany({ orderBy: { name: 'asc' } })
}

export async function createProfile(name: string) {
  const actor = currentActor()
  if (!checkPolicy(actor, 'create', 'profile')) throw new Error('forbidden')
  const p = await prisma.profile.create({ data: { name } })
  revalidatePath('/profiles')
  return p
}

export async function deleteProfile(id: string) {
  const actor = currentActor()
  if (!checkPolicy(actor, 'delete', 'profile')) throw new Error('forbidden')
  await prisma.$transaction(async (tx) => {
    await tx.class.updateMany({ where: { leadProfileId: id }, data: { leadProfileId: null } })
    await tx.profileClass.deleteMany({ where: { profileId: id } })
    const plans = await tx.seatingPlan.findMany({ where: { ownerProfileId: id }, select: { id: true } })
    const planIds = plans.map(p => p.id)
    if (planIds.length) {
      await tx.seatingElement.deleteMany({ where: { seatingPlanId: { in: planIds } } })
      await tx.seatingPlan.deleteMany({ where: { id: { in: planIds } } })
    }
    await tx.profile.delete({ where: { id } })
  })
  revalidatePath('/profiles')
}
