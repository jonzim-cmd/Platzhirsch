import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/server/db/client'
import { checkPolicy, currentActor } from '@/server/policies/policy'

// Publish/unpublish the lead (default) plan to all profiles assigned to the class.
// POST { planId: string, action?: 'share' | 'unshare' }
export async function POST(req: NextRequest) {
  const actor = currentActor()
  if (!checkPolicy(actor, 'update', 'plan')) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const body = await req.json().catch(() => null as any)
  const planId = (body?.planId as string) || ''
  const action = ((body?.action as string) || 'share').toLowerCase()
  if (!planId) return NextResponse.json({ error: 'missing planId' }, { status: 400 })

  const source = await prisma.seatingPlan.findUnique({ where: { id: planId }, include: { elements: true, class: true } })
  if (!source) return NextResponse.json({ error: 'plan not found' }, { status: 404 })
  if (source.title !== null) return NextResponse.json({ error: 'only default (lead) plan can be shared' }, { status: 400 })

  const cls = await prisma.class.findUnique({ where: { id: source.classId } })
  if (!cls) return NextResponse.json({ error: 'class not found' }, { status: 404 })
  if (cls.leadProfileId !== source.ownerProfileId) return NextResponse.json({ error: 'only class lead can share their default plan' }, { status: 403 })

  const links = await prisma.profileClass.findMany({ where: { classId: source.classId } })
  const targetProfileIds = links.map(l => l.profileId).filter(pid => pid !== source.ownerProfileId)

  if (action === 'unshare') {
    // Remove previously shared copies identified by sourcePlanId
    const sharedPlans = await prisma.seatingPlan.findMany({ where: { classId: source.classId, roomId: source.roomId, sourcePlanId: source.id } })
    const ids = sharedPlans.map(p => p.id)
    if (ids.length > 0) {
      await prisma.$transaction([
        prisma.seatingElement.deleteMany({ where: { seatingPlanId: { in: ids } } }),
        prisma.seatingPlan.deleteMany({ where: { id: { in: ids } } }),
      ])
    }
    return NextResponse.json({ ok: true, unpublished: ids.length })
  }

  let created = 0, updated = 0
  for (const pid of targetProfileIds) {
    // Upsert a named plan that tracks the source by sourcePlanId
    let target = await prisma.seatingPlan.findFirst({ where: { ownerProfileId: pid, classId: source.classId, roomId: source.roomId, sourcePlanId: source.id } })
    if (!target) {
      target = await prisma.seatingPlan.create({ data: { ownerProfileId: pid, classId: source.classId, roomId: source.roomId, title: `Klassenleitung ${source.class.name}`, sourcePlanId: source.id } })
      created++
    } else {
      updated++
    }
    await prisma.$transaction([
      prisma.seatingElement.deleteMany({ where: { seatingPlanId: target.id } }),
      prisma.seatingElement.createMany({
        data: (source.elements.map((e) => ({
          seatingPlanId: target.id,
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
  }

  return NextResponse.json({ ok: true, created, updated, targets: targetProfileIds.length })
}

// GET ?planId= — returns share status for a lead (default) plan
export async function GET(req: NextRequest) {
  const actor = currentActor()
  if (!checkPolicy(actor, 'read', 'plan')) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const planId = searchParams.get('planId') || ''
  if (!planId) return NextResponse.json({ error: 'missing planId' }, { status: 400 })

  const plan = await prisma.seatingPlan.findUnique({ where: { id: planId }, include: { class: true } })
  if (!plan) return NextResponse.json({ error: 'plan not found' }, { status: 404 })
  if (plan.title !== null) return NextResponse.json({ error: 'not a default (lead) plan' }, { status: 400 })

  const links = await prisma.profileClass.findMany({ where: { classId: plan.classId } })
  const targets = links.map(l => l.profileId).filter(pid => pid !== plan.ownerProfileId)
  const sharedCount = await prisma.seatingPlan.count({ where: { classId: plan.classId, roomId: plan.roomId, sourcePlanId: plan.id } })
  const shared = sharedCount > 0
  return NextResponse.json({ shared, sharedCount, targets: targets.length })
}
