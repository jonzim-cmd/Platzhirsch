"use server"
import { prisma } from '@/server/db/client'
import { checkPolicy, currentActor } from '@/server/policies/policy'
import { revalidatePath } from 'next/cache'

export async function listClasses() {
  const actor = currentActor()
  if (!checkPolicy(actor, 'read', 'class')) throw new Error('forbidden')
  try {
    return await prisma.class.findMany({ orderBy: { name: 'asc' }, include: { leadProfile: true } })
  } catch (err) {
    console.warn('listClasses fallback due to DB error:', err)
    return []
  }
}

export async function createClass(name: string, leadProfileId?: string) {
  const actor = currentActor()
  if (!checkPolicy(actor, 'create', 'class')) throw new Error('forbidden')
  const c = await prisma.class.create({ data: { name, leadProfileId: leadProfileId || null } })
  revalidatePath('/classes')
  return c
}

export async function setClassLead(classId: string, leadProfileId: string | null) {
  const actor = currentActor()
  if (!checkPolicy(actor, 'update', 'class')) throw new Error('forbidden')
  await prisma.class.update({ where: { id: classId }, data: { leadProfileId } })
  revalidatePath('/classes')
}

export async function deleteClass(id: string) {
  const actor = currentActor()
  if (!checkPolicy(actor, 'delete', 'class')) throw new Error('forbidden')
  await prisma.class.delete({ where: { id } })
  revalidatePath('/classes')
}
