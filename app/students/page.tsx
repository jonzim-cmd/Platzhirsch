import { listStudents, createStudent, deleteStudent } from '@/server/actions/students'
import { listClasses } from '@/server/actions/classes'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

async function StudentsList() {
  const students = await listStudents()
  return (
    <ul className="divide-y divide-neutral-900 rounded border border-neutral-900">
      {students.map((s) => (
        <li key={s.id} className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="font-medium">{s.foreName}</span>
            <span className="text-xs text-fg-muted">{s.class?.name}</span>
          </div>
          <form action={async () => { 'use server'; await deleteStudent(s.id) }}>
            <Button type="submit" variant="danger">Löschen</Button>
          </form>
        </li>
      ))}
      {students.length === 0 && (
        <li className="px-4 py-6 text-sm text-fg-muted">Noch keine Schüler vorhanden.</li>
      )}
    </ul>
  )
}

export default async function StudentsPage() {
  const classes = await listClasses()
  return (
    <main className="container py-8 grid gap-6">
      <h1 className="text-xl font-semibold">Schüler</h1>
      <section className="grid gap-3">
        <form
          action={async (fd: FormData) => {
            'use server'
            const classId = (fd.get('classId') as string) || ''
            const foreName = (fd.get('foreName') as string)?.trim()
            const externalKey = (fd.get('externalKey') as string)?.trim()
            if (!classId || !foreName || !externalKey) return
            await createStudent({ classId, foreName, externalKey })
          }}
          className="grid grid-cols-1 gap-3 md:grid-cols-4"
        >
          <label className="text-sm text-fg-muted grid gap-2">
            <span>Klasse</span>
            <select name="classId" className="rounded bg-neutral-900 px-2 py-2 border border-neutral-800">
              <option value="">– wählen –</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <Input name="foreName" label="Vorname" placeholder="z. B. Ali" />
          <Input name="externalKey" label="externKey" placeholder="z. B. 12345" />
          <div className="flex items-end">
            <Button type="submit" variant="primary" className="w-full">Anlegen</Button>
          </div>
        </form>
        <p className="text-xs text-fg-muted">Hinweis: externKey ist eindeutig und in der UI sonst unsichtbar.</p>
      </section>
      <StudentsList />
    </main>
  )
}

