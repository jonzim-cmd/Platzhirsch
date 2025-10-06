import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/server/db/client'
import { checkPolicy, currentActor } from '@/server/policies/policy'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const actor = currentActor()
  if (!checkPolicy(actor, 'delete', 'room')) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const id = params.id
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 })
  try {
    await prisma.room.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'delete failed' }, { status: 500 })
  }
}

