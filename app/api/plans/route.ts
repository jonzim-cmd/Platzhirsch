import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/server/db/client'
import { checkPolicy, currentActor } from '@/server/policies/policy'

// List plans for a specific (ownerProfileId, classId, roomId) context
export async function GET(req: NextRequest) {
  const actor = currentActor()
  if (!checkPolicy(actor, 'read', 'plan')) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const ownerProfileId = searchParams.get('ownerProfileId') || ''
  const classId = searchParams.get('classId') || ''
  const roomId = searchParams.get('roomId') || ''
  const all = searchParams.get('all') === '1'
  if (all) {
    if (!ownerProfileId) return NextResponse.json({ error: 'missing ownerProfileId' }, { status: 400 })
    const items = await prisma.seatingPlan.findMany({
      where: { ownerProfileId, title: { not: null } },
      orderBy: [{ updatedAt: 'desc' }],
      select: { id: true, title: true, updatedAt: true, class: { select: { id: true, name: true } }, room: { select: { id: true, name: true } } },
    })
    const plans = items.map((p) => ({ ...p, isDefault: false }))
    return NextResponse.json({ plans })
  } else {
    if (!ownerProfileId || !classId || !roomId) {
      return NextResponse.json({ error: 'missing params' }, { status: 400 })
    }
    const items = await prisma.seatingPlan.findMany({
      where: { ownerProfileId, classId, roomId },
      // Default (title null) first, then others by updatedAt desc
      orderBy: [{ title: 'asc' }, { updatedAt: 'desc' }],
      select: { id: true, title: true, updatedAt: true },
    })
    const plans = items.map((p) => ({ ...p, isDefault: p.title === null }))
    return NextResponse.json({ plans })
  }
}

// Create a new non-default plan, optionally cloning from a source plan
export async function POST(req: NextRequest) {
  const actor = currentActor()
  if (!checkPolicy(actor, 'create', 'plan')) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const body = await req.json().catch(() => null as any)
  const ownerProfileId = body?.ownerProfileId as string
  const classId = body?.classId as string
  const roomId = body?.roomId as string
  const name = String(body?.name || '').trim()
  const sourcePlanId = body?.sourcePlanId as string | undefined
  if (!ownerProfileId || !classId || !roomId || !name) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const created = await prisma.seatingPlan.create({
    data: { ownerProfileId, classId, roomId, title: name, sourcePlanId: sourcePlanId || null },
  })

  if (sourcePlanId) {
    const source = await prisma.seatingPlan.findUnique({ where: { id: sourcePlanId }, include: { elements: true } })
    if (source) {
      await prisma.seatingElement.createMany({
        data: (source.elements.map((e) => ({
          seatingPlanId: created.id,
          type: e.type,
          refId: e.refId,
          x: e.x,
          y: e.y,
          w: e.w,
          h: e.h,
          rotation: e.rotation,
          z: e.z,
          groupId: e.groupId,
          meta: (e.meta as any) ?? undefined,
        })) as any[]),
      })
    }
  }

  const full = await prisma.seatingPlan.findUnique({ where: { id: created.id }, include: { elements: true } })
  return NextResponse.json({ ok: true, plan: full })
}
