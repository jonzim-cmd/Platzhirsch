import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/server/db/client'
import { noteDbFailure, shouldShortCircuit } from '@/server/db/health'

// GET /api/profile-classes?profileId=...
export async function GET(req: NextRequest) {
  try {
    if (shouldShortCircuit()) return NextResponse.json([], { status: 200 })
    const { searchParams } = new URL(req.url)
    const profileId = searchParams.get('profileId') || ''
    if (!profileId) return NextResponse.json({ error: 'missing profileId' }, { status: 400 })

    const [classes, assigned] = await Promise.all([
      prisma.class.findMany({ orderBy: { name: 'asc' }, include: { leadProfile: true } }),
      prisma.profileClass.findMany({ where: { profileId } }),
    ])
    const assignedSet = new Set(assigned.map(a => a.classId))
    const data = classes.map(c => ({
      id: c.id,
      name: c.name,
      assigned: assignedSet.has(c.id),
      leadProfileId: c.leadProfileId,
    }))
    return NextResponse.json(data)
  } catch (e: any) {
    noteDbFailure()
    return NextResponse.json([], { status: 200 })
  }
}

// POST { profileId, classId, assigned }
export async function POST(req: NextRequest) {
  try {
    if (shouldShortCircuit()) return NextResponse.json({ error: 'database unavailable' }, { status: 503 })
    const body = await req.json().catch(() => null as any)
    const profileId = body?.profileId as string
    const classId = body?.classId as string
    const assigned = !!body?.assigned
    if (!profileId || !classId) return NextResponse.json({ error: 'invalid body' }, { status: 400 })

    if (assigned) {
      await prisma.profileClass.upsert({ where: { profileId_classId: { profileId, classId } }, create: { profileId, classId }, update: {} })
    } else {
      await prisma.profileClass.deleteMany({ where: { profileId, classId } })
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    noteDbFailure()
    return NextResponse.json({ error: e?.message ?? 'internal error' }, { status: 503 })
  }
}
