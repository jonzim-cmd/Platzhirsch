import { NextResponse } from 'next/server'
import { prisma } from '@/server/db/client'

export async function GET() {
  const profiles = await prisma.profile.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json(profiles)
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null as any)
  const name = (body?.name as string)?.trim()
  if (!name) return NextResponse.json({ error: 'invalid name' }, { status: 400 })
  const p = await prisma.profile.create({ data: { name } })
  return NextResponse.json(p)
}

