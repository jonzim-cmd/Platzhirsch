import { NextResponse } from 'next/server'
import { prisma } from '@/server/db/client'
import { noteDbFailure, shouldShortCircuit } from '@/server/db/health'

export async function GET() {
  if (shouldShortCircuit()) return NextResponse.json([])
  try {
    const rooms = await prisma.room.findMany({ orderBy: { name: 'asc' } })
    return NextResponse.json(rooms)
  } catch (e) {
    noteDbFailure()
    return NextResponse.json([])
  }
}
