import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/server/db/client'
import { noteDbFailure, shouldShortCircuit } from '@/server/db/health'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const classId = searchParams.get('classId') || ''
  if (!classId) return NextResponse.json({ error: 'missing classId' }, { status: 400 })
  if (shouldShortCircuit()) return NextResponse.json([])
  try {
    const students = await prisma.student.findMany({ where: { classId, active: true }, orderBy: { foreName: 'asc' } })
    return NextResponse.json(students)
  } catch (e) {
    noteDbFailure()
    return NextResponse.json([])
  }
}
