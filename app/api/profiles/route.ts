import { NextResponse } from 'next/server'
import { prisma } from '@/server/db/client'
import { noteDbFailure, shouldShortCircuit } from '@/server/db/health'

export async function GET() {
  if (shouldShortCircuit()) return NextResponse.json([])
  try {
    const profiles = await prisma.profile.findMany({ orderBy: { name: 'asc' } })
    return NextResponse.json(profiles)
  } catch (e) {
    noteDbFailure()
    return NextResponse.json([])
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null as any)
  const name = (body?.name as string)?.trim()
  if (!name) return NextResponse.json({ error: 'invalid name' }, { status: 400 })
  try {
    const p = await prisma.profile.create({ data: { name } })
    return NextResponse.json(p)
  } catch (e) {
    noteDbFailure()
    return NextResponse.json({ error: 'database unavailable' }, { status: 503 })
  }
}
