"use server"
import { revalidatePath } from 'next/cache'
import { checkPolicy, currentActor } from '@/server/policies/policy'
import { importStudents, type ImportRow, type ImportResult } from '@/server/services/importStudents'

export async function importStudentsAction(payload: { rows: ImportRow[] }): Promise<ImportResult> {
  const actor = currentActor()
  if (!checkPolicy(actor, 'create', 'student')) throw new Error('forbidden')
  const res = await importStudents(payload.rows)
  revalidatePath('/students')
  revalidatePath('/classes')
  return res
}

