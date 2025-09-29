import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/server/db/client'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null as any)
  const ownerProfileId = body?.ownerProfileId as string
  const classId = body?.classId as string
  const roomId = body?.roomId as string
  const sourcePlanId = body?.sourcePlanId as string
  if (!ownerProfileId || !classId || !roomId || !sourcePlanId) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const source = await prisma.seatingPlan.findUnique({ where: { id: sourcePlanId }, include: { elements: true } })
  if (!source) return NextResponse.json({ error: 'source not found' }, { status: 404 })

  // Upsert target plan
  let target = await prisma.seatingPlan.findUnique({ where: { ownerProfileId_classId_roomId: { ownerProfileId, classId, roomId } } })
  if (!target) {
    target = await prisma.seatingPlan.create({ data: { ownerProfileId, classId, roomId, sourcePlanId: source.id } })
  } else {
    await prisma.seatingPlan.update({ where: { id: target.id }, data: { sourcePlanId: source.id } })
  }

  // Replace elements with copies of source elements
  await prisma.$transaction([
    prisma.seatingElement.deleteMany({ where: { seatingPlanId: target.id } }),
    prisma.seatingElement.createMany({
      // meta must be InputJsonValue | undefined
      data: (source.elements.map((e) => ({
        seatingPlanId: target!.id,
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

  const full = await prisma.seatingPlan.findUnique({ where: { id: target.id }, include: { elements: true } })
  return NextResponse.json({ ok: true, plan: full })
}
