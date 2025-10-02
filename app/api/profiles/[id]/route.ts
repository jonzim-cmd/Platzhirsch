import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/server/db/client'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id
  const body = await req.json().catch(() => null as any)
  const name = (body?.name as string | undefined)?.trim()
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 })
  const p = await prisma.profile.update({ where: { id }, data: { name: name ?? undefined } })
  return NextResponse.json(p)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 })
  // Delete dependent data in a transaction
  await prisma.$transaction(async (tx) => {
    await tx.class.updateMany({ where: { leadProfileId: id }, data: { leadProfileId: null } })
    await tx.profileClass.deleteMany({ where: { profileId: id } })
    const plans = await tx.seatingPlan.findMany({ where: { ownerProfileId: id }, select: { id: true } })
    const planIds = plans.map(p => p.id)
    if (planIds.length) {
      await tx.seatingElement.deleteMany({ where: { seatingPlanId: { in: planIds } } })
      await tx.seatingPlan.deleteMany({ where: { id: { in: planIds } } })
    }
    await tx.profile.delete({ where: { id } })
  })
  return NextResponse.json({ ok: true })
}
