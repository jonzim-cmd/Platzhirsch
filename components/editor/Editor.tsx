"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Moveable from 'react-moveable'
import { Button } from '@/components/ui/Button'
import { JointOverlay } from '@/components/editor/JointOverlay'
import { computeEdgeJointRect } from '@/components/editor/geometry'
import type { Side } from '@/components/editor/geometry'
import { Z } from '@/components/ui/zIndex'
import { Portal } from '@/components/ui/Portal'
import { EditorView } from '@/components/editor/EditorView'
// Quick layout simplified: inline generator for tight pairs

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

function overlapAmount(a1: number, a2: number, b1: number, b2: number) {
  const left = Math.max(a1, b1)
  const right = Math.min(a2, b2)
  return Math.max(0, right - left)
}

function touchesOrIntersects(a: Element, b: Element, tol = 0.5) {
  // True if overlapping or edges touch within tolerance
  const vOverlap = overlapAmount(a.y, a.y + a.h, b.y, b.y + b.h)
  const hOverlap = overlapAmount(a.x, a.x + a.w, b.x, b.x + b.w)
  if (vOverlap > 0 && Math.abs((a.x + a.w) - b.x) <= tol) return true // a right to b left
  if (vOverlap > 0 && Math.abs(a.x - (b.x + b.w)) <= tol) return true // a left to b right
  if (hOverlap > 0 && Math.abs((a.y + a.h) - b.y) <= tol) return true // a bottom to b top
  if (hOverlap > 0 && Math.abs(a.y - (b.y + b.h)) <= tol) return true // a top to b bottom
  return intersects(a, b)
}

function snapDeltaToNearest(a: Element, others: Element[], threshold = 8) {
  let best: { dx: number; dy: number } | null = null
  for (const b of others) {
    // vertical overlap for horizontal snapping
    const vOverlap = overlapAmount(a.y, a.y + a.h, b.y, b.y + b.h)
    if (vOverlap > 0) {
      // align left-left
      const d1 = b.x - a.x
      if (Math.abs(d1) <= threshold) best = (!best || Math.abs(d1) < Math.hypot(best.dx, best.dy)) ? { dx: d1, dy: 0 } : best
      // align right-right
      const d2 = (b.x + b.w) - (a.x + a.w)
      if (Math.abs(d2) <= threshold) best = (!best || Math.abs(d2) < Math.hypot(best.dx, best.dy)) ? { dx: d2, dy: 0 } : best
      // align right of a to left of b (touching)
      const d3 = b.x - (a.x + a.w)
      if (Math.abs(d3) <= threshold) best = (!best || Math.abs(d3) < Math.hypot(best.dx, best.dy)) ? { dx: d3, dy: 0 } : best
      // align left of a to right of b
      const d4 = (b.x + b.w) - a.x
      if (Math.abs(d4) <= threshold) best = (!best || Math.abs(d4) < Math.hypot(best.dx, best.dy)) ? { dx: d4, dy: 0 } : best
    }
    // horizontal overlap for vertical snapping
    const hOverlap = overlapAmount(a.x, a.x + a.w, b.x, b.x + b.w)
    if (hOverlap > 0) {
      // align top-top
      const d5 = b.y - a.y
      if (Math.abs(d5) <= threshold) best = (!best || Math.abs(d5) < Math.hypot(best.dx, best.dy)) ? { dx: 0, dy: d5 } : best
      // align bottom-bottom
      const d6 = (b.y + b.h) - (a.y + a.h)
      if (Math.abs(d6) <= threshold) best = (!best || Math.abs(d6) < Math.hypot(best.dx, best.dy)) ? { dx: 0, dy: d6 } : best
      // align bottom of a to top of b
      const d7 = b.y - (a.y + a.h)
      if (Math.abs(d7) <= threshold) best = (!best || Math.abs(d7) < Math.hypot(best.dx, best.dy)) ? { dx: 0, dy: d7 } : best
      // align top of a to bottom of b
      const d8 = (b.y + b.h) - a.y
      if (Math.abs(d8) <= threshold) best = (!best || Math.abs(d8) < Math.hypot(best.dx, best.dy)) ? { dx: 0, dy: d8 } : best
    }
  }
  return best
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
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const elementRefs = useRef<Map<string, HTMLElement>>(new Map())
  const saveTimer = useRef<NodeJS.Timeout | null>(null)
  const [clipboard, setClipboard] = useState<Element | null>(null)
  const [typeStyles, setTypeStyles] = useState<Record<ElementType, { fontSize: number }>>({
    STUDENT: { fontSize: 20 },
    TEACHER_DESK: { fontSize: 20 },
    DOOR: { fontSize: 20 },
    WINDOW_SIDE: { fontSize: 20 },
    WALL_SIDE: { fontSize: 20 },
  })
  const [marquee, setMarquee] = useState<{ active: boolean; x0: number; y0: number; x1: number; y1: number }>({ active: false, x0: 0, y0: 0, x1: 0, y1: 0 })
  const [editing, setEditing] = useState<{ id: string | null; value: string }>({ id: null, value: '' })
  const [pickerOpenId, setPickerOpenId] = useState<string | null>(null)
  const [pickerQuery, setPickerQuery] = useState<string>("")
  const detachOnDragRef = useRef(false)
  const dragStartPositions = useRef<Map<string, { x: number; y: number }>>(new Map())
  const dragTriedSwap = useRef(false)
  // no modal/state needed for simplified quick layout

  const applyPairsLayout = () => {
    if (readOnly) return
    // constants for simple, tight pairs
    const seatW = 120
    const seatH = 70
    const marginX = 40
    const marginY = 60
    const betweenPairsX = 24 // small aisle between pairs
    const betweenRowsY = 24

    const n = students.length
    if (n === 0) return

    const pairWidth = seatW * 2 // tight: no gap inside pair
    const availW = Math.max(0, frameSize.w - marginX * 2)
    const perRow = Math.max(1, Math.floor((availW + betweenPairsX) / (pairWidth + betweenPairsX)))
    const pairCount = Math.ceil(n / 2)
    const rows = Math.ceil(pairCount / perRow)

    const newSeats: Element[] = []
    let pairIndex = 0
    for (let r = 0; r < rows; r++) {
      let x = marginX
      const y = marginY + r * (seatH + betweenRowsY)
      for (let c = 0; c < perRow; c++) {
        if (pairIndex >= pairCount) break
        const leftSeat: Element = { id: uid('el'), type: 'STUDENT', refId: null, x, y, w: seatW, h: seatH, rotation: 0, z: newSeats.length, groupId: null, meta: { fontSize: typeStyles['STUDENT'].fontSize } }
        const rightSeat: Element = { id: uid('el'), type: 'STUDENT', refId: null, x: x + seatW, y, w: seatW, h: seatH, rotation: 0, z: newSeats.length + 1, groupId: null, meta: { fontSize: typeStyles['STUDENT'].fontSize } }
        // joints left.right <-> right.left at mid, mark as pair with shared pairId
        const add = (arr: any[]|undefined, item:any)=>Array.isArray(arr)?[...arr,item]:[item]
        const pairId = uid('pair')
        leftSeat.meta = { ...(leftSeat.meta||{}), joints: add(leftSeat.meta?.joints, { otherId: rightSeat.id, side: 'right', t: 0.5, kind: 'pair', pairId }) }
        rightSeat.meta = { ...(rightSeat.meta||{}), joints: add(rightSeat.meta?.joints, { otherId: leftSeat.id, side: 'left', t: 0.5, kind: 'pair', pairId }) }

        newSeats.push(leftSeat, rightSeat)
        pairIndex++
        x += pairWidth + betweenPairsX
      }
    }

    // assign all students sequentially (use all)
    const assignedSeats = newSeats.map((e, i) => i < n ? { ...e, refId: students[i].id } : e)

    // replace existing student elements; keep others
    setElements(prev => {
      const kept = prev.filter(e => e.type !== 'STUDENT')
      return [...kept, ...assignedSeats]
    })
    scheduleSave()
  }

  function addJoint(aId: string, bId: string, aSide: Side, bSide: Side, aT: number, bT: number) {
    setElements(prev => {
      // determine joint kind/pairId once
      const aEl = prev.find(e => e.id === aId)
      const bEl = prev.find(e => e.id === bId)
      const isStudentPair = aEl?.type === 'STUDENT' && bEl?.type === 'STUDENT' && (
        (aSide === 'left' && bSide === 'right') ||
        (aSide === 'right' && bSide === 'left') ||
        (aSide === 'top' && bSide === 'bottom') ||
        (aSide === 'bottom' && bSide === 'top')
      )
      const computedKind = isStudentPair ? 'pair' : 'struct'
      const computedPairId = isStudentPair ? uid('pair') : undefined
      return prev.map(el => {
        if (el.id === aId) {
          const links = Array.isArray(el.meta?.joints) ? el.meta!.joints : []
          const exists = links.some((l: any) => l.otherId === bId)
          const next = exists
            ? links.map((l: any) => l.otherId === bId
              ? { otherId: bId, side: aSide, t: aT, kind: l.kind ?? computedKind, pairId: l.pairId ?? computedPairId }
              : l)
            : [...links, { otherId: bId, side: aSide, t: aT, kind: computedKind, pairId: computedPairId }]
          return { ...el, meta: { ...(el.meta || {}), joints: next } }
        }
        if (el.id === bId) {
          const links = Array.isArray(el.meta?.joints) ? el.meta!.joints : []
          const exists = links.some((l: any) => l.otherId === aId)
          const next = exists
            ? links.map((l: any) => l.otherId === aId
              ? { otherId: aId, side: bSide, t: bT, kind: l.kind ?? computedKind, pairId: l.pairId ?? computedPairId }
              : l)
            : [...links, { otherId: aId, side: bSide, t: bT, kind: computedKind, pairId: computedPairId }]
          return { ...el, meta: { ...(el.meta || {}), joints: next } }
        }
        return el
      })
    })
  }

  function removeJoint(aId: string, bId: string) {
    setElements(prev => prev.map(el => {
      if (el.id === aId) {
        const links = Array.isArray(el.meta?.joints) ? el.meta.joints : []
        const next = links.filter((l: any) => l.otherId !== bId)
        return { ...el, meta: { ...(el.meta || {}), joints: next } }
      }
      if (el.id === bId) {
        const links = Array.isArray(el.meta?.joints) ? el.meta.joints : []
        const next = links.filter((l: any) => l.otherId !== aId)
        return { ...el, meta: { ...(el.meta || {}), joints: next } }
      }
      return el
    }))
  }

  const defaultTerms: Record<Exclude<ElementType, 'STUDENT'>, string> = {
    TEACHER_DESK: 'Lehrerpult',
    DOOR: 'Tür',
    WINDOW_SIDE: 'Fensterseite',
    WALL_SIDE: 'Wandseite',
  }

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
    const onSidebar = (e: StorageEvent) => {
      if (e.key === 'sidebar' && e.newValue) {
        try { const v = JSON.parse(e.newValue); setSidebarOpen(!!v.open) } catch{}
      }
    }
    window.addEventListener('storage', onSidebar)
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
    // Convert legacy groupId relations to explicit joints on load
    const rawEls: Element[] = data.plan.elements.map((e: any) => ({ ...e }))
    const convertGroupsToJoints = (els: Element[]) => {
      const byId = new Map<string, Element>()
      const joints = new Map<string, Array<{ otherId: string; side: any; t: number; kind?: string; pairId?: string }>>()
      for (const el of els) {
        byId.set(el.id!, el)
        const existing: any[] = Array.isArray(el.meta?.joints) ? el.meta!.joints : []
        joints.set(
          el.id!,
          existing.map((j: any) => ({
            otherId: String(j.otherId),
            side: j.side,
            t: Number(j.t) || 0,
            kind: j.kind ?? undefined,
            pairId: j.pairId ?? undefined,
          }))
        )
      }
      const groups = new Map<string, Element[]>()
      for (const el of els) {
        if (el.groupId) {
          if (!groups.has(el.groupId)) groups.set(el.groupId, [])
          groups.get(el.groupId)!.push(el)
        }
      }
      for (const [, members] of groups) {
        // connect pairs that touch/intersect
        for (let i = 0; i < members.length; i++) {
          for (let j = i + 1; j < members.length; j++) {
            const a = members[i], b = members[j]
            if (!touchesOrIntersects(a, b)) continue
            const joint = computeEdgeJointRect({ x: a.x, y: a.y, w: a.w, h: a.h }, { x: b.x, y: b.y, w: b.w, h: b.h })
            if (!joint) continue
            const la = joints.get(a.id!)!
            const lb = joints.get(b.id!)!
            // default to struct; pair-kind will be derived in a second pass below
            if (!la.some(x => x.otherId === b.id)) la.push({ otherId: b.id!, side: joint.aSide, t: joint.aT, kind: 'struct' })
            if (!lb.some(x => x.otherId === a.id)) lb.push({ otherId: a.id!, side: joint.bSide, t: joint.bT, kind: 'struct' })
          }
        }
      }
      // derive pair-kind for exactly one STUDENT↔STUDENT adjacency per seat
      const markPairs = () => {
        // map pairId assignments to ensure both directions share the same id
        for (const el of els) {
          if (el.type !== 'STUDENT') continue
          const list = joints.get(el.id!) || []
          // find student neighbors
          const candidates = list.filter(j => {
            const other = byId.get(j.otherId)
            return other?.type === 'STUDENT'
          })
          if (candidates.length !== 1) continue
          const j = candidates[0]
          // ensure opposite side exists on the other
          const other = byId.get(j.otherId)!
          const otherList = joints.get(other.id!) || []
          const back = otherList.find(x => x.otherId === el.id!)
          if (!back) continue
          // set kind and pairId if missing
          const pid = j.pairId ?? back.pairId ?? uid('pair')
          j.kind = 'pair'; j.pairId = pid
          back.kind = 'pair'; back.pairId = pid
        }
      }
      markPairs()
      // produce new elements with joints and without groupId
      return els.map(el => ({
        ...el,
        groupId: null,
        meta: { ...(el.meta || {}), joints: joints.get(el.id!) }
      }))
    }
    const converted = convertGroupsToJoints(rawEls)
    setElements(converted)
    setSelectedIds([])
    // persist conversion
    setTimeout(() => scheduleSave(), 0)
  }, [activeProfile?.id, classId, roomId])

  // Auto-load or create plan when filters are selected (after loadPlan is defined)
  useEffect(() => {
    if (activeProfile?.id && classId && roomId) {
      loadPlan(true)
    }
  }, [activeProfile?.id, classId, roomId, loadPlan])

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

  const primarySelectedId = selectedIds[0] ?? null
  const selected = useMemo(() => (primarySelectedId ? elements.find(e => e.id === primarySelectedId) : undefined), [elements, primarySelectedId])
  const selectedTarget = useMemo(() => (primarySelectedId ? elementRefs.current.get(primarySelectedId) ?? null : null), [primarySelectedId, elements])
  const studentById = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of students) m.set(s.id, s.foreName)
    return m
  }, [students])

  const readOnly = viewMode === 'lead'
  const usedStudentIds = useMemo(() => {
    const set = new Set<string>()
    for (const e of elements) if (e.type === 'STUDENT' && e.refId) set.add(String(e.refId))
    return set
  }, [elements])

  // Group handling: move whole group (union der Gruppen aller aktuell ausgewählten Elemente, oder der Gruppe des aktiven Elements)
  const moveElementBy = (id: string, dx: number, dy: number) => {
    if (readOnly) return
    setElements(prev => {
      const el = prev.find(e => e.id === id)
      if (!el) return prev
      // BFS über Joints – starte von allen selektierten, wenn id enthalten ist, sonst nur von id
      const byId = new Map(prev.map(e => [e.id!, e]))
      const seed = selectedIds.includes(id) ? selectedIds.slice() : [id]
      const toVisit: string[] = [...seed]
      const visited = new Set<string>()
      while (toVisit.length) {
        const cur = toVisit.pop()!
        if (visited.has(cur)) continue
        visited.add(cur)
        const node = byId.get(cur)
        const links = Array.isArray(node?.meta?.joints) ? node!.meta!.joints as any[] : []
        for (const l of links) {
          if (!visited.has(l.otherId)) toVisit.push(l.otherId)
        }
      }
      return prev.map(e => visited.has(e.id!) ? { ...e, x: e.x + dx, y: e.y + dy } : e)
    })
  }

  const onDragEnd = (id: string, opts?: { detach?: boolean }) => {
    // Heften: if any element intersects, share groupId
    if (readOnly) return
    const srcEl = elements.find(e => e.id === id)
    // helper: get entire connected group ids
    const getGroupIds = (startIds: string[]): string[] => {
      const byId = new Map(elements.map(e => [e.id!, e]))
      const toVisit = [...startIds]
      const visited = new Set<string>()
      while (toVisit.length) {
        const cur = toVisit.pop()!
        if (visited.has(cur)) continue
        visited.add(cur)
        const node = byId.get(cur)
        const links = Array.isArray(node?.meta?.joints) ? node!.meta!.joints as any[] : []
        for (const l of links) if (!visited.has(l.otherId)) toVisit.push(l.otherId)
      }
      return Array.from(visited)
    }
    // pointer coords in canvas space
    const pointer = (() => {
      let px = srcEl?.x ?? 0
      let py = srcEl?.y ?? 0
      if (srcEl) { px = srcEl.x + srcEl.w / 2; py = srcEl.y + srcEl.h / 2 }
      try {
        // @ts-ignore
        const ie = (window as any).__lastMoveableEvent || null
        if (ie?.clientX && canvasRef.current) {
          const rect = canvasRef.current.getBoundingClientRect()
          px = ie.clientX - rect.left
          py = ie.clientY - rect.top
        }
      } catch {}
      return { px, py }
    })()

    // 1) Swap für WINDOW_SIDE <-> WALL_SIDE (Geometrie-Swap)
    if (srcEl && (srcEl.type === 'WINDOW_SIDE' || srcEl.type === 'WALL_SIDE')) {
      const isPointIn = (e: Element, x: number, y: number) => x >= e.x && x <= e.x + e.w && y >= e.y && y <= e.y + e.h
      const candidates = elements.filter(e => e.id !== srcEl.id && (e.type === 'WINDOW_SIDE' || e.type === 'WALL_SIDE') && e.type !== srcEl.type)
      const target = candidates.find(e => isPointIn(e, pointer.px, pointer.py)) || null
      if (target) {
        // swap geometry
        setElements(prev => prev.map(e => {
          if (e.id === srcEl.id) return { ...e, x: target.x, y: target.y, w: target.w, h: target.h, rotation: target.rotation, z: target.z }
          if (e.id === target.id) return { ...e, x: srcEl.x, y: srcEl.y, w: srcEl.w, h: srcEl.h, rotation: srcEl.rotation, z: srcEl.z }
          return e
        }))
        scheduleSave()
        return
      }
    }

    // 2) Swap nur für STUDENT↔STUDENT (RefId-Tausch)
    if (srcEl && srcEl.type === 'STUDENT') {
      // determine source unit (single or pair)
      const getStudentPairPartner = (el: Element): { partner: Element, side: Side, pairId?: string } | null => {
        const joints: any[] = Array.isArray(el.meta?.joints) ? el.meta!.joints : []
        const pj = joints.find((j: any) => (j.kind === 'pair') && typeof j.otherId === 'string')
        if (!pj) return null
        const other = elements.find(x => x.id === pj.otherId) || null
        if (other && other.type === 'STUDENT') return { partner: other, side: pj.side as Side, pairId: pj.pairId }
        return null
      }
      const pInfo = getStudentPairPartner(srcEl)
      const partner = pInfo?.partner ?? null
      const sourceUnitIds = partner ? [srcEl.id!, partner.id!] : [srcEl.id!]
      // gesamte Quellgruppe sammeln, um Zielkandidaten auszuschließen und später zurückzusetzen
      const sourceGroupIds = getGroupIds([srcEl.id!])
      // find target seat under pointer excluding source unit
      const isPointIn = (e: Element, x: number, y: number) => x >= e.x && x <= e.x + e.w && y >= e.y && y <= e.y + e.h
      const candidates = elements.filter(e => e.type === 'STUDENT' && !sourceGroupIds.includes(e.id!))
      let targetSeat = candidates.find(e => isPointIn(e, pointer.px, pointer.py)) || null
      if (!targetSeat) {
        // fallback by max overlap with src rect
        const a = srcEl
        let best: { e: Element; area: number } | null = null
        for (const e of candidates) {
          const left = Math.max(a.x, e.x)
          const right = Math.min(a.x + a.w, e.x + e.w)
          const top = Math.max(a.y, e.y)
          const bottom = Math.min(a.y + a.h, e.y + e.h)
          const area = Math.max(0, right - left) * Math.max(0, bottom - top)
          if (area > 0 && (!best || area > best.area)) best = { e, area }
        }
        targetSeat = best?.e || null
      }
      if (targetSeat) {
        // identify target unit (pair or single) – but swap strategy: always ensure 1:1 or 2:2, fallback 1:1
        const targetInfo = getStudentPairPartner(targetSeat)
        const targetPartner = targetInfo?.partner ?? null
        const sourceIsPair = sourceUnitIds.length === 2
        const targetIsPair = !!targetPartner && (elements.find(e => e.id === targetPartner!.id)?.type === 'STUDENT')

        const swap1to1 = (aId: string, bId: string) => {
          setElements(prev => prev.map(e => {
            if (e.id === aId) return { ...e, refId: prev.find(x => x.id === bId)?.refId ?? null }
            if (e.id === bId) return { ...e, refId: prev.find(x => x.id === aId)?.refId ?? null }
            return e
          }))
        }
        const swap2to2 = (aIds: string[], bIds: string[]) => {
          // stabile Indexbildung über Paar-Seite: 0 = left/top, 1 = right/bottom
          const pairIndex = (elId: string) => {
            const el = elements.find(e => e.id === elId)!
            const joints: any[] = Array.isArray(el.meta?.joints) ? el.meta!.joints : []
            const pj = joints.find((j: any) => j.kind === 'pair')
            const side = (pj?.side as Side) || 'left'
            return (side === 'left' || side === 'top') ? 0 : 1
          }
          const A = [...aIds].sort((p, q) => pairIndex(p) - pairIndex(q))
          const B = [...bIds].sort((p, q) => pairIndex(p) - pairIndex(q))
          setElements(prev => {
            const ref = new Map(prev.map(x => [x.id!, x.refId ?? null]))
            return prev.map(e => {
              if (e.id === A[0]) return { ...e, refId: ref.get(B[0]) ?? null }
              if (e.id === A[1]) return { ...e, refId: ref.get(B[1]) ?? null }
              if (e.id === B[0]) return { ...e, refId: ref.get(A[0]) ?? null }
              if (e.id === B[1]) return { ...e, refId: ref.get(A[1]) ?? null }
              return e
            })
          })
        }

        if (sourceIsPair && targetIsPair) {
          swap2to2(sourceUnitIds, [targetSeat.id!, targetPartner!.id!])
        } else if (sourceIsPair) {
          // swap dragged seat with target only (choose the dragged seat id)
          swap1to1(srcEl.id!, targetSeat.id!)
        } else if (targetIsPair) {
          // swap source single with the targeted seat within target pair
          swap1to1(srcEl.id!, targetSeat.id!)
        } else {
          swap1to1(srcEl.id!, targetSeat.id!)
        }
        // revert geometry of entire source group to dragStart snapshot if present
        const start = dragStartPositions.current
        if (start.size > 0) {
          setElements(prev => prev.map(e => start.has(e.id!) ? { ...e, x: start.get(e.id!)!.x, y: start.get(e.id!)!.y } : e))
        }
        scheduleSave()
        return // do not proceed with snapping/jointing
      }
    }
    setElements(prev => {
      const current = prev.find(e => e.id === id)
      if (!current) return prev
      if (opts?.detach) {
        // Remove all joints from/to this element
        setTimeout(() => {
          for (const other of prev) {
            if (other.id === id) continue
            removeJoint(id, other.id!)
          }
          scheduleSave()
        }, 0)
        return prev
      }
      // Snap when near another element
      const others = prev.filter(e => e.id !== id)
      const delta = snapDeltaToNearest(current, others, 8)
      let snappedCurrent = current
      if (delta) {
        snappedCurrent = { ...current, x: current.x + delta.dx, y: current.y + delta.dy }
      }
      // Determine best other for linking by maximum overlap along contact axis
      let bestOther: Element | null = null
      let bestScore = -Infinity
      for (const other of prev) {
        if (other.id === id) continue
        if (!touchesOrIntersects(snappedCurrent, other)) continue
        // score by overlap length
        const vOverlap = Math.max(0, Math.min(snappedCurrent.y + snappedCurrent.h, other.y + other.h) - Math.max(snappedCurrent.y, other.y))
        const hOverlap = Math.max(0, Math.min(snappedCurrent.x + snappedCurrent.w, other.x + other.w) - Math.max(snappedCurrent.x, other.x))
        const score = Math.max(vOverlap, hOverlap)
        if (score > bestScore) { bestScore = score; bestOther = other }
      }
      if (bestOther) {
        const joint = computeEdgeJointRect({ x: snappedCurrent.x, y: snappedCurrent.y, w: snappedCurrent.w, h: snappedCurrent.h }, { x: bestOther.x, y: bestOther.y, w: bestOther.w, h: bestOther.h })
        const next = prev.map(e => e.id === id ? { ...snappedCurrent } : e)
        // Apply/update joint
        setTimeout(() => {
          if (joint) addJoint(id, bestOther!.id!, joint.aSide, joint.bSide, joint.aT, joint.bT)
          scheduleSave()
        }, 0)
        return next
      }
      // Moved but no link: remove joints that no longer touch from this id
      setTimeout(() => {
        for (const other of prev) {
          if (other.id === id) continue
          // remove only if no longer touching after snap
          if (!touchesOrIntersects(snappedCurrent, other)) removeJoint(id, other.id!)
        }
        scheduleSave()
      }, 0)
      return prev.map(e => e.id === id ? { ...snappedCurrent } : e)
    })
    scheduleSave()
  }

  const addElement = (type: ElementType, refId?: string, at?: { x: number; y: number }) => {
    if (readOnly) return
    const startX = sidebarOpen ? 320 : 120
    // Larger default sizes to match bigger default font
    const base: Element = { id: uid('el'), type, refId: refId ?? null, x: at?.x ?? startX, y: at?.y ?? 120, w: 120, h: 70, rotation: 0, z: elements.length, groupId: null, meta: { fontSize: typeStyles[type]?.fontSize ?? 20 } }
    if (type === 'WINDOW_SIDE' || type === 'WALL_SIDE') { base.w = 320; base.h = 10 }
    if (type === 'DOOR') { base.w = 48; base.h = 10 }
    if (type === 'TEACHER_DESK') { base.w = 260; base.h = 80 }
    setElements(prev => [...prev, base])
    scheduleSave()
  }

  const removeSelected = () => {
    if (readOnly || selectedIds.length === 0) return
    const toDelete = new Set(selectedIds)
    setElements(prev => {
      const kept = prev.filter(e => !toDelete.has(e.id!))
      return kept.map(e => {
        const links: any[] = Array.isArray(e.meta?.joints) ? e.meta!.joints : []
        const nextLinks = links.filter(l => !toDelete.has(l.otherId))
        if (nextLinks.length !== links.length) {
          return { ...e, meta: { ...(e.meta || {}), joints: nextLinks } }
        }
        return e
      })
    })
    setSelectedIds([])
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
  
  // Keyboard: copy/paste/select-all/delete
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (pickerOpenId) return // don't handle global shortcuts when picker open
      const target = e.target as HTMLElement | null
      const isEditable = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || (target as any).isContentEditable)
      if (isEditable) return
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        if (readOnly) return
        setSelectedIds(elements.map(el => el.id!).filter(Boolean))
        return
      }
      if (mod && e.key.toLowerCase() === 'c') {
        e.preventDefault()
        if (!primarySelectedId) return
        const el = elements.find(x => x.id === primarySelectedId)
        if (el) setClipboard({ ...el })
        return
      }
      if (mod && e.key.toLowerCase() === 'v') {
        e.preventDefault()
        if (readOnly || !clipboard) return
        // Paste near current selection or at default
        const baseX = selected?.x ?? (sidebarOpen ? 320 : 120)
        const baseY = selected?.y ?? 120
        if (clipboard.type === 'STUDENT') {
          const used = new Set(elements.filter(e => e.type === 'STUDENT' && e.refId).map(e => String(e.refId)))
          const candidate = students.find(s => !used.has(String(s.id)))
          if (candidate) {
            addElement('STUDENT', candidate.id, { x: baseX + 16, y: baseY + 16 })
          } else {
            // If no free student left, duplicate as empty placeholder
            addElement('STUDENT', undefined, { x: baseX + 16, y: baseY + 16 })
          }
        } else {
          const clone = { ...clipboard }
          // Ignore id and groupId, offset position
          addElement(clone.type, clone.refId ?? undefined, { x: baseX + 16, y: baseY + 16 })
        }
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (readOnly) return
        if (selectedIds.length > 0) {
          e.preventDefault()
          removeSelected()
        }
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [elements, selected, selectedIds, clipboard, readOnly, students, sidebarOpen, primarySelectedId])
  // close picker when clicking outside
  useEffect(() => {
    if (!pickerOpenId) return
    const onDocClick = () => setPickerOpenId(null)
    window.addEventListener('click', onDocClick)
    return () => window.removeEventListener('click', onDocClick)
  }, [pickerOpenId])
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

  return <EditorView ctx={{
    leadPlan, viewMode, setViewMode, saving,
    frameRef, canvasRef, frameSize,
    readOnly, elements, selectedIds, setSelectedIds,
    elementRefs, selected, studentById, defaultTerms,
    pickerOpenId, setPickerOpenId, pickerQuery, setPickerQuery,
    usedStudentIds, addElement, applyPairsLayout, removeJoint, scheduleSave,
    exportPng, exportPdf, selectedTarget, primarySelectedId,
    moveElementBy, onDragEnd, setElements, students, classId, roomId, loadPlan,
    setMarquee, marquee, editing, setEditing, detachOnDragRef, dragStartPositions,
    sidebarOpen, activeProfile, setTypeStyles, removeSelected, setStudents,
    onInlineEditKeyDown: async (el: any, e: any) => {
      if (e.key === 'Escape') { setEditing({ id: null, value: '' }); return }
      if (e.key === 'Enter') {
        const val = editing.value.trim()
        if (!val) { setEditing({ id: null, value: '' }); return }
        if (el.type === 'STUDENT' && el.refId) {
          try {
            await fetch(`/api/students/${el.refId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ foreName: val }) })
            setStudents((prev: any) => prev.map((s: any) => s.id === el.refId ? { ...s, foreName: val } : s))
          } catch {}
        } else {
          setElements((prev: any) => prev.map((x: any) => x.id === el.id ? { ...x, meta: { ...(x.meta || {}), label: val } } : x))
          scheduleSave()
        }
        setEditing({ id: null, value: '' })
      }
    },
    onInlineEditBlur: async (el: any) => {
      const val = editing.value.trim()
      setEditing({ id: null, value: '' })
      if (!val) return
      if (el.type === 'STUDENT' && el.refId) {
        try {
          await fetch(`/api/students/${el.refId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ foreName: val }) })
          setStudents((prev: any) => prev.map((s: any) => s.id === el.refId ? { ...s, foreName: val } : s))
        } catch {}
      } else {
        setElements((prev: any) => prev.map((x: any) => x.id === el.id ? { ...x, meta: { ...(x.meta || {}), label: val } } : x))
        scheduleSave()
      }
    },
    onMoveableResize: (e: any) => {
      if (!primarySelectedId) return
      const { width, height, drag, direction } = e
      setElements((prev: any) => prev.map((x: any) => {
        if (x.id !== primarySelectedId) return x
        let newW = Math.max(10, width)
        let newH = Math.max(10, height)
        const lineLike = x.type === 'DOOR' || x.type === 'WINDOW_SIDE' || x.type === 'WALL_SIDE'
        if (lineLike) {
          const rot = ((x.rotation % 360) + 360) % 360
          const horizontal = (Math.round(rot / 90) % 2) === 0
          if (horizontal) newH = x.h
          else newW = x.w
        }
        const nx = x.x + (drag?.beforeTranslate?.[0] ?? 0)
        const ny = x.y + (drag?.beforeTranslate?.[1] ?? 0)
        const dxW = newW - x.w
        const dyH = newH - x.h
        const dirX = Array.isArray(direction) ? direction[0] : 0
        const dirY = Array.isArray(direction) ? direction[1] : 0
        if ((dxW !== 0 || dyH !== 0) && Array.isArray(x.meta?.joints)) {
          const joints = x.meta!.joints as any[]
          setTimeout(() => {
            setElements((prev2: any) => prev2.map((n: any) => {
              const link = joints.find((j: any) => j.otherId === n.id)
              if (!link) return n
              if (dirX === 1 && link.side === 'right') return { ...n, x: n.x + dxW }
              if (dirX === -1 && link.side === 'left') return { ...n, x: n.x - dxW }
              if (dirY === 1 && link.side === 'bottom') return { ...n, y: n.y + dyH }
              if (dirY === -1 && link.side === 'top') return { ...n, y: n.y - dyH }
              return n
            }))
          }, 0)
        }
        return { ...x, w: newW, h: newH, x: nx, y: ny }
      }))
    },
  }} />
}
