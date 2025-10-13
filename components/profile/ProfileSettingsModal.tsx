"use client"
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FormRow } from '@/components/ui/FormRow'
import { InlineInput } from '@/components/ui/InlineInput'
import { Modal } from '@/components/ui/Modal'
import { ImportStudents } from '@/components/import/ImportStudents'
import { MultiSelect } from '@/components/ui/MultiSelect'

type Profile = { id: string; name: string } | null
type ClassRow = { id: string; name: string; assigned: boolean; leadProfileId: string | null }
type PlanRow = { id: string; title: string | null; class: { id: string; name: string }; room: { id: string; name: string } }

export function ProfileSettingsModal({ createMode, profile, onClose, jumpTo }: { createMode: boolean; profile: Profile; onClose: (changed: boolean) => void; jumpTo?: 'classes' }) {
  const [section, setSection] = useState<'profile'|'data'|'plans'|'admin'>('profile')

  // Profiles
  const [allProfiles, setAllProfiles] = useState<{ id: string; name: string }[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<string>(() => profile?.id || '')
  const [name, setName] = useState(() => profile?.name || '')
  const nameInputRef = useRef<HTMLInputElement | null>(null)

  // Classes and rooms
  const [rows, setRows] = useState<ClassRow[]>([])
  const [rooms, setRooms] = useState<{ id: string; name: string }[]>([])
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [loading, setLoading] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [changed, setChanged] = useState(false)
  const classesBlockRef = useRef<HTMLDivElement | null>(null)
  // Explicit selection for "Meine Klassenleitung" (per current profile)
  const [leadSelection, setLeadSelection] = useState<string>('')
  // Baselines to compute diffs and reduce unnecessary network calls
  const baselineRowsRef = useRef<ClassRow[]>([])
  const baselineProfileRef = useRef<string | null>(null)
  const baselineLeadIdRef = useRef<string | null>(null)

  // Students tab
  const [studentClassId, setStudentClassId] = useState('')
  const [students, setStudents] = useState<{ id: string; foreName: string }[]>([])
  const [newStudentName, setNewStudentName] = useState('')
  // Admin tab state
  const [adminConfirm, setAdminConfirm] = useState('')
  const [adminDeleting, setAdminDeleting] = useState(false)

  function fetchWithTimeout(resource: RequestInfo | URL, options: RequestInit & { timeoutMs?: number } = {}) {
    const { timeoutMs = 10000, ...rest } = options
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeoutMs)
    return fetch(resource, { ...rest, signal: controller.signal }).finally(() => clearTimeout(id))
  }

  async function fetchJsonSafe<T = any>(res: Response): Promise<T> {
    const text = await res.text()
    if (!text) return undefined as unknown as T
    try { return JSON.parse(text) as T } catch { throw new Error('Ungültige Server-Antwort') }
  }

  // Suggested rooms for onboarding (can be adjusted/extended by user)
  const [roomSuggestions, setRoomSuggestions] = useState<string[]>(['W11','W12','W13','W14','W21','W22','W23','W24'])
  const [classSuggestions, setClassSuggestions] = useState<string[]>([
    ...Array.from({length:7}, (_,i)=>`10${String.fromCharCode(65+i)}`),
    ...Array.from({length:4},(_,i)=>`11${String.fromCharCode(65+i)}`),
    '11Z'
  ])
  // Rooms per assigned class (by classId if known, else by name prefixed with name:)
  // Ephemeral selection state (no localStorage)
  const [classRooms, setClassRooms] = useState<Record<string, Set<string>>>({})

  async function addRoomSuggestion(name: string) {
    const n = name.trim()
    if (!n) return
    try {
      const rs = await fetch('/api/rooms').then(r=>r.json()).catch(()=>[])
      if (Array.isArray(rs) && rs.some((r: any) => (r?.name || '').toLowerCase() === n.toLowerCase())) {
        alert(`Raum "${n}" existiert bereits.`)
      }
    } catch {}
    setRoomSuggestions(prev => (prev.includes(n) ? prev : [...prev, n]))
  }
  async function addClassSuggestion(name: string) {
    const n = name.trim()
    if (!n) return
    try {
      const cs = await fetch('/api/classes').then(r=>r.json()).catch(()=>[])
      if (Array.isArray(cs) && cs.some((c: any) => (c?.name || '').toLowerCase() === n.toLowerCase())) {
        alert(`Klasse "${n}" existiert bereits.`)
      }
    } catch {}
    setClassSuggestions(prev => (prev.includes(n) ? prev : [...prev, n]))
  }

  // Load profile-related lists
  useEffect(() => {
    fetch('/api/profiles').then(r=>r.json()).then(setAllProfiles).catch(()=>setAllProfiles([]))
    let pid = profile?.id
    if (pid) {
      // Classes for membership + lead toggle
      fetchWithTimeout(`/api/profile-classes?profileId=${pid}`)
        .then(async (r) => {
          if (!r.ok) throw new Error(await r.text())
          const data = await fetchJsonSafe<any[]>(r)
          return Array.isArray(data) ? data : []
        })
        .then((data) => {
          setRows(data)
          baselineRowsRef.current = data
          baselineProfileRef.current = pid
          baselineLeadIdRef.current = (data.find(x => x.leadProfileId === pid)?.id || null)
        })
        .catch(async () => {
          const all = await fetchWithTimeout('/api/classes').then(async (r) => {
            if (!r.ok) return [] as any[]
            const data = await fetchJsonSafe<any[]>(r)
            return Array.isArray(data) ? data : []
          })
          const init = all.map((c:any)=>({ id:c.id, name:c.name, assigned:false, leadProfileId: c.leadProfileId ?? null }))
          setRows(init)
          baselineRowsRef.current = init
          baselineProfileRef.current = pid
          baselineLeadIdRef.current = (init.find(x => x.leadProfileId === pid)?.id || null)
        })
      // Rooms
      fetchWithTimeout('/api/rooms').then(async (r) => setRooms(await r.json())).catch(()=>setRooms([]))
      // Named Plans archive
      fetchWithTimeout(`/api/plans?ownerProfileId=${pid}&all=1`).then(async (r) => {
        if (!r.ok) return setPlans([])
        const data = await fetchJsonSafe<{ plans: PlanRow[] }>(r)
        setPlans((data?.plans || []) as any)
      }).catch(()=>setPlans([]))
    }
  }, [profile?.id, createMode])

  // Initialize lead selection from DB only if this profile is currently the lead for a class
  useEffect(() => {
    const pid = selectedProfileId || profile?.id || ''
    if (!pid) { setLeadSelection(''); return }
    const match = rows.find(r => (r.leadProfileId === pid) && r.assigned)
    setLeadSelection(match ? (match.id || `name:${match.name}`) : '')
  }, [rows, selectedProfileId, profile?.id])

  // Intentionally ignore external selection events: profile should only change when user changes it

  // Ensure current selected profile appears as option even if not yet in fetched list
  const profileOptions = useMemo(() => {
    let arr = allProfiles
    if (selectedProfileId && selectedProfileId !== '__new__' && !arr.some(p => p.id === selectedProfileId)) {
      const fallbackName = name || (profile?.name || 'Profil')
      arr = [{ id: selectedProfileId, name: fallbackName }, ...arr]
    }
    return arr
  }, [allProfiles, selectedProfileId, name, profile?.name])

  // Focus name field when in explicit create mode or when switching to __new__
  useEffect(() => {
    if (createMode || selectedProfileId === '__new__') {
      nameInputRef.current?.focus()
    }
  }, [createMode, selectedProfileId])

  // Sync dropdown selection and name when a profile is provided via props (e.g., from TopBar)
  useEffect(() => {
    if (profile?.id) {
      setSelectedProfileId(profile.id)
      setName(profile.name || '')
    }
  }, [profile?.id, profile?.name])

  // Jump to classes section when requested
  useEffect(() => {
    if (jumpTo === 'classes') {
      setSection('profile')
      setTimeout(() => classesBlockRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
    }
  }, [jumpTo])

  // Load students for selected class in Data/Students tab
  useEffect(() => {
    if (!studentClassId) { setStudents([]); return }
    fetchWithTimeout(`/api/students?classId=${studentClassId}`).then(async (r) => {
      if (!r.ok) { setStudents([]); return }
      setStudents(await r.json())
    }).catch(()=>setStudents([]))
  }, [studentClassId])

  async function saveProfileBasics() {
    setLoading(true)
    try {
      let pid = selectedProfileId || profile?.id || ''
      // Create new profile if requested
      if (selectedProfileId === '__new__' || (!pid && name.trim())) {
        const created = await fetch('/api/profiles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }).then(r=>r.json())
        pid = created.id
        // switch UI into the newly created profile context without closing modal
        setSelectedProfileId(pid)
        // refresh profiles list so it can be selected elsewhere
        try {
          const ps = await fetch('/api/profiles').then(r=>r.json())
          setAllProfiles(ps)
        } catch {}
      } else if (pid && name && allProfiles.find(p => p.id === pid)?.name !== name) {
        await fetch(`/api/profiles/${pid}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
        // update local list to reflect renamed profile immediately
        setAllProfiles(prev => prev.map(p => p.id === pid ? { ...p, name } : p))
      }
      if (!pid) throw new Error('Kein Profil ausgewählt')
      // Ensure new classes exist for any suggestion-added names
      const ensureClass = async (name: string): Promise<{ id: string; name: string }> => {
        // if present in rows with id, return
        const existing = rows.find(r => r.name === name && r.id)
        if (existing) return { id: existing.id, name: existing.name }
        const res = await fetch('/api/classes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
        if (res.status === 409) {
          const data = await res.json().catch(()=>null as any)
          const cls = data?.class
          if (cls?.id && cls?.name) return { id: cls.id, name: cls.name }
        }
        const created = await res.json()
        return created
      }

      // Ensure class IDs for newly added suggestion-rows that are assigned (parallel)
      const ensureTasks: Promise<any>[] = []
      for (const r of rows) {
        if (!r.id && r.assigned) ensureTasks.push(ensureClass(r.name).then(created => { r.id = created.id }))
      }
      if (ensureTasks.length) await Promise.all(ensureTasks)

      // Prepare baseline map for diffs
      const baselineMap = new Map<string, ClassRow>()
      for (const b of baselineRowsRef.current || []) baselineMap.set(b.id || `name:${b.name}`,(b))

      // Membership: only send changes
      const membershipTasks: Promise<any>[] = []
      for (const r of rows) {
        const key = r.id || `name:${r.name}`
        const prev = baselineMap.get(key)
        const changedAssign = (prev?.assigned ?? false) !== (!!r.assigned)
        if (r.id && changedAssign) {
          membershipTasks.push(
            fetch('/api/profile-classes', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ profileId: pid, classId: r.id, assigned: !!r.assigned })
            })
          )
        }
      }

      // Lead toggle: update only if changed
      const leadKey = leadSelection
      const newLeadId = rows.find(r => (r.id || `name:${r.name}`) === leadKey)?.id || null
      const prevLeadId = baselineLeadIdRef.current
      const leadTasks: Promise<any>[] = []
      if (prevLeadId !== newLeadId) {
        if (prevLeadId) leadTasks.push(fetch('/api/class/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ classId: prevLeadId, leadProfileId: null }) }))
        if (newLeadId) leadTasks.push(fetch('/api/class/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ classId: newLeadId, leadProfileId: pid }) }))
      }

      // Rooms: ensure existence (best effort, parallel)
      const allSelectedRooms = new Set<string>()
      for (const key of Object.keys(classRooms)) for (const r of classRooms[key]) allSelectedRooms.add(r)
      const roomTasks: Promise<any>[] = []
      for (const roomName of allSelectedRooms) {
        roomTasks.push((async () => {
          try {
            const res = await fetch('/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: roomName }) })
            // Ignore 409 on save: existence is expected here
            if (res.status === 409) { /* noop */ }
          } catch { /* ignore */ }
        })())
      }

      await Promise.all([...membershipTasks, ...leadTasks, ...roomTasks])

      // Persist mapping for the currently configured class (server-side)
      try {
        const key = configClassKey
        const row = rows.find(r => (r.id || `name:${r.name}`) === key)
        const clsId = row?.id || ''
        if (clsId) {
          const sel = Array.from(classRooms[key] || [])
          await fetch('/api/class-rooms', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ownerProfileId: pid, classId: clsId, roomNames: sel }) })
          try { window.dispatchEvent(new CustomEvent('mapping-updated', { detail: { profileId: pid, classId: clsId } })) } catch {}
        }
      } catch {}
      // mark as changed but keep modal open for further edits
      setChanged(true)
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 900)
      // Notify same-tab consumers (TopBar/Editor) to refetch mapping as needed
      try { window.dispatchEvent(new CustomEvent('data-changed', { detail: { type: 'dataChanged', profileId: pid } })) } catch {}
      // update baselines after successful save
      baselineRowsRef.current = rows.map(r => ({ ...r }))
      baselineProfileRef.current = pid
      baselineLeadIdRef.current = newLeadId || null
    } finally {
      setLoading(false)
    }
  }

  // Helpers for Data tabs
  function toggleAssigned(id: string) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, assigned: !r.assigned } : r))
    setChanged(true)
  }
  // leadSelection explicit via select; no auto-toggle

  async function addStudent() {
    if (!studentClassId || !newStudentName.trim()) return
    const s = await fetch('/api/students', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ classId: studentClassId, foreName: newStudentName.trim() }) }).then(r=>r.json())
    setStudents(prev => [...prev, s])
    setNewStudentName('')
  }

  async function renameStudent(id: string, foreName: string) {
    await fetch(`/api/students/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ foreName }) })
    setStudents(prev => prev.map(s => s.id === id ? { ...s, foreName } : s))
  }

  async function deleteStudent(id: string) {
    if (!confirm('Schüler wirklich löschen?')) return
    await fetch(`/api/students/${id}`, { method: 'DELETE' })
    setStudents(prev => prev.filter(s => s.id !== id))
  }

  async function createRoom() {
    const n = prompt('Neuen Raum anlegen (Name):', '')?.trim()
    if (!n) return
    try {
      const res = await fetch('/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: n }) })
      if (res.status === 409) {
        const data = await res.json().catch(()=>null as any)
        const room = data?.room
        alert(`Raum "${room?.name || n}" existiert bereits.`)
        try { const all = await fetch('/api/rooms').then(r=>r.json()); setRooms(all) } catch {}
        return
      }
      const r = await res.json()
      setRooms(prev => [...prev, r])
    } catch {}
  }

  async function deleteRoomById(id: string) {
    if (!confirm('Raum wirklich löschen?')) return
    await fetch(`/api/rooms/${id}`, { method: 'DELETE' })
    setRooms(prev => prev.filter(r => r.id !== id))
  }

  async function renamePlan(id: string) {
    const cur = plans.find(p => p.id === id)
    const t = prompt('Plan umbenennen:', cur?.title || 'Neuer Name')?.trim()
    if (!t) return
    await fetch(`/api/plan/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: t }) })
    setPlans(prev => prev.map(p => p.id === id ? { ...p, title: t } : p))
  }

  async function deletePlan(id: string) {
    if (!confirm('Plan wirklich löschen?')) return
    const res = await fetch(`/api/plan/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      alert('Löschen fehlgeschlagen (Standardplan kann nicht gelöscht werden).')
      return
    }
    setPlans(prev => prev.filter(p => p.id !== id))
  }

  // Removed legacy local lead class preference (no browser storage)

  // helpers for multi-select controls
  const selectedClassNames = rows.filter(r=>r.assigned).map(r=>r.name)
  const [configClassKey, setConfigClassKey] = useState<string>('')
  useEffect(() => {
    if (configClassKey) return
    // Prefer the class currently selected in the TopBar via URL
    let selectedClassId = ''
    try {
      const url = new URL(window.location.href)
      selectedClassId = url.searchParams.get('c') || ''
    } catch {}
    let target = undefined as ClassRow | undefined
    if (selectedClassId) {
      target = rows.find(r => r.assigned && r.id === selectedClassId)
    }
    if (!target) {
      target = rows.find(r => r.assigned)
    }
    if (target) setConfigClassKey(target.id || `name:${target.name}`)
  }, [rows, configClassKey])

  // Merge server-derived rooms for the focused class into the local selection (nur wenn lokal noch nichts gesetzt ist)
  useEffect(() => {
    const pid = profile?.id || selectedProfileId || ''
    if (!pid) return
    const key = configClassKey
    if (!key) return
    const row = rows.find(r => (r.id || `name:${r.name}`) === key)
    const clsId = row?.id
    if (!clsId) return
    // Wenn bereits lokale Auswahl existiert, nicht vom Server wieder auffüllen (ermöglicht Entfernen)
    if ((classRooms[key] && (classRooms[key] as Set<string>).size > 0)) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/class-rooms?ownerProfileId=${pid}&classId=${clsId}`)
        if (!res.ok) return
        const data = await res.json()
        const roomNames: string[] = Array.isArray(data?.rooms) ? (data.rooms as any[]).map(r => String(r?.name || '').trim()).filter(Boolean) : []
        if (cancelled || roomNames.length === 0) return
        setClassRooms(prev => {
          const existing = new Set(prev[key] || [])
          let changed = false
          for (const n of roomNames) if (!existing.has(n)) { existing.add(n); changed = true }
          return changed ? { ...prev, [key]: existing } : prev
        })
      } catch { /* ignore */ }
    })()
    return () => { cancelled = true }
  }, [profile?.id, selectedProfileId, configClassKey, rows, classRooms])

  // Build room options from global rooms + suggestions + currently selected values
  const roomOptionValues = useMemo(() => {
    const set = new Set<string>()
    try {
      for (const r of rooms || []) if (r?.name) set.add(r.name)
    } catch {}
    try {
      for (const n of roomSuggestions || []) if (n) set.add(n)
    } catch {}
    try {
      const sel = Array.from(classRooms[configClassKey] || [])
      for (const n of sel) if (n) set.add(n)
    } catch {}
    return Array.from(set).sort((a,b)=>a.localeCompare(b,'de'))
  }, [rooms, roomSuggestions, classRooms, configClassKey])

  function onClassesMultiSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const sel = new Set(Array.from(e.target.selectedOptions).map(o => o.value))
    setRows(prev => {
      const copy = [...prev]
      // mark from suggestions
      for (const n of classSuggestions) {
        const idx = copy.findIndex(r=>r.name===n)
        if (idx>=0) copy[idx] = { ...copy[idx], assigned: sel.has(n) }
        else if (sel.has(n)) copy.push({ id: '', name: n, assigned: true, leadProfileId: null })
      }
      return copy
    })
  }

  function onRoomsMultiSelectChange(classKey: string, e: React.ChangeEvent<HTMLSelectElement>) {
    const sel = new Set(Array.from(e.target.selectedOptions).map(o => o.value))
    setClassRooms(prev => ({ ...prev, [classKey]: sel }))
  }

  return (
    <Modal onClose={()=>onClose(false)}>
      <div className="w-[min(92vw,1000px)] h-[86vh] overflow-hidden rounded border border-neutral-800 bg-bg-soft p-0 shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-900 px-4 py-3">
          <div className="text-lg font-medium">{createMode ? 'Profil anlegen' : 'Profil-Schaltzentrale'}</div>
          <button className="text-fg-muted hover:text-fg px-2" onClick={() => onClose(!!changed)}>✕</button>
        </div>
        <div className="flex h-[calc(86vh-48px)]">
          {/* Sidebar */}
          <nav className="w-56 border-r border-neutral-900 p-3">
            <ul className="grid gap-1 text-sm">
              <li><button className={`w-full text-left rounded px-2 py-1 ${section==='profile'?'bg-neutral-900':''}`} onClick={()=>setSection('profile')}>Profil-Setup</button></li>
              <li><button className={`w-full text-left rounded px-2 py-1 ${section==='data'?'bg-neutral-900':''}`} onClick={()=>setSection('data')}>Schülerverwaltung</button></li>
              <li><button className={`w-full text-left rounded px-2 py-1 ${section==='plans'?'bg-neutral-900':''}`} onClick={()=>setSection('plans')}>Gespeicherte Pläne</button></li>
              <li><button className={`w-full text-left rounded px-2 py-1 ${section==='admin'?'bg-neutral-900':''}`} onClick={()=>setSection('admin')}>Admin</button></li>
            </ul>
          </nav>

          {/* Content */}
          <div className="flex-1 p-4 overflow-auto">
            {section === 'profile' && (
              <div className="grid gap-4">
                <div className="grid gap-3">
                  <FormRow
                    label="Profil"
                  >
                    <div className="flex items-center gap-2">
                      <select
                        className="rounded bg-neutral-900 px-2 text-sm border border-neutral-800 w-56 h-9"
                        value={(selectedProfileId && selectedProfileId !== '__new__') ? selectedProfileId : ''}
                        onChange={(e)=>{
                          const v = e.target.value
                          setSelectedProfileId(v)
                          if (v && v !== '__new__') {
                            const p = allProfiles.find(x=>x.id===v)
                            setName(p?.name || '')
                            // reload rows and plans for selected profile
                            fetch(`/api/profile-classes?profileId=${v}`)
                              .then(r=>r.json())
                              .then((data)=>{ setRows(data); baselineRowsRef.current = data; baselineProfileRef.current = v; baselineLeadIdRef.current = (data.find((x:any)=>x.leadProfileId===v)?.id || null) })
                              .catch(()=>{ setRows([]); baselineRowsRef.current = []; baselineProfileRef.current = v; baselineLeadIdRef.current = null })
                            fetch('/api/rooms').then(r=>r.json()).then(setRooms).catch(()=>setRooms([]))
                            fetch(`/api/plans?ownerProfileId=${v}&all=1`).then(r=>r.json()).then(d=>setPlans(d?.plans||[])).catch(()=>setPlans([]))
                            setClassRooms({})
                          }
                        }}>
                        <option value="">– auswählen –</option>
                        {profileOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <Button
                        size="sm"
                        aria-label="Neues Profil"
                        title="Neues Profil"
                        onClick={() => { setSelectedProfileId('__new__'); setName(''); setTimeout(() => nameInputRef.current?.focus(), 0) }}
                        className="h-9 w-9 p-0 flex items-center justify-center"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      </Button>
                    </div>
                  </FormRow>

                  <FormRow label="Profilname">
                    <InlineInput
                      ref={nameInputRef}
                      className="w-56"
                      value={name}
                      onChange={(e)=>setName(e.target.value)}
                      placeholder={(selectedProfileId === '__new__' || createMode) ? 'Namen angeben' : 'z. B. ZimJ'}
                    />
                  </FormRow>
                </div>
                {/* Klassen (Zuweisung + KL) – in beiden Modi sichtbar */}
                <div ref={classesBlockRef} className="rounded border border-neutral-900 p-3">
                  <div className="text-sm font-medium mb-2">Klassen (Auswahl) und Klassenleitung</div>
                  <div className="grid gap-3">
                    <div>
                      <div className="flex gap-2 items-start">
                        <MultiSelect
                          options={classSuggestions.map(n => ({ value: n, label: n }))}
                          selectedValues={selectedClassNames}
                          onChange={(vals) => {
                            const sel = new Set(vals)
                            setRows(prev => {
                              const copy = [...prev]
                              for (const n of classSuggestions) {
                                const idx = copy.findIndex(r=>r.name===n)
                                if (idx>=0) copy[idx] = { ...copy[idx], assigned: sel.has(n) }
                                else if (sel.has(n)) copy.push({ id: '', name: n, assigned: true, leadProfileId: null })
                              }
                              return copy
                            })
                          }}
                          placeholder="Klassen wählen…"
                          className="w-56"
                        />
                        <Button size="sm" className="h-9" onClick={async ()=>{ const v = prompt('Fehlende Klasse eingeben:','')||''; if (v.trim()) await addClassSuggestion(v.trim()) }}>+ fehlende Klasse</Button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-wide text-fg-muted mb-1">Meine Klassenleitung</label>
                      <select className="w-56 h-9 rounded bg-neutral-900 px-2 text-sm border border-neutral-800"
                        value={leadSelection}
                        onChange={(e)=>{ setLeadSelection(e.target.value); setChanged(true) }}>
                        <option value="">Keine Auswahl…</option>
                        {rows.filter(r=>r.assigned).map(r => (
                          <option key={r.id || `name:${r.name}`} value={r.id || `name:${r.name}`}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Räume (Auswahl & hinzufügen) – in beiden Modi sichtbar */}
                <div className="rounded border border-neutral-900 p-3">
                  <div className="text-sm font-medium mb-2">Räume für ausgewählte Klasse</div>
                  <div className="grid gap-2">
                    <select className="w-56 rounded bg-neutral-900 px-2 text-sm border border-neutral-800 h-9"
                      value={configClassKey}
                      onChange={(e)=>setConfigClassKey(e.target.value)}>
                      {rows.filter(r=>r.assigned).map(r => (
                        <option key={r.id || `name:${r.name}`} value={r.id || `name:${r.name}`}>{r.name}</option>
                      ))}
                    </select>
                    <div className="flex gap-2 items-start">
                      <MultiSelect
                        options={roomOptionValues.map(n => ({ value: n, label: n }))}
                        selectedValues={Array.from(classRooms[configClassKey] || [])}
                        onChange={(vals) => setClassRooms(prev => ({ ...prev, [configClassKey]: new Set(vals) }))}
                        placeholder="Räume wählen…"
                        className="w-56"
                        placement="up"
                      />
                      <Button size="sm" className="h-9" onClick={async ()=>{ const v = prompt('Fehlenden Raum hinzufügen:','')||''; if (v.trim()) await addRoomSuggestion(v.trim()) }}>+ fehlender Raum</Button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between gap-2">
                  {(selectedProfileId || profile?.id) && (
                    <Button size="sm"
                      variant="danger"
                      onClick={async () => {
                        const pid = selectedProfileId || profile?.id!
                        const list = allProfiles
                        const current = list.find(p=>p.id===pid)
                        const confirmName = prompt('Zum Löschen Profilnamen eingeben:')
                        if (!confirmName || confirmName !== (current?.name || '')) return
                        await fetch(`/api/profiles/${pid}`, { method: 'DELETE' })
                        try { window.dispatchEvent(new CustomEvent('data-changed', { detail: { type: 'profile-delete', profileId: pid } })) } catch {}
                        onClose(true)
                      }}
                    >Profil löschen</Button>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={()=>onClose(!!changed)}>Abbrechen</Button>
                    <Button
                      size="sm"
                      variant={justSaved ? 'success' : 'primary'}
                      onClick={saveProfileBasics}
                      disabled={loading || !name.trim()}
                    >
                      {loading ? 'Speichern…' : (justSaved ? 'Gespeichert' : 'Speichern')}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {section === 'data' && (
              <div className="grid gap-3">
                  <div className="grid gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-fg-muted">Klasse:</span>
                      <select className="rounded bg-neutral-900 px-2 py-1 border border-neutral-800" value={studentClassId} onChange={(e)=>setStudentClassId(e.target.value)}>
                        <option value="">Wählen…</option>
                        {rows.filter(r=>r.assigned).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </div>
                    {studentClassId && (
                      <div className="grid gap-2">
                        <FormRow
                          label="Neuer Schüler"
                          actions={<Button size="sm" className="h-9" onClick={addStudent} disabled={!newStudentName.trim()}>Anlegen</Button>}
                        >
                          <InlineInput value={newStudentName} onChange={(e)=>setNewStudentName(e.target.value)} placeholder="Vorname" />
                        </FormRow>
                        <div className="rounded border border-neutral-900 max-h-[40vh] overflow-auto">
                          <table className="w-full text-sm">
                            <tbody>
                              {students.map(s => (
                                <tr key={s.id} className="border-b border-neutral-900">
                                  <td className="px-3 py-2 w-full">
                                    <input className="w-full rounded bg-neutral-950 border border-neutral-800 px-2 py-1 text-sm" value={s.foreName}
                                      onChange={(e)=>setStudents(prev=>prev.map(x=>x.id===s.id?{...x, foreName:e.target.value}:x))}
                                    />
                                  </td>
                                  <td className="px-2 py-2 whitespace-nowrap">
                                    <Button size="sm" onClick={()=>{ const v = (students.find(x=>x.id===s.id)?.foreName || '').trim(); if (v) renameStudent(s.id, v) }}>Speichern</Button>
                                  </td>
                                  <td className="px-2 py-2"><Button size="sm" variant="danger" onClick={()=>deleteStudent(s.id)}>Löschen</Button></td>
                                </tr>
                              ))}
                              {students.length===0 && <tr><td className="px-3 py-6 text-xs text-fg-muted">Keine Schüler.</td></tr>}
                            </tbody>
                          </table>
                        </div>
                        <div className="rounded border border-neutral-900 p-3">
                          <div className="mb-2 text-sm font-medium">Schüler importieren (XLSX/CSV)</div>
                          <ImportStudents onComplete={async () => {
                            // Nach erfolgreichem Import Schülerliste sofort aktualisieren
                            if (!studentClassId) return
                            try {
                              const res = await fetch(`/api/students?classId=${studentClassId}`)
                              if (res.ok) setStudents(await res.json())
                            } catch {}
                            // Globale Aktualisierung signalisieren (z. B. für TopBar)
                            try { window.dispatchEvent(new CustomEvent('data-changed', { detail: { type: 'students-import' } })) } catch {}
                          }} />
                        </div>
                      </div>
                    )}
                  </div>
              </div>
            )}

            {section === 'plans' && (
              <div className="grid gap-3">
                <div className="text-sm text-fg-muted">Benannte (nicht-Standard) Pläne für dieses Profil</div>
                <div className="rounded border border-neutral-900 max-h-[52vh] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-900/50"><tr><th className="px-3 py-2 text-left">Plan</th><th className="px-3 py-2 text-left">Klasse</th><th className="px-3 py-2 text-left">Raum</th><th className="px-3 py-2"></th></tr></thead>
                    <tbody>
                      {plans.map(p => (
                        <tr key={p.id} className="border-t border-neutral-900">
                          <td className="px-3 py-2">{p.title || 'Plan'}</td>
                          <td className="px-3 py-2">{p.class?.name || '–'}</td>
                          <td className="px-3 py-2">{p.room?.name || '–'}</td>
                          <td className="px-3 py-2 flex gap-2 justify-end">
                            <Button onClick={()=>renamePlan(p.id)}>Umbenennen</Button>
                            <Button variant="danger" onClick={()=>deletePlan(p.id)}>Löschen</Button>
                          </td>
                        </tr>
                      ))}
                      {plans.length===0 && <tr><td className="px-3 py-6 text-xs text-fg-muted" colSpan={4}>Keine benannten Pläne vorhanden.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {section === 'admin' && (
              <div className="grid gap-3">
                <div className="rounded border border-red-900 bg-red-950/20 p-3">
                  <div className="text-sm font-medium text-red-300 mb-1">Alle Daten löschen</div>
                  <div className="text-sm text-red-200 mb-2">Dieser Vorgang löscht unwiderruflich ALLE Daten: Profile, Klassen, Räume, Schüler, Pläne und Elemente.</div>
                  <div className="grid gap-2">
                    <label className="text-xs text-fg-muted">Zur Bestätigung tippe: LÖSCHEN</label>
                    <input className="w-56 rounded bg-neutral-950 border border-neutral-800 px-2 py-1 text-sm" value={adminConfirm} onChange={(e)=>setAdminConfirm(e.target.value)} placeholder="LÖSCHEN" />
                    <div className="flex gap-2">
                      <Button
                        variant="danger"
                        disabled={adminConfirm !== 'LÖSCHEN' || adminDeleting}
                        onClick={async () => {
                          if (adminConfirm !== 'LÖSCHEN') return
                          setAdminDeleting(true)
                          try {
                            const res = await fetch('/api/admin/reset', { method: 'POST' })
                            if (!res.ok) throw new Error('reset failed')
                            // Clear selection in URL and broadcast change (no browser storage)
                            try {
                              const url = new URL(window.location.href)
                              url.searchParams.delete('p'); url.searchParams.delete('c'); url.searchParams.delete('r'); url.searchParams.delete('pl')
                              window.history.replaceState({}, '', url.toString())
                              const sel = JSON.stringify({ p: undefined, c: undefined, r: undefined, pl: undefined })
                              window.dispatchEvent(new StorageEvent('storage', { key: 'selection', newValue: sel }))
                              window.dispatchEvent(new CustomEvent('data-changed', { detail: { type: 'reset' } }))
                            } catch {}
                            onClose(true)
                            setTimeout(() => window.location.reload(), 50)
                          } catch {
                            setAdminDeleting(false)
                          }
                        }}
                      >
                        {adminDeleting ? 'Lösche…' : 'Wirklich ALLES löschen'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {section === 'admin' && !createMode && (
              <div className="grid gap-3">
                <div className="text-sm text-fg-muted">Unumkehrbare Aktionen</div>
                <div className="rounded border border-neutral-900 p-3">
                  <div className="mb-2">Profil auswählen, dann mit Namensbestätigung löschen:</div>
                  <FormRow label="Profil wählen">
                    <select
                      className="w-56 h-9 rounded bg-neutral-900 px-2 text-sm border border-neutral-800"
                      value={selectedProfileId || ''}
                      onChange={(e)=>setSelectedProfileId(e.target.value)}
                    >
                      <option value="">Wählen…</option>
                      {allProfiles.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <Button className="h-9"
                      variant="danger"
                      disabled={!selectedProfileId}
                      onClick={async () => {
                        const pid = selectedProfileId || ''
                        if (!pid) return
                        const current = allProfiles.find(p => p.id === pid)
                        const confirmName = prompt('Zum Löschen bitte Profilnamen eingeben:')
                        if (!confirmName || confirmName !== (current?.name || '')) return
                        await fetch(`/api/profiles/${pid}`, { method: 'DELETE' })
                        try { window.dispatchEvent(new CustomEvent('data-changed', { detail: { type: 'profile-delete', profileId: pid } })) } catch {}
                        onClose(true)
                      }}
                    >Profil löschen</Button>
                  </FormRow>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </Modal>
  )
}
