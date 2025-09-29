import { listRooms, createRoom, deleteRoom } from '@/server/actions/rooms'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

async function RoomsList() {
  const rooms = await listRooms()
  return (
    <ul className="divide-y divide-neutral-900 rounded border border-neutral-900">
      {rooms.map((r) => (
        <li key={r.id} className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-medium">{r.name}</span>
            <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-fg-muted">{r.type === 'ADHOC' ? 'Ad-hoc' : 'Normal'}</span>
          </div>
          <form action={async () => { 'use server'; await deleteRoom(r.id) }}>
            <Button type="submit" variant="danger">Löschen</Button>
          </form>
        </li>
      ))}
      {rooms.length === 0 && (
        <li className="px-4 py-6 text-sm text-fg-muted">Noch keine Räume vorhanden.</li>
      )}
    </ul>
  )
}

export default async function RoomsPage() {
  return (
    <main className="container py-8 grid gap-6">
      <h1 className="text-xl font-semibold">Räume</h1>
      <section className="grid gap-3">
        <form
          action={async (formData: FormData) => {
            'use server'
            const name = (formData.get('name') as string)?.trim()
            const type = (formData.get('type') as string) as 'normal' | 'adHoc'
            if (!name) return
            await createRoom(name, type)
          }}
          className="flex items-end gap-3"
        >
          <Input name="name" label="Neuer Raum" placeholder="z. B. W11" />
          <label className="text-sm text-fg-muted grid gap-2">
            <span>Typ</span>
            <select name="type" className="rounded bg-neutral-900 px-2 py-2 border border-neutral-800">
              <option value="normal">Normal</option>
              <option value="adHoc">Ad-hoc</option>
            </select>
          </label>
          <Button type="submit" variant="primary">Anlegen</Button>
        </form>
      </section>
      <RoomsList />
    </main>
  )
}

