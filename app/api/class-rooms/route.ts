import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/server/db/client'
import { checkPolicy, currentActor } from '@/server/policies/policy'

// List mapped rooms for (ownerProfileId, classId).
// If no mapping exists yet, seed from existing plans once to avoid data loss.
export async function GET(req: NextRequest) {
  const actor = currentActor()
  if (!checkPolicy(actor, 'read', 'plan')) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const ownerProfileId = searchParams.get('ownerProfileId') || ''
  const classId = searchParams.get('classId') || ''
  if (!ownerProfileId || !classId) {
    return NextResponse.json({ error: 'missing params' }, { status: 400 })
  }
  // Try mapping first
  const mapped = await prisma.profileClassRoom.findMany({
    where: { profileId: ownerProfileId, classId },
    include: { room: { select: { id: true, name: true } } },
  })
  if (mapped.length > 0) {
    const rooms = mapped.map(m => m.room)
    return NextResponse.json({ rooms })
  }
  // Seed from plans if mapping empty
  const plans = await prisma.seatingPlan.findMany({
    where: { ownerProfileId, classId },
    select: { roomId: true, room: { select: { id: true, name: true } } },
    distinct: ['roomId'],
  })
  if (plans.length > 0) {
    const data = plans.map(p => ({ profileId: ownerProfileId, classId, roomId: p.roomId }))
    await prisma.profileClassRoom.createMany({ data, skipDuplicates: true })
    const rooms = plans.map(p => p.room)
    return NextResponse.json({ rooms })
  }
  return NextResponse.json({ rooms: [] })
}

// Replace mapping set for (ownerProfileId, classId) with provided rooms.
export async function PUT(req: NextRequest) {
  const actor = currentActor()
  if (!checkPolicy(actor, 'update', 'plan')) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const body = await req.json().catch(() => null as any)
  const ownerProfileId = String(body?.ownerProfileId || '')
  const classId = String(body?.classId || '')
  const roomIdsInput: string[] = Array.isArray(body?.roomIds) ? body.roomIds.map((x: any) => String(x)) : []
  const roomNamesInput: string[] = Array.isArray(body?.roomNames) ? body.roomNames.map((x: any) => String(x)) : []
  if (!ownerProfileId || !classId) return NextResponse.json({ error: 'invalid body' }, { status: 400 })

  // Resolve rooms: prefer ids, else ensure by names (create if missing)
  const roomIds = new Set<string>(roomIdsInput.filter(Boolean))
  if (roomIds.size === 0 && roomNamesInput.length > 0) {
    // normalize names and ensure existence
    const norm = (s: string) => s.trim()
    const names = Array.from(new Set(roomNamesInput.map(norm).filter(Boolean)))
    for (const name of names) {
      const existing = await prisma.room.findFirst({ where: { name } })
      if (existing) { roomIds.add(existing.id); continue }
      const created = await prisma.room.create({ data: { name } })
      roomIds.add(created.id)
    }
  }

  // Fetch current mapping
  const current = await prisma.profileClassRoom.findMany({
    where: { profileId: ownerProfileId, classId },
    select: { roomId: true },
  })
  const currentIds = new Set(current.map(x => x.roomId))
  const desiredIds = Array.from(roomIds)
  const toAdd = desiredIds.filter(id => !currentIds.has(id))
  const toRemove = Array.from(currentIds).filter(id => !roomIds.has(id))

  if (toRemove.length > 0) {
    await prisma.profileClassRoom.deleteMany({ where: { profileId: ownerProfileId, classId, roomId: { in: toRemove } } })
  }
  if (toAdd.length > 0) {
    await prisma.profileClassRoom.createMany({ data: toAdd.map(id => ({ profileId: ownerProfileId, classId, roomId: id })), skipDuplicates: true })
  }

  const rooms = await prisma.profileClassRoom.findMany({ where: { profileId: ownerProfileId, classId }, include: { room: { select: { id: true, name: true } } } })
  return NextResponse.json({ ok: true, rooms: rooms.map(r => r.room) })
}
