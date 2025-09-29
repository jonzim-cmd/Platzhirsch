"use client"
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'

type Profile = { id: string; name: string } | null
type ClassRow = { id: string; name: string; assigned: boolean; leadProfileId: string | null }

export function ProfileSettingsModal({ createMode, profile, onClose }: { createMode: boolean; profile: Profile; onClose: (changed: boolean) => void }) {
  const [name, setName] = useState(profile?.name || '')
  const [rows, setRows] = useState<ClassRow[]>([])
  const [loading, setLoading] = useState(false)
  const [changed, setChanged] = useState(false)

  useEffect(() => {
    let pid = profile?.id
    if (!createMode && pid) {
      fetch(`/api/profile-classes?profileId=${pid}`).then(r=>r.json()).then(setRows)
    } else {
      // pre-load classes list to select for new profile
      fetch(`/api/profile-classes?profileId=__none__`).then(r=>r.json()).then((data)=>{
        // If backend returns error, fallback to /api/classes
        if (Array.isArray(data)) setRows(data.map((d:any)=>({ ...d, assigned: false, leadProfileId: d.leadProfileId ?? null })))
      }).catch(async () => {
        const all = await fetch('/api/classes').then(r=>r.json())
        setRows(all.map((c:any)=>({ id:c.id, name:c.name, assigned:false, leadProfileId: c.leadProfileId ?? null })))
      })
    }
  }, [profile?.id, createMode])

  async function save() {
    setLoading(true)
    try {
      let pid = profile?.id || ''
      if (createMode) {
        const created = await fetch('/api/profiles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }).then(r=>r.json())
        pid = created.id
      } else if (name !== profile?.name) {
        await fetch(`/api/profiles/${profile?.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
      }
      // apply membership toggles
      for (const r of rows) {
        const shouldAssign = !!r.assigned
        await fetch('/api/profile-classes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileId: pid, classId: r.id, assigned: shouldAssign }) })
      }
      // apply lead toggles: if leadProfileId equals pid -> set, if cleared and was pid -> unset
      for (const r of rows) {
        const wantLead = r.leadProfileId === pid
        await fetch('/api/class/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ classId: r.id, leadProfileId: wantLead ? pid : null }) })
      }
      setChanged(true)
      onClose(true)
    } finally {
      setLoading(false)
    }
  }

  function toggleAssigned(id: string) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, assigned: !r.assigned } : r))
    setChanged(true)
  }
  function toggleLead(id: string) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, leadProfileId: r.leadProfileId ? null : (profile?.id || '__temp__') } : r))
    setChanged(true)
  }

  return (
    <Modal onClose={()=>onClose(false)}>
      <div className="w-[min(90vw,800px)] rounded border border-neutral-800 bg-bg-soft p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="text-lg font-medium">{createMode ? 'Profil anlegen' : 'Profil bearbeiten'}</div>
          <button className="text-fg-muted hover:text-fg" onClick={() => onClose(!!changed)}>✕</button>
        </div>
        <div className="mt-4 grid gap-4">
          <Input label="Name" value={name} onChange={(e)=>setName(e.target.value)} placeholder="z. B. Frau Müller" />
          <div>
            <div className="mb-2 text-sm font-medium">Klassen (Zuweisung + Klassenleitung)</div>
            <div className="max-h-[40vh] overflow-auto rounded border border-neutral-900">
              <table className="w-full text-sm">
                <thead className="bg-neutral-900/50">
                  <tr>
                    <th className="px-3 py-2 text-left">Zugewiesen</th>
                    <th className="px-3 py-2 text-left">Klasse</th>
                    <th className="px-3 py-2 text-left">KL</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} className="border-t border-neutral-900">
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={r.assigned} onChange={()=>toggleAssigned(r.id)} />
                      </td>
                      <td className="px-3 py-2">{r.name}</td>
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={!!r.leadProfileId && (!profile?.id || r.leadProfileId === profile?.id)} onChange={()=>toggleLead(r.id)} />
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr><td className="px-3 py-6 text-xs text-fg-muted" colSpan={3}>Keine Klassen gefunden.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex justify-between gap-2">
            {!createMode && profile?.id && (
              <Button
                variant="danger"
                onClick={async () => {
                  if (!confirm('Profil und zugehörige Pläne wirklich löschen?')) return
                  await fetch(`/api/profiles/${profile.id}`, { method: 'DELETE' })
                  onClose(true)
                }}
              >Profil löschen</Button>
            )}
            <div className="flex gap-2">
              <Button onClick={()=>onClose(!!changed)}>Abbrechen</Button>
              <Button variant="primary" onClick={save} disabled={loading || !name.trim()}>{createMode ? 'Anlegen' : 'Speichern'}</Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
