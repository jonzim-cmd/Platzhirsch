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

