import { prisma } from '@/server/db/client'

export type ImportRow = {
  foreName: string
  className: string
  externalKey: string
}

export type ImportResult = {
  createdStudents: number
  updatedStudents: number
  createdClasses: number
  errors: { index: number; message: string }[]
}

export async function importStudents(rows: ImportRow[]): Promise<ImportResult> {
  const errors: { index: number; message: string }[] = []
  let createdStudents = 0
  let updatedStudents = 0
  let createdClasses = 0

  // Track duplicates in input by externalKey and skip subsequent ones
  const seen: Record<string, number> = {}

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const idx = i
    const foreName = (r.foreName || '').trim()
    const className = (r.className || '').trim()
    const externalKey = (r.externalKey || '').trim()

    if (!foreName || !className || !externalKey) {
      errors.push({ index: idx, message: 'Fehlende Werte (foreName, klasse.name, externKey)' })
      continue
    }

    if (seen[externalKey] !== undefined) {
      errors.push({ index: idx, message: `Duplikat in Datei: externKey bereits in Zeile ${seen[externalKey] + 1}` })
      continue
    }
    seen[externalKey] = idx

    try {
      // find or create class
      let cls = await prisma.class.findFirst({ where: { name: className } })
      if (!cls) {
        cls = await prisma.class.create({ data: { name: className } })
        createdClasses++
      }

      const existing = await prisma.student.findUnique({ where: { externalKey } })
      if (!existing) {
        await prisma.student.create({ data: { externalKey, foreName, classId: cls.id } })
        createdStudents++
      } else {
        await prisma.student.update({
          where: { id: existing.id },
          data: { foreName, classId: cls.id, active: true },
        })
        updatedStudents++
      }
    } catch (e: any) {
      errors.push({ index: idx, message: e?.message ?? 'Unbekannter Fehler' })
    }
  }

  return { createdStudents, updatedStudents, createdClasses, errors }
}

