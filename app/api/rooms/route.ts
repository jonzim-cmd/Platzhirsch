import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/server/db/client'
import { checkPolicy, currentActor } from '@/server/policies/policy'

export async function GET() {
  const rooms = await prisma.room.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json(rooms)
}
export async function POST(req: NextRequest) {
  const actor = currentActor()
  if (!checkPolicy(actor, 'create', 'room')) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const body = await req.json().catch(() => null as any)
  const name = ((body?.name as string) || '').trim()
  if (!name) return NextResponse.json({ error: 'invalid name' }, { status: 400 })
  // Conflict-friendly: if room exists, return 409 + existing
  const existing = await prisma.room.findUnique({ where: { name } })
  if (existing) return NextResponse.json({ error: 'exists', room: existing }, { status: 409 })
  try {
    const r = await prisma.room.create({ data: { name } })
    return NextResponse.json(r)
  } catch (e) {
    return NextResponse.json({ error: 'create failed' }, { status: 500 })
  }
}
