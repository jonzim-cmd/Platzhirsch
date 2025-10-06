import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/server/db/client'
import { checkPolicy, currentActor } from '@/server/policies/policy'

export async function GET(req: NextRequest) {
  const actor = currentActor()
  if (!checkPolicy(actor, 'read', 'student')) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const classId = searchParams.get('classId') || ''
  if (!classId) return NextResponse.json({ error: 'missing classId' }, { status: 400 })
  const students = await prisma.student.findMany({ where: { classId, active: true }, orderBy: { foreName: 'asc' } })
  return NextResponse.json(students)
}

export async function POST(req: NextRequest) {
  const actor = currentActor()
  if (!checkPolicy(actor, 'create', 'student')) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const body = await req.json().catch(() => null as any)
  const classId = (body?.classId as string) || ''
  const foreName = ((body?.foreName as string) || '').trim()
  if (!classId || !foreName) return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  const externalKey = `${classId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  try {
    const s = await prisma.student.create({ data: { classId, foreName, externalKey } })
    return NextResponse.json(s)
  } catch (e) {
    return NextResponse.json({ error: 'create failed' }, { status: 500 })
  }
}
