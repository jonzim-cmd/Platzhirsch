"use server"
import { prisma } from '@/server/db/client'
import { checkPolicy, currentActor } from '@/server/policies/policy'
import { revalidatePath } from 'next/cache'
import { RoomType } from '@prisma/client'

export async function listRooms() {
  const actor = currentActor()
  if (!checkPolicy(actor, 'read', 'room')) throw new Error('forbidden')
  try {
    return await prisma.room.findMany({ orderBy: { name: 'asc' } })
  } catch (err) {
    console.warn('listRooms fallback due to DB error:', err)
    return []
  }
}

export async function createRoom(name: string, type: 'normal' | 'adHoc' = 'normal') {
  const actor = currentActor()
  if (!checkPolicy(actor, 'create', 'room')) throw new Error('forbidden')
  const r = await prisma.room.create({ data: { name, type: type === 'adHoc' ? RoomType.ADHOC : RoomType.NORMAL } })
  revalidatePath('/rooms')
  return r
}

export async function deleteRoom(id: string) {
  const actor = currentActor()
  if (!checkPolicy(actor, 'delete', 'room')) throw new Error('forbidden')
  await prisma.room.delete({ where: { id } })
  revalidatePath('/rooms')
}
