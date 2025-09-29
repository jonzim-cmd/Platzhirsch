"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Moveable from 'react-moveable'
import { Button } from '@/components/ui/Button'

type ElementType = 'STUDENT' | 'TEACHER_DESK' | 'DOOR' | 'WINDOW_SIDE' | 'WALL_SIDE'

type Element = {
  id?: string
  type: ElementType
  refId?: string | null
  x: number
  y: number
  w: number
  h: number
  rotation: number
  z: number
  groupId?: string | null
  meta?: any
}

type Plan = {
  id: string
  classId: string
  roomId: string
  elements: Element[]
}

function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}

function intersects(a: Element, b: Element) {
  // AABB approximation, ignoring rotation for snapping/grouping logic
  const ar = { left: a.x, top: a.y, right: a.x + a.w, bottom: a.y + a.h }
  const br = { left: b.x, top: b.y, right: b.x + b.w, bottom: b.y + b.h }
  return !(ar.right < br.left || ar.left > br.right || ar.bottom < br.top || ar.top > br.bottom)
}

export function Editor({ classes, rooms }: { classes: { id: string; name: string }[]; rooms: { id: string; name: string; type: string }[] }) {
  const [activeProfile, setActiveProfile] = useState<{ id: string; name: string } | null>(null)
  const [classId, setClassId] = useState('')
  const [roomId, setRoomId] = useState('')
  const [plan, setPlan] = useState<Plan | null>(null)
  const [leadPlan, setLeadPlan] = useState<Plan | null>(null)
  const [viewMode, setViewMode] = useState<'owner' | 'lead'>('owner')
  const [elements, setElements] = useState<Element[]>([])
  const [students, setStudents] = useState<{ id: string; foreName: string }[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const saveTimer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem('activeProfile')
        setActiveProfile(raw ? JSON.parse(raw) : null)
        const url = new URL(window.location.href)
        const c = url.searchParams.get('c')
        const r = url.searchParams.get('r')
        if (c) setClassId(c)
        if (r) setRoomId(r)
      } catch { setActiveProfile(null) }
    }
    read()
    const h = () => read()
    window.addEventListener('storage', h)
    return () => window.removeEventListener('storage', h)
  }, [])

  // Load students when class changes
  useEffect(() => {
    if (!classId) { setStudents([]); return }
    fetch(`/api/students?classId=${classId}`).then(r => r.json()).then((data) => {
      if (Array.isArray(data)) setStudents(data)
    }).catch(() => setStudents([]))
  }, [classId])

  const loadPlan = useCallback(async (create: boolean) => {
    if (!activeProfile?.id || !classId || !roomId) return
    const res = await fetch(`/api/plan?ownerProfileId=${activeProfile.id}&classId=${classId}&roomId=${roomId}&create=${create ? '1' : '0'}&includeLead=1`)
    if (!res.ok) return
    const data = await res.json()
    setPlan(data.plan)
    setLeadPlan(data.leadPlan)
    setElements(data.plan.elements.map((e: any) => ({ ...e })))
    setSelectedId(null)
  }, [activeProfile?.id, classId, roomId])

  const scheduleSave = useCallback(() => {
    if (!plan) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaving('saving')
    saveTimer.current = setTimeout(async () => {
      try {
        await fetch('/api/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId: plan.id, elements }),
        })
        setSaving('saved')
        setTimeout(() => setSaving('idle'), 1200)
      } catch {
        setSaving('idle')
      }
    }, 900)
  }, [plan, elements])

  const selected = useMemo(() => elements.find(e => e.id === selectedId), [elements, selectedId])

  const readOnly = viewMode === 'lead'

  // Group handling: move whole group
  const moveElementBy = (id: string, dx: number, dy: number) => {
    if (readOnly) return
    setElements(prev => {
      const el = prev.find(e => e.id === id)
      if (!el) return prev
      const group = el.groupId ? prev.filter(e => e.groupId === el.groupId) : [el]
      const ids = new Set(group.map(g => g.id))
      return prev.map(e => ids.has(e.id!) ? { ...e, x: e.x + dx, y: e.y + dy } : e)
    })
  }

  const onDragEnd = (id: string) => {
    // Heften: if any element intersects, share groupId
    if (readOnly) return
    setElements(prev => {
      const current = prev.find(e => e.id === id)
      if (!current) return prev
      let groupId = current.groupId || null
      for (const other of prev) {
        if (other.id === id) continue
        if (intersects(current, other)) {
          groupId = groupId || other.groupId || uid('grp')
          break
        }
      }
      // Assign groupId to all intersecting at end
      if (groupId) {
        return prev.map(e => {
          if (e.id === id) return { ...e, groupId }
          if (intersects(current, e)) return { ...e, groupId }
          return e
        })
      }
      // If moved away and not intersecting anyone, detach
      return prev.map(e => e.id === id ? { ...e, groupId: null } : e)
    })
    scheduleSave()
  }

  const addElement = (type: ElementType, refId?: string) => {
    if (readOnly) return
    const base: Element = { id: uid('el'), type, refId: refId ?? null, x: 120, y: 120, w: 80, h: 50, rotation: 0, z: elements.length, groupId: null }
    if (type === 'WINDOW_SIDE' || type === 'WALL_SIDE') { base.w = 240; base.h = 8 }
    if (type === 'DOOR') { base.w = 36; base.h = 8 }
    if (type === 'TEACHER_DESK') { base.w = 200; base.h = 60 }
    setElements(prev => [...prev, base])
    scheduleSave()
  }

  const removeSelected = () => {
    if (readOnly || !selectedId) return
    setElements(prev => prev.filter(e => e.id !== selectedId))
    setSelectedId(null)
    scheduleSave()
  }

  const [frameSize, setFrameSize] = useState({ w: 1200, h: 700 })
  const frameRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const obs = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      setFrameSize({ w: Math.max(600, r.width), h: Math.max(400, r.height) })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Export helpers
  const canvasRef = useRef<HTMLDivElement>(null)
  async function exportPng() {
    if (!canvasRef.current) return
    const { toPng } = await import('html-to-image')
    const dataUrl = await toPng(canvasRef.current, { cacheBust: true, pixelRatio: 2 })
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `sitzplan-${classId}-${roomId}.png`
    a.click()
  }
  async function exportPdf() {
    if (!canvasRef.current) return
    const [{ toPng }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')])
    const dataUrl = await toPng(canvasRef.current, { cacheBust: true, pixelRatio: 2 })
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const img = new Image()
    img.src = dataUrl
    await new Promise((res) => { img.onload = res })
    const ratio = Math.min(pageW / img.width, pageH / img.height)
    const w = img.width * ratio
    const h = img.height * ratio
    const x = (pageW - w) / 2
    const y = (pageH - h) / 2
    pdf.addImage(dataUrl, 'PNG', x, y, w, h)
    pdf.save(`sitzplan-${classId}-${roomId}.pdf`)
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <div className="lg:col-span-5 min-h-[60vh] rounded border border-neutral-900 bg-neutral-950/40 relative">
        {/* Floating toolbar: plan load and view toggle */}
        <div className="pointer-events-auto absolute right-3 top-3 z-10 flex items-center gap-2 text-xs">
          <Button onClick={() => loadPlan(true)} variant="primary" disabled={!activeProfile || !classId || !roomId}>Plan laden/erstellen</Button>
          {leadPlan && (
            <div className="ml-2 flex items-center gap-2">
              <span className="text-fg-muted">Ansicht:</span>
              <Button onClick={() => setViewMode('owner')} className={viewMode==='owner'?'bg-primary/20 text-primary':''}>Eigen</Button>
              <Button onClick={() => setViewMode('lead')} className={viewMode==='lead'?'bg-primary/20 text-primary':''}>KL</Button>
            </div>
          )}
          <div className="text-fg-muted">
            {saving === 'saving' && <span className="ml-3">Speichern…</span>}
            {saving === 'saved' && <span className="ml-3 text-primary">Gespeichert</span>}
          </div>
        </div>

        <div ref={frameRef} className="relative h-[70vh] w-full overflow-auto">
          <div ref={canvasRef} className="relative" style={{ width: frameSize.w, height: frameSize.h }}>
            {(viewMode==='owner' ? elements : (leadPlan?.elements || [])).map(el => (
              <div
                key={el.id}
                role="button"
                onClick={() => !readOnly && setSelectedId(el.id!)}
                className={`absolute select-none ${selectedId === el.id ? 'ring-2 ring-primary/60' : ''}`}
                data-el={el.id}
                style={{ left: el.x, top: el.y, width: el.w, height: el.h, transform: `rotate(${el.rotation}deg)`, zIndex: el.z }}
              >
                <div className="h-full w-full rounded border border-neutral-700 bg-neutral-800/60 flex items-center justify-center text-xs">
                  {el.type === 'STUDENT' && <span>Schüler{el.refId ? '' : ' (leer)'}</span>}
                  {el.type === 'TEACHER_DESK' && <span>Lehrerpult</span>}
                  {el.type === 'DOOR' && <span>Tür</span>}
                  {el.type === 'WINDOW_SIDE' && <span>Fensterseite</span>}
                  {el.type === 'WALL_SIDE' && <span>Wandseite</span>}
                </div>
                {!readOnly && selectedId === el.id && (
                  <Moveable
                    target={() => document.querySelector(`[data-el='${el.id}']`) as HTMLElement}
                    // Fallback target: current parent
                    draggable
                    resizable
                    rotatable
                    throttleDrag={0}
                    throttleResize={0}
                    throttleRotate={0}
                    snappable
                    snapThreshold={10}
                    elementGuidelines={[]}
                    bounds={{ left: 0, top: 0, right: frameSize.w, bottom: frameSize.h }}
                    onDrag={(e) => {
                      const dx = e.beforeDelta[0]
                      const dy = e.beforeDelta[1]
                      moveElementBy(el.id!, dx, dy)
                    }}
                    onDragEnd={() => onDragEnd(el.id!)}
                    onResize={(e) => {
                      setElements(prev => prev.map(x => x.id === el.id ? { ...x, w: Math.max(10, e.width), h: Math.max(10, e.height), x: x.x + e.delta[0], y: x.y + e.delta[1] } : x))
                    }}
                    onResizeEnd={() => scheduleSave()}
                    onRotate={(e) => {
                      setElements(prev => prev.map(x => x.id === el.id ? { ...x, rotation: e.beforeRotate } : x))
                    }}
                    onRotateEnd={() => scheduleSave()}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Collapsible Sidebar */}
      <aside className={`fixed left-0 top-[48px] z-20 h-[calc(100vh-48px)] w-72 transform border-r border-neutral-900 bg-bg-soft p-3 transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {leadPlan && viewMode==='lead' && (
          <div className="rounded border border-neutral-900 p-3 grid gap-2">
            <div className="text-sm font-medium">KL-Plan</div>
            <div className="text-xs text-fg-muted">Du kannst den Plan der Klassenleitung ansehen. Änderungen sind hier nicht möglich.</div>
            {activeProfile && (
              <Button
                variant="primary"
                onClick={async () => {
                  await fetch('/api/plan/copy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ownerProfileId: activeProfile.id, classId, roomId, sourcePlanId: leadPlan!.id }) })
                  setViewMode('owner')
                  await loadPlan(false)
                }}
              >Als Kopie übernehmen</Button>
            )}
          </div>
        )}
        <div className="rounded border border-neutral-900 p-3">
          <div className="text-sm font-medium mb-2">Palette</div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => addElement('TEACHER_DESK')}>Lehrerpult</Button>
            <Button onClick={() => addElement('DOOR')}>Tür</Button>
            <Button onClick={() => addElement('WINDOW_SIDE')}>Fensterseite</Button>
            <Button onClick={() => addElement('WALL_SIDE')}>Wandseite</Button>
          </div>
        </div>
        <div className="rounded border border-neutral-900 p-3">
          <div className="text-sm font-medium mb-2">Schüler hinzufügen</div>
          <div className="grid gap-2 max-h-[260px] overflow-auto">
            {students.map(s => (
              <Button key={s.id} onClick={() => addElement('STUDENT', s.id)} className="justify-start">{s.foreName}</Button>
            ))}
            {students.length === 0 && <div className="text-xs text-fg-muted">Keine Schüler geladen.</div>}
          </div>
        </div>
        <div className="rounded border border-neutral-900 p-3 grid gap-2">
          <div className="text-sm font-medium">Auswahl</div>
          {!selected && <div className="text-xs text-fg-muted">Nichts ausgewählt</div>}
          {selected && (
            <>
              <div className="text-xs text-fg-muted">Typ: {selected.type}</div>
              <div className="flex gap-2">
                <Button onClick={removeSelected} variant="danger">Löschen</Button>
              </div>
            </>
          )}
        </div>
        <div className="rounded border border-neutral-900 p-3 grid gap-2">
          <div className="text-sm font-medium">Export</div>
          <div className="flex gap-2">
            <Button onClick={exportPng}>PNG</Button>
            <Button onClick={exportPdf}>PDF (A4 Quer)</Button>
          </div>
        </div>
      </aside>
      {/* Toggle button */}
      <button aria-label="Werkzeuge" onClick={()=>setSidebarOpen(s=>!s)} className="fixed left-2 top-[56px] z-30 rounded bg-neutral-800 px-2 py-1 text-sm hover:bg-neutral-700">{sidebarOpen ? '⟨ schließen' : 'Werkzeuge ⟩'}</button>
    </div>
  )
}
