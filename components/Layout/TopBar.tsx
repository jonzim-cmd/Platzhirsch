"use client"
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { ProfileSettingsModal } from '@/components/profile/ProfileSettingsModal'
import { InlineInput } from '@/components/ui/InlineInput'

type Profile = { id: string; name: string }
type Class = { id: string; name: string }
type Room = { id: string; name: string }
type PlanRow = { id: string; title: string | null; isDefault: boolean }

export function TopBar() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null)
  const [classId, setClassId] = useState('')
  const [roomId, setRoomId] = useState('')
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [planId, setPlanId] = useState('')
  // Derive a selected plan id that prefers the default plan when none chosen yet
  const computedPlanId = useMemo(() => {
    return planId || plans.find(p => p.isDefault)?.id || plans[0]?.id || ''
  }, [planId, plans])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [createMode, setCreateMode] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // Inline create/rename state
  const [creatingProfile, setCreatingProfile] = useState(false)
  const [renamingProfile, setRenamingProfile] = useState(false)
  const [profileDraftName, setProfileDraftName] = useState('')
  const profileInputRef = useRef<HTMLInputElement | null>(null)
  const [jumpToClasses, setJumpToClasses] = useState(false)

  // Only show rooms that are assigned for the active profile (union across classes)
  const visibleRooms = useMemo(() => {
    try {
      if (!activeProfile?.id) return rooms
      const raw = localStorage.getItem(`profile:${activeProfile.id}:classRooms`)
      if (!raw) return rooms
      const mapping = JSON.parse(raw) as Record<string, string[]>
      const byName = new Set<string>()
      Object.values(mapping).forEach(list => (list || []).forEach(n => byName.add(n)))
      if (byName.size === 0) return rooms
      return rooms.filter(r => byName.has(r.name))
    } catch {
      return rooms
    }
  }, [rooms, activeProfile?.id])

  useEffect(() => {
    fetch('/api/profiles').then(r=>r.json()).then(setProfiles).catch(()=>{})
    fetch('/api/rooms').then(r=>r.json()).then(setRooms).catch(()=>{})
    // restore from URL/localStorage
    try {
      const url = new URL(window.location.href)
      const p = url.searchParams.get('p')
      const c = url.searchParams.get('c')
      const r = url.searchParams.get('r')
      const pl = url.searchParams.get('pl')
      const lp = localStorage.getItem('activeProfile')
      if (p && profiles.length) {
        const prof = profiles.find(x=>x.id===p) || null
        setActiveProfile(prof)
        if (prof) localStorage.setItem('activeProfile', JSON.stringify(prof))
      } else if (lp) setActiveProfile(JSON.parse(lp))
      if (c) setClassId(c)
      if (r) setRoomId(r)
      if (pl) setPlanId(pl)
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Listen for external selection changes (e.g., default plan auto-created in editor)
  useEffect(() => {
    const onSelection = (e: StorageEvent) => {
      if (e.key === 'selection' && e.newValue) {
        try {
          const v = JSON.parse(e.newValue)
          // Do not change active profile from external events
          if (v?.c) setClassId(v.c)
          if (v?.r) setRoomId(v.r)
          if (v?.pl) setPlanId(v.pl)
        } catch {}
      } else if (e.key === 'dataChanged') {
        // refresh lists (profiles, rooms, and classes for active profile)
        ;(async () => {
          try {
            const [ps, rs] = await Promise.all([
              fetch('/api/profiles').then(r=>r.json()),
              fetch('/api/rooms').then(r=>r.json())
            ])
            setProfiles(ps)
            setRooms(rs)
            if (activeProfile) {
              const cls = await fetch(`/api/classes?profileId=${activeProfile.id}`).then(r=>r.json())
              setClasses(cls)
              // If current class selection no longer exists, clear it
              if (cls.findIndex((k: any) => k.id === classId) === -1) setClassId('')
              const updated = ps.find((p: any) => p.id === activeProfile.id)
              if (updated) {
                setActiveProfile(updated)
                localStorage.setItem('activeProfile', JSON.stringify(updated))
              } else {
                // Active profile no longer exists: clear selection immediately
                setActiveProfile(null)
                setClassId('')
                setRoomId('')
                setPlanId('')
                try {
                  localStorage.removeItem('activeProfile')
                } catch {}
                updateUrl(undefined, undefined, undefined, undefined)
              }
            }
          } catch { /* noop */ }
        })()
      }
    }
    window.addEventListener('storage', onSelection)
    return () => window.removeEventListener('storage', onSelection)
  }, [profiles, activeProfile, classId])

  // Focus the inline input when creating/renaming toggles on
  useEffect(() => {
    if ((creatingProfile || renamingProfile) && profileInputRef.current) {
      profileInputRef.current.focus()
      profileInputRef.current.select()
    }
  }, [creatingProfile, renamingProfile])

  // Keep local sidebar state in sync with global storage events
  useEffect(() => {
    const onSidebar = (e: StorageEvent) => {
      if (e.key === 'sidebar' && e.newValue) {
        try {
          const v = JSON.parse(e.newValue)
          setSidebarOpen(!!v.open)
        } catch {}
      }
    }
    window.addEventListener('storage', onSidebar)
    return () => window.removeEventListener('storage', onSidebar)
  }, [])

  // whenever profile changes, load its classes
  useEffect(() => {
    if (!activeProfile) { setClasses([]); updateUrl(undefined, undefined, undefined, undefined); return }
    fetch(`/api/classes?profileId=${activeProfile.id}`).then(r=>r.json()).then((cls: Class[]) => {
      setClasses(cls)
      // if currently selected class not in list, clear
      if (cls.findIndex(k=>k.id===classId)===-1) setClassId('')
    })
    // sync URL/localStorage
    localStorage.setItem('activeProfile', JSON.stringify(activeProfile))
    // reset selected plan when switching profiles to avoid cross-profile planId bleed
    setPlanId('')
    updateUrl(activeProfile.id, classId || undefined, roomId || undefined, undefined)
  }, [activeProfile?.id])

  // Clear room selection when it becomes invalid for the filtered list
  useEffect(() => {
    if (!roomId) return
    if (!visibleRooms.some(r => r.id === roomId)) setRoomId('')
  }, [visibleRooms, roomId])

  // Clear plan selection on class/room change so new context decides default
  useEffect(() => {
    if (planId) {
      setPlanId('')
      updateUrl(activeProfile?.id, classId || undefined, roomId || undefined, undefined)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, roomId])

  useEffect(() => {
    updateUrl(activeProfile?.id, classId || undefined, roomId || undefined, planId || undefined)
  }, [classId, roomId, planId])

  // Load plans whenever owner/class/room changes
  useEffect(() => {
    const ownerId = activeProfile?.id
    if (!ownerId || !classId || !roomId) { setPlans([]); setPlanId(''); return }
    // reset current plan selection for new context to ensure default selection
    setPlanId('')
    fetch(`/api/plans?ownerProfileId=${ownerId}&classId=${classId}&roomId=${roomId}`)
      .then(r=>r.json())
      .then((data) => {
        const raw: PlanRow[] = (data?.plans || [])
        // de-duplicate multiple defaults defensively (keep the first/default-most recent)
        let seenDefault = false
        const arr = raw.filter((p) => {
          if (p.isDefault) {
            if (seenDefault) return false
            seenDefault = true
          }
          return true
        })
        setPlans(arr)
        const def = arr.find(p => p.isDefault) || arr[0]
        if (def) setPlanId(def.id)
      })
      .catch(() => { setPlans([]); setPlanId('') })
  }, [activeProfile?.id, classId, roomId])

  // Ensure a plan is always selected once plans are present
  useEffect(() => {
    if (!activeProfile?.id || !classId || !roomId) return
    if (plans.length === 0) return
    if (!planId) {
      const def = plans.find(p => p.isDefault) || plans[0]
      if (def) setPlanId(def.id)
    }
  }, [activeProfile?.id, classId, roomId, plans, planId])

  function updateUrl(p?: string, c?: string, r?: string, pl?: string) {
    const url = new URL(window.location.href)
    url.searchParams.delete('p'); url.searchParams.delete('c'); url.searchParams.delete('r'); url.searchParams.delete('pl')
    if (p) url.searchParams.set('p', p)
    if (c) url.searchParams.set('c', c)
    if (r) url.searchParams.set('r', r)
    if (pl) url.searchParams.set('pl', pl)
    window.history.replaceState({}, '', url.toString())
    // also broadcast to other components
    window.dispatchEvent(new StorageEvent('storage', { key: 'selection', newValue: JSON.stringify({ p, c, r, pl }) }))
  }

  const profileLabel = useMemo(() => 'Profil wählen…', [])

  async function createProfileInline() {
    const trimmed = profileDraftName.trim()
    if (!trimmed) return
    try {
      const res = await fetch('/api/profiles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: trimmed }) })
      if (!res.ok) return
      const created = await res.json()
      const newProfile: Profile = { id: created.id, name: created.name }
      setProfiles(prev => [newProfile, ...prev])
      setActiveProfile(newProfile)
      setCreatingProfile(false)
      setProfileDraftName('')
      localStorage.setItem('activeProfile', JSON.stringify(newProfile))
      updateUrl(newProfile.id, undefined, undefined, undefined)
      // open settings to finish setup (classes/rooms/etc.)
      setCreateMode(false)
      setTimeout(() => setSettingsOpen(true), 0)
      setJumpToClasses(true)
    } catch { /* noop */ }
  }

  async function renameProfileInline() {
    const trimmed = profileDraftName.trim()
    if (!trimmed || !activeProfile) { setRenamingProfile(false); return }
    try {
      const res = await fetch(`/api/profiles/${activeProfile.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: trimmed }) })
      if (!res.ok) return
      setProfiles(prev => prev.map(p => p.id === activeProfile.id ? { ...p, name: trimmed } : p))
      const updated = { ...activeProfile, name: trimmed }
      setActiveProfile(updated)
      setRenamingProfile(false)
      setProfileDraftName('')
      localStorage.setItem('activeProfile', JSON.stringify(updated))
      updateUrl(updated.id, classId || undefined, roomId || undefined, planId || undefined)
    } catch { /* noop */ }
  }

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
            {/* Profile selector with inline create/rename */}
            {!creatingProfile && !renamingProfile && (
              <div className="flex items-center gap-2">
                <select
                  value={activeProfile?.id || ''}
                  onChange={(e) => {
                    const p = profiles.find(x => x.id === e.target.value) || null
                    setActiveProfile(p)
                  }}
                  className="rounded bg-neutral-900 px-2 py-1 border border-neutral-800"
                >
                  {!activeProfile && <option value="">{profileLabel}</option>}
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <Button
                  aria-label="Neues Profil"
                  title="Neues Profil"
                  onClick={() => {
                    setCreatingProfile(true)
                    setRenamingProfile(false)
                    setProfileDraftName('')
                  }}
                  className="px-2 py-1"
                >
                  +
                </Button>
              </div>
            )}
            {(creatingProfile || renamingProfile) && (
              <div className="flex items-center gap-2">
                <InlineInput
                  ref={profileInputRef}
                  value={profileDraftName}
                  onChange={(e) => setProfileDraftName(e.target.value)}
                  placeholder={creatingProfile ? 'Namen angeben' : 'Profilname'}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') creatingProfile ? createProfileInline() : renameProfileInline()
                    if (e.key === 'Escape') { setCreatingProfile(false); setRenamingProfile(false); setProfileDraftName('') }
                  }}
                  className="w-56"
                />
                <Button
                  onClick={() => creatingProfile ? createProfileInline() : renameProfileInline()}
                  variant="primary"
                >
                  {creatingProfile ? 'Anlegen' : 'Speichern'}
                </Button>
                <Button onClick={() => { setCreatingProfile(false); setRenamingProfile(false); setProfileDraftName('') }}>Abbrechen</Button>
              </div>
            )}

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
              {visibleRooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>

            {/* Active Plan */}
            <select
              value={computedPlanId}
              onChange={async (e) => {
                if (e.target.value === '__new__') {
                  // simple prompt for name
                  const name = window.prompt('Neuen Plan benennen:', 'Neuer Plan') || ''
                  const trimmed = name.trim()
                  if (!trimmed) { e.target.value = planId; return }
                  try {
                    const body: any = { ownerProfileId: activeProfile!.id, classId, roomId, name: trimmed, sourcePlanId: planId || undefined }
                    const res = await fetch('/api/plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
                    if (!res.ok) throw new Error('create failed')
                    const data = await res.json()
                    const created = data.plan
                    setPlans((prev) => [{ id: created.id, title: created.title, isDefault: false }, ...prev])
                    setPlanId(created.id)
                  } catch { /* noop */ }
                  return
                }
                setPlanId(e.target.value)
              }}
              disabled={!activeProfile || !classId || !roomId}
              className="rounded bg-neutral-900 px-2 py-1 border border-neutral-800 disabled:opacity-50"
            >
              <option value="">Plan wählen…</option>
              {plans.map(pl => (
                <option key={pl.id} value={pl.id}>{pl.isDefault ? 'Standard' : (pl.title || 'Plan')}</option>
              ))}
              <option value="__new__">+ Neuer Plan…</option>
            </select>
            {planId === '__new__' && (
              <span className="hidden" />
            )}
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
            jumpTo={jumpToClasses ? 'classes' : undefined}
            onClose={async (changed) => {
              setSettingsOpen(false)
              setJumpToClasses(false)
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
