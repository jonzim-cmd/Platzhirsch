import { NextResponse } from 'next/server'
import { prisma } from '@/server/db/client'

export async function GET() {
  const rooms = await prisma.room.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json(rooms)
}
