import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/server/db/client'
import { checkPolicy, currentActor } from '@/server/policies/policy'

// Rename plan (title) or change flags in the future
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const actor = currentActor()
  if (!checkPolicy(actor, 'update', 'plan')) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const id = params.id
  const body = await req.json().catch(() => null as any)
  const title = (body?.title as string | undefined)?.trim()
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 })
  const p = await prisma.seatingPlan.update({ where: { id }, data: { title: title ?? undefined } })
  return NextResponse.json(p)
}

// Delete a non-default plan
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const actor = currentActor()
  if (!checkPolicy(actor, 'delete', 'plan')) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const id = params.id
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 })
  const plan = await prisma.seatingPlan.findUnique({ where: { id } })
  if (!plan) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (plan.title === null) return NextResponse.json({ error: 'cannot delete default plan' }, { status: 400 })
  await prisma.$transaction([
    prisma.seatingElement.deleteMany({ where: { seatingPlanId: id } }),
    prisma.seatingPlan.delete({ where: { id } }),
  ])
  return NextResponse.json({ ok: true })
}
