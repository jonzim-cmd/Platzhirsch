import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { checkPolicy, currentActor } from '@/server/policies/policy'
import { importStudents, type ImportRow } from '@/server/services/importStudents'

export async function POST(req: Request) {
  try {
    const actor = currentActor()
    if (!checkPolicy(actor, 'create', 'student')) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    const body = await req.json()
    const rows = (body?.rows ?? []) as ImportRow[]
    const result = await importStudents(rows)
    revalidatePath('/students')
    revalidatePath('/classes')
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'unknown error' }, { status: 500 })
  }
}
