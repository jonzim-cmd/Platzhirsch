"use server"
import { prisma } from '@/server/db/client'
import { checkPolicy, currentActor } from '@/server/policies/policy'
import { revalidatePath } from 'next/cache'

export async function listStudents() {
  const actor = currentActor()
  if (!checkPolicy(actor, 'read', 'student')) throw new Error('forbidden')
  return prisma.student.findMany({ include: { class: true }, orderBy: [{ class: { name: 'asc' } }, { foreName: 'asc' }] })
}

export async function createStudent(data: { classId: string; foreName: string; externalKey: string }) {
  const actor = currentActor()
  if (!checkPolicy(actor, 'create', 'student')) throw new Error('forbidden')
  const s = await prisma.student.create({ data })
  revalidatePath('/students')
  return s
}

export async function deleteStudent(id: string) {
  const actor = currentActor()
  if (!checkPolicy(actor, 'delete', 'student')) throw new Error('forbidden')
  await prisma.student.delete({ where: { id } })
  revalidatePath('/students')
}

