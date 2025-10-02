import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/server/db/client'

// GET /api/profile-classes?profileId=...
export async function GET(req: NextRequest) {
  try {
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
    return NextResponse.json({ error: e?.message ?? 'internal error' }, { status: 500 })
  }
}

// POST { profileId, classId, assigned }
export async function POST(req: NextRequest) {
  try {
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
    return NextResponse.json({ error: e?.message ?? 'internal error' }, { status: 500 })
  }
}
