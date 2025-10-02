import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/server/db/client'
import { ElementType } from '@prisma/client'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const ownerProfileId = searchParams.get('ownerProfileId') || ''
  const classId = searchParams.get('classId') || ''
  const roomId = searchParams.get('roomId') || ''
  const includeLead = searchParams.get('includeLead') === '1'
  const create = searchParams.get('create') === '1'
  if (!ownerProfileId || !classId || !roomId) {
    return NextResponse.json({ error: 'missing params' }, { status: 400 })
  }

  let plan = await prisma.seatingPlan.findUnique({
    where: { ownerProfileId_classId_roomId: { ownerProfileId, classId, roomId } },
    include: { elements: true }
  })

  if (!plan && create) {
    plan = await prisma.seatingPlan.create({
      data: {
        ownerProfileId,
        classId,
        roomId,
        title: null,
        elements: {
          create: [
            {
              type: ElementType.TEACHER_DESK,
              x: 40,
              y: 40,
              w: 200,
              h: 60,
              rotation: 0,
              z: 0,
            },
          ],
        },
      },
      include: { elements: true },
    })
  }

  if (!plan) return NextResponse.json({ error: 'not found' }, { status: 404 })

  if (!includeLead) return NextResponse.json({ plan })

  const cls = await prisma.class.findUnique({ where: { id: classId } })
  let leadPlan = null as any
  if (cls?.leadProfileId) {
    leadPlan = await prisma.seatingPlan.findUnique({
      where: { ownerProfileId_classId_roomId: { ownerProfileId: cls.leadProfileId, classId, roomId } },
      include: { elements: true }
    })
  }
  return NextResponse.json({ plan, leadPlan })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null as any)
  if (!body?.planId || !Array.isArray(body?.elements)) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const plan = await prisma.seatingPlan.findUnique({ where: { id: body.planId } })
  if (!plan) return NextResponse.json({ error: 'plan not found' }, { status: 404 })

  // Replace all elements for simplicity and robustness
  const ops: any[] = [
    prisma.seatingElement.deleteMany({ where: { seatingPlanId: plan.id } }),
  ]
  if (body.elements.length > 0) {
    ops.push(
      prisma.seatingElement.createMany({
        data: body.elements.map((e: any) => ({
          seatingPlanId: plan.id,
          type: e.type,
          refId: e.refId ?? null,
          x: e.x ?? 0,
          y: e.y ?? 0,
          w: e.w ?? 80,
          h: e.h ?? 50,
          rotation: e.rotation ?? 0,
          z: e.z ?? 0,
          groupId: e.groupId ?? null,
          meta: e.meta ?? null,
        })),
      })
    )
  }
  await prisma.$transaction(ops)

  return NextResponse.json({ ok: true })
}
