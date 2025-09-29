import { listProfiles, createProfile, deleteProfile } from '@/server/actions/profiles'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ActiveProfileButton } from '@/components/profile/ActiveProfileButton'

async function ProfilesList() {
  const profiles = await listProfiles()
  return (
    <ul className="divide-y divide-neutral-900 rounded border border-neutral-900">
      {profiles.map((p) => (
        <li key={p.id} className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="font-medium">{p.name}</span>
            <ActiveProfileButton id={p.id} name={p.name} />
          </div>
          <form action={async () => { 'use server'; await deleteProfile(p.id) }}>
            <Button type="submit" variant="danger">Löschen</Button>
          </form>
        </li>
      ))}
      {profiles.length === 0 && (
        <li className="px-4 py-6 text-sm text-fg-muted">Noch keine Profile vorhanden.</li>
      )}
    </ul>
  )
}

export default async function ProfilesPage() {
  return (
    <main className="container py-8 grid gap-6">
      <h1 className="text-xl font-semibold">Profile</h1>
      <section className="grid gap-3">
        <form
          action={async (formData: FormData) => {
            'use server'
            const name = (formData.get('name') as string)?.trim()
            if (!name) return
            await createProfile(name)
          }}
          className="flex items-end gap-3"
        >
          <Input name="name" label="Neues Profil" placeholder="z. B. Frau Müller" />
          <Button type="submit" variant="primary">Anlegen</Button>
        </form>
        <p className="text-xs text-fg-muted">Hinweis: Keine Anmeldung. Alle Profile sind für alle sichtbar und bearbeitbar.</p>
      </section>

      <ProfilesList />
    </main>
  )
}
