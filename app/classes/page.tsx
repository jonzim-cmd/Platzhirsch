import { listClasses, createClass, setClassLead, deleteClass } from '@/server/actions/classes'
import { listProfiles } from '@/server/actions/profiles'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

async function ClassesList() {
  const [classes, profiles] = await Promise.all([listClasses(), listProfiles()])
  return (
    <ul className="divide-y divide-neutral-900 rounded border border-neutral-900">
      {classes.map((c) => (
        <li key={c.id} className="grid gap-2 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium">{c.name}</span>
              {c.leadProfile && (
                <span className="ml-2 text-xs text-fg-muted">(Klassenleitung: {c.leadProfile.name})</span>
              )}
            </div>
            <form action={async () => { 'use server'; await deleteClass(c.id) }}>
              <Button type="submit" variant="danger">Löschen</Button>
            </form>
          </div>
          <form
            action={async (fd: FormData) => {
              'use server'
              const lead = (fd.get('lead') as string) || ''
              await setClassLead(c.id, lead || null)
            }}
            className="flex gap-2"
          >
            <label className="text-xs text-fg-muted flex items-center gap-2">
              <span>Klassenleitung</span>
              <select name="lead" defaultValue={c.leadProfile?.id ?? ''} className="rounded bg-neutral-900 px-2 py-1 border border-neutral-800">
                <option value="">Keine</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <Button type="submit">Speichern</Button>
          </form>
        </li>
      ))}
      {classes.length === 0 && (
        <li className="px-4 py-6 text-sm text-fg-muted">Noch keine Klassen vorhanden.</li>
      )}
    </ul>
  )
}

export default async function ClassesPage() {
  const profiles = await listProfiles()
  return (
    <main className="container py-8 grid gap-6">
      <h1 className="text-xl font-semibold">Klassen</h1>
      <section className="grid gap-3">
        <form
          action={async (formData: FormData) => {
            'use server'
            const name = (formData.get('name') as string)?.trim()
            const lead = (formData.get('lead') as string) || undefined
            if (!name) return
            await createClass(name, lead)
          }}
          className="flex items-end gap-3"
        >
          <Input name="name" label="Neue Klasse" placeholder="z. B. W11" />
          <label className="text-sm text-fg-muted grid gap-2">
            <span>Klassenleitung</span>
            <select name="lead" className="rounded bg-neutral-900 px-2 py-2 border border-neutral-800">
              <option value="">Keine</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="primary">Anlegen</Button>
        </form>
      </section>
      <ClassesList />
    </main>
  )
}

