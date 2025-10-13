import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/server/db/client'
import { checkPolicy, currentActor } from '@/server/policies/policy'

// Returns distinct rooms for a given (ownerProfileId, classId) context
export async function GET(req: NextRequest) {
  const actor = currentActor()
  if (!checkPolicy(actor, 'read', 'plan')) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const ownerProfileId = searchParams.get('ownerProfileId') || ''
  const classId = searchParams.get('classId') || ''
  if (!ownerProfileId || !classId) {
    return NextResponse.json({ error: 'missing params' }, { status: 400 })
  }
  // Fetch distinct roomIds for plans owned by the profile for the class
  const plans = await prisma.seatingPlan.findMany({
    where: { ownerProfileId, classId },
    select: { room: { select: { id: true, name: true } } },
    distinct: ['roomId'],
    orderBy: { updatedAt: 'desc' },
  })
  const rooms = plans.map(p => p.room)
  return NextResponse.json({ rooms })
}

