import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/server/db/client'
import { noteDbFailure, shouldShortCircuit } from '@/server/db/health'

// POST { classId, leadProfileId | null }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null as any)
  const classId = body?.classId as string
  const leadProfileId = (body?.leadProfileId as string | null) ?? null
  if (!classId) return NextResponse.json({ error: 'missing classId' }, { status: 400 })
  if (shouldShortCircuit()) return NextResponse.json({ error: 'database unavailable' }, { status: 503 })
  try {
    await prisma.class.update({ where: { id: classId }, data: { leadProfileId } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    noteDbFailure()
    return NextResponse.json({ error: 'update failed' }, { status: 503 })
  }
}
