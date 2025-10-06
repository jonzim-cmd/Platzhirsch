import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/server/db/client'
import { checkPolicy, currentActor } from '@/server/policies/policy'

export async function POST(req: NextRequest) {
  const actor = currentActor()
  if (!checkPolicy(actor, 'update', 'plan')) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const body = await req.json().catch(() => null as any)
  const sourcePlanId = body?.sourcePlanId as string
  const targetPlanId = body?.targetPlanId as string | undefined
  const ownerProfileId = body?.ownerProfileId as string | undefined
  const classId = body?.classId as string | undefined
  const roomId = body?.roomId as string | undefined
  if (!sourcePlanId) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const source = await prisma.seatingPlan.findUnique({ where: { id: sourcePlanId }, include: { elements: true } })
  if (!source) return NextResponse.json({ error: 'source not found' }, { status: 404 })

  let targetId = targetPlanId || ''
  // Fallback for legacy clients: upsert default plan by (owner, class, room)
  if (!targetId) {
    if (!ownerProfileId || !classId || !roomId) {
      return NextResponse.json({ error: 'missing target identifiers' }, { status: 400 })
    }
    let target = await prisma.seatingPlan.findFirst({ where: { ownerProfileId, classId, roomId, title: null } })
    if (!target) {
      target = await prisma.seatingPlan.create({ data: { ownerProfileId, classId, roomId, sourcePlanId: source.id, title: null } })
    } else {
      await prisma.seatingPlan.update({ where: { id: target.id }, data: { sourcePlanId: source.id } })
    }
    targetId = target.id
  } else {
    await prisma.seatingPlan.update({ where: { id: targetId }, data: { sourcePlanId: source.id } })
  }

  // Replace elements with copies of source elements
  await prisma.$transaction([
    prisma.seatingElement.deleteMany({ where: { seatingPlanId: targetId } }),
    prisma.seatingElement.createMany({
      data: (source.elements.map((e) => ({
        seatingPlanId: targetId,
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
    }),
  ])

  const full = await prisma.seatingPlan.findUnique({ where: { id: targetId }, include: { elements: true } })
  return NextResponse.json({ ok: true, plan: full })
}
