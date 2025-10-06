import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/server/db/client'
import { checkPolicy, currentActor } from '@/server/policies/policy'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const profileId = searchParams.get('profileId')
  if (profileId) {
    const links = await prisma.profileClass.findMany({ where: { profileId } })
    const ids = links.map(l => l.classId)
    const classes = await prisma.class.findMany({ where: { id: { in: ids } }, orderBy: { name: 'asc' } })
    return NextResponse.json(classes)
  }
  const all = await prisma.class.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json(all)
}

export async function POST(req: NextRequest) {
  const actor = currentActor()
  if (!checkPolicy(actor, 'create', 'class')) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const body = await req.json().catch(() => null as any)
  const name = (body?.name as string | undefined)?.trim()
  const leadProfileId = (body?.leadProfileId as string | undefined) || undefined
  if (!name) return NextResponse.json({ error: 'invalid name' }, { status: 400 })
  try {
    const c = await prisma.class.create({ data: { name, leadProfileId: leadProfileId ?? null } })
    return NextResponse.json(c)
  } catch (e: any) {
    return NextResponse.json({ error: 'create failed' }, { status: 500 })
  }
}
