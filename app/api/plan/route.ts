import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/server/db/client'
import { ElementType } from '@prisma/client'
import { checkPolicy, currentActor } from '@/server/policies/policy'

export async function GET(req: NextRequest) {
  const actor = currentActor()
  if (!checkPolicy(actor, 'read', 'plan')) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const planId = searchParams.get('planId')
  const ownerProfileId = searchParams.get('ownerProfileId') || ''
  const classId = searchParams.get('classId') || ''
  const roomId = searchParams.get('roomId') || ''
  const includeLead = searchParams.get('includeLead') === '1'
  const create = searchParams.get('create') === '1'

  let plan = null as any
  if (planId) {
    plan = await prisma.seatingPlan.findUnique({ where: { id: planId }, include: { elements: true } })
  } else {
    if (!ownerProfileId || !classId || !roomId) {
      return NextResponse.json({ error: 'missing params' }, { status: 400 })
    }
    // Try default plan for this context
    plan = await prisma.seatingPlan.findFirst({
      where: { ownerProfileId, classId, roomId, title: null },
      include: { elements: true },
    })
    if (!plan && create) {
      plan = await prisma.seatingPlan.create({
        data: {
          ownerProfileId,
          classId,
          roomId,
          title: null,
        },
        include: { elements: true },
      })
    }
  }

  if (!plan) return NextResponse.json({ error: 'not found' }, { status: 404 })

  if (!includeLead) return NextResponse.json({ plan })

  // Only include the default plan for the lead profile for the same room
  let leadPlan = null as any
  if (classId) {
    const cls = await prisma.class.findUnique({ where: { id: classId } })
    if (cls?.leadProfileId) {
      leadPlan = await prisma.seatingPlan.findFirst({
        where: { ownerProfileId: cls.leadProfileId, classId, roomId, title: null },
        include: { elements: true },
      })
      // Only expose lead plan to others if it has been shared (i.e., copies exist)
      if (leadPlan && ownerProfileId && ownerProfileId !== cls.leadProfileId) {
        const sharedCount = await prisma.seatingPlan.count({ where: { classId, roomId, sourcePlanId: leadPlan.id } })
        if (sharedCount === 0) leadPlan = null
      }
    }
  }
  return NextResponse.json({ plan, leadPlan })
}

export async function POST(req: NextRequest) {
  const actor = currentActor()
  if (!checkPolicy(actor, 'update', 'plan')) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
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

  // If this is a shared Klassenleitungs-Standardplan, propagate changes to all shared copies
  try {
    if (plan.title === null) {
      const copies = await prisma.seatingPlan.findMany({ where: { sourcePlanId: plan.id } })
      if (copies.length > 0) {
        const copyOps: any[] = []
        for (const c of copies) {
          copyOps.push(prisma.seatingElement.deleteMany({ where: { seatingPlanId: c.id } }))
          if (Array.isArray(body.elements) && body.elements.length > 0) {
            copyOps.push(
              prisma.seatingElement.createMany({
                data: body.elements.map((e: any) => ({
                  seatingPlanId: c.id,
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
          // bump updatedAt on copy plan
          copyOps.push(prisma.seatingPlan.update({ where: { id: c.id }, data: { title: c.title } }))
        }
        if (copyOps.length > 0) await prisma.$transaction(copyOps)
      }
    }
  } catch { /* ignore propagation errors to not block source save */ }

  return NextResponse.json({ ok: true })
}
