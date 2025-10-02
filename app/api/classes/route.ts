import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/server/db/client'
import { noteDbFailure, shouldShortCircuit } from '@/server/db/health'

export async function GET(req: NextRequest) {
  if (shouldShortCircuit()) return NextResponse.json([])
  try {
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
  } catch (e) {
    noteDbFailure()
    return NextResponse.json([])
  }
}
