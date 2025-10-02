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

  // sanitize + filter invalid upfront; record positions for error reporting
  const clean = rows.map((r, i) => ({
    index: i,
    foreName: String(r.foreName || '').trim(),
    className: String(r.className || '').trim(),
    externalKey: String(r.externalKey || '').trim(),
  }))

  // Missing fields
  for (const r of clean) {
    if (!r.foreName || !r.className || !r.externalKey) {
      errors.push({ index: r.index, message: 'Fehlende Werte (foreName, klasse.name, externKey)' })
    }
  }
  const valid = clean.filter(r => r.foreName && r.className && r.externalKey)

  // Duplicates by externalKey within file
  const firstSeen: Record<string, number> = {}
  const deduped: typeof valid = []
  for (const r of valid) {
    if (firstSeen[r.externalKey] !== undefined) {
      errors.push({ index: r.index, message: `Duplikat in Datei: externKey bereits in Zeile ${firstSeen[r.externalKey] + 1}` })
      continue
    }
    firstSeen[r.externalKey] = r.index
    deduped.push(r)
  }
  if (deduped.length === 0) return { createdStudents, updatedStudents, createdClasses, errors }

  // Batch: classes
  const classNames = Array.from(new Set(deduped.map(r => r.className)))
  const existingClasses = await prisma.class.findMany({ where: { name: { in: classNames } }, select: { id: true, name: true } })
  const existingClassMap = new Map(existingClasses.map(c => [c.name, c.id]))
  const missingClassNames = classNames.filter(n => !existingClassMap.has(n))
  if (missingClassNames.length > 0) {
    await prisma.class.createMany({ data: missingClassNames.map(name => ({ name })) })
    createdClasses += missingClassNames.length
  }
  // Re-fetch to get IDs for newly created
  const allClasses = await prisma.class.findMany({ where: { name: { in: classNames } }, select: { id: true, name: true } })
  const classIdByName = new Map(allClasses.map(c => [c.name, c.id]))

  // Batch: students by externalKey
  const keys = deduped.map(r => r.externalKey)
  const existingStudents = await prisma.student.findMany({ where: { externalKey: { in: keys } }, select: { id: true, externalKey: true } })
  const existingByKey = new Map(existingStudents.map(s => [s.externalKey, s.id]))

  // Prepare creates and updates
  const creates: { externalKey: string; foreName: string; classId: string }[] = []
  const updates: { id: string; foreName: string; classId: string; index: number }[] = []
  for (const r of deduped) {
    const classId = classIdByName.get(r.className)
    if (!classId) {
      errors.push({ index: r.index, message: `Klasse nicht gefunden oder erzeugt: ${r.className}` })
      continue
    }
    const existingId = existingByKey.get(r.externalKey)
    if (!existingId) {
      creates.push({ externalKey: r.externalKey, foreName: r.foreName, classId })
    } else {
      updates.push({ id: existingId, foreName: r.foreName, classId, index: r.index })
    }
  }

  if (creates.length > 0) {
    // createMany in chunks to avoid size limits
    const chunkSize = 1000
    for (let i = 0; i < creates.length; i += chunkSize) {
      const chunk = creates.slice(i, i + chunkSize)
      await prisma.student.createMany({ data: chunk })
    }
    createdStudents += creates.length
  }

  // Updates per row (needs individual where clauses)
  if (updates.length > 0) {
    const tx = updates.map(u => prisma.student.update({ where: { id: u.id }, data: { foreName: u.foreName, classId: u.classId, active: true } }))
    await prisma.$transaction(tx)
    updatedStudents += updates.length
  }

  return { createdStudents, updatedStudents, createdClasses, errors }
}
