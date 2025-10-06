import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/server/db/client'
import { checkPolicy, currentActor } from '@/server/policies/policy'

// Danger: deletes ALL data in the database for this app
export async function POST(_req: NextRequest) {
  const actor = currentActor()
  // With no auth, allow for MVP; extend policy here if needed
  if (!checkPolicy(actor, 'delete', 'admin:reset')) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  try {
    await prisma.$transaction([
      // Delete child tables first
      prisma.seatingElement.deleteMany({}),
      prisma.seatingPlan.deleteMany({}),
      prisma.profileClass.deleteMany({}),
      prisma.student.deleteMany({}),
      // Classes before profiles (leadProfileId FK)
      prisma.class.deleteMany({}),
      prisma.room.deleteMany({}),
      prisma.profile.deleteMany({}),
    ])
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'reset failed' }, { status: 500 })
  }
}

