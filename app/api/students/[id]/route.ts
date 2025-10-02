import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/server/db/client'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 })
  const body = await req.json().catch(() => null)
  if (!body || typeof body.foreName !== 'string' || !body.foreName.trim()) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  const foreName = body.foreName.trim()
  try {
    const s = await prisma.student.update({ where: { id }, data: { foreName } })
    return NextResponse.json(s)
  } catch (e) {
    return NextResponse.json({ error: 'update failed' }, { status: 500 })
  }
}
