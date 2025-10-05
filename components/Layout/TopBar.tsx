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
  const [sidebarOpen, setSidebarOpen] = useState(false)

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
    <header className="border-b border-neutral-900 bg-bg-soft">
      <div className="flex h-12 items-center">
        <div className="pl-2 pr-2">
          <Button aria-label="Sidebar umschalten" onClick={() => {
            const next = !sidebarOpen
            setSidebarOpen(next)
            window.dispatchEvent(new StorageEvent('storage', { key: 'sidebar', newValue: JSON.stringify({ open: next }) }))
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </Button>
        </div>
        <div className="container flex flex-1 items-center justify-start gap-3">
          <div className="flex items-center gap-2">
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
          </div>

        </div>
        <div className="ml-auto pr-2">
          {/* Settings right-aligned */}
          <Button aria-label="Einstellungen" onClick={() => { setCreateMode(false); setSettingsOpen(true) }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 005 15a1.65 1.65 0 00-1.51-1H3.4a2 2 0 010-4h.09A1.65 1.65 0 005 8a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 3.4V3.31a2 2 0 014 0V3.4A1.65 1.65 0 0014 5a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019 9c.73 0 1.37.41 1.69 1.05.09.19.14.4.14.62s-.05.43-.14.62A1.65 1.65 0 0019.4 15z" />
            </svg>
          </Button>
        </div>
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
