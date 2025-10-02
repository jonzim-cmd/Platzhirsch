import { NextResponse } from 'next/server'
import { prisma } from '@/server/db/client'

export async function GET() {
  const start = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ ok: true, db: 'up', ms: Date.now() - start })
  } catch (e: any) {
    return NextResponse.json({ ok: false, db: 'down', ms: Date.now() - start, error: e?.message }, { status: 503 })
  }
}

