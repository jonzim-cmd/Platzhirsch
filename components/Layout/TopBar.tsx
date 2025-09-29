"use client"
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { ProfileSettingsModal } from '@/components/profile/ProfileSettingsModal'

type Profile = { id: string; name: string }
type Class = { id: string; name: string }
type Room = { id: string; name: string }

export function TopBar() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null)
  const [classId, setClassId] = useState('')
  const [roomId, setRoomId] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [createMode, setCreateMode] = useState(false)

  useEffect(() => {
    fetch('/api/profiles').then(r=>r.json()).then(setProfiles).catch(()=>{})
    fetch('/api/rooms').then(r=>r.json()).then(setRooms).catch(()=>{})
    // restore from URL/localStorage
    try {
      const url = new URL(window.location.href)
      const p = url.searchParams.get('p')
      const c = url.searchParams.get('c')
      const r = url.searchParams.get('r')
      const lp = localStorage.getItem('activeProfile')
      if (p && profiles.length) {
        const prof = profiles.find(x=>x.id===p) || null
        setActiveProfile(prof)
        if (prof) localStorage.setItem('activeProfile', JSON.stringify(prof))
      } else if (lp) setActiveProfile(JSON.parse(lp))
      if (c) setClassId(c)
      if (r) setRoomId(r)
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // whenever profile changes, load its classes
  useEffect(() => {
    if (!activeProfile) { setClasses([]); updateUrl(undefined, undefined, undefined); return }
    fetch(`/api/classes?profileId=${activeProfile.id}`).then(r=>r.json()).then((cls: Class[]) => {
      setClasses(cls)
      // if currently selected class not in list, clear
      if (cls.findIndex(k=>k.id===classId)===-1) setClassId('')
    })
    // sync URL/localStorage
    localStorage.setItem('activeProfile', JSON.stringify(activeProfile))
    updateUrl(activeProfile.id, classId || undefined, roomId || undefined)
  }, [activeProfile?.id])

  useEffect(() => {
    updateUrl(activeProfile?.id, classId || undefined, roomId || undefined)
  }, [classId, roomId])

  function updateUrl(p?: string, c?: string, r?: string) {
    const url = new URL(window.location.href)
    url.searchParams.delete('p'); url.searchParams.delete('c'); url.searchParams.delete('r')
    if (p) url.searchParams.set('p', p)
    if (c) url.searchParams.set('c', c)
    if (r) url.searchParams.set('r', r)
    window.history.replaceState({}, '', url.toString())
    // also broadcast to other components
    window.dispatchEvent(new StorageEvent('storage', { key: 'selection', newValue: JSON.stringify({ p, c, r }) }))
  }

  const profileLabel = useMemo(() => activeProfile?.name ?? 'Profil wählen…', [activeProfile])

  return (
    <header className="border-b border-neutral-900 bg-bg-soft/60 backdrop-blur">
      <div className="container flex h-12 items-center gap-3">
        {/* Profile */}
        <select
          value={activeProfile?.id || ''}
          onChange={(e) => {
            if (e.target.value === '__new__') { setCreateMode(true); setSettingsOpen(true); return }
            const p = profiles.find(x => x.id === e.target.value) || null
            setActiveProfile(p)
          }}
          className="rounded bg-neutral-900 px-2 py-1 border border-neutral-800"
        >
          <option value="">{profileLabel}</option>
          {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          <option value="__new__">+ Profil anlegen…</option>
        </select>

        {/* Class */}
        <select
          value={classId}
          onChange={(e)=>setClassId(e.target.value)}
          disabled={!activeProfile}
          className="rounded bg-neutral-900 px-2 py-1 border border-neutral-800 disabled:opacity-50"
        >
          <option value="">Klasse wählen…</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        {/* Room */}
        <select
          value={roomId}
          onChange={(e)=>setRoomId(e.target.value)}
          className="rounded bg-neutral-900 px-2 py-1 border border-neutral-800"
        >
          <option value="">Raum wählen…</option>
          {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>

        {/* Settings */}
        <Button aria-label="Einstellungen" onClick={() => { setCreateMode(false); setSettingsOpen(true) }}>⚙️</Button>

        {settingsOpen && (
          <ProfileSettingsModal
            createMode={createMode}
            profile={createMode ? null : activeProfile}
            onClose={async (changed) => {
              setSettingsOpen(false)
              if (changed) {
                const [ps, rs] = await Promise.all([
                  fetch('/api/profiles').then(r=>r.json()),
                  fetch('/api/rooms').then(r=>r.json())
                ])
                setProfiles(ps)
                setRooms(rs)
                if (activeProfile) {
                  const cls = await fetch(`/api/classes?profileId=${activeProfile.id}`).then(r=>r.json())
                  setClasses(cls)
                }
              }
            }}
          />
        )}
      </div>
    </header>
  )
}

