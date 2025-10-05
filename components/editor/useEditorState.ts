"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { computeEdgeJointRect } from '@/components/editor/geometry'
import type { Side } from '@/components/editor/geometry'
import type { ElementType, Element, Plan } from './editorTypes'
import { uid, intersects, overlapAmount, touchesOrIntersects, snapDeltaToNearest } from './editorUtils'

export function useEditorState({ classes, rooms }: { classes: { id: string; name: string }[]; rooms: { id: string; name: string; type: string }[] }) {
  const [activeProfile, setActiveProfile] = useState<{ id: string; name: string } | null>(null)
  const [classId, setClassId] = useState('')
  const [roomId, setRoomId] = useState('')
  const [plan, setPlan] = useState<Plan | null>(null)
  const planRef = useRef<Plan | null>(null)
  const [leadPlan, setLeadPlan] = useState<Plan | null>(null)
  const [viewMode, setViewMode] = useState<'owner' | 'lead'>('owner')
  const [elements, setElements] = useState<Element[]>([])
  const elementsRef = useRef<Element[]>([])
  const [students, setStudents] = useState<{ id: string; foreName: string }[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const elementRefs = useRef<Map<string, HTMLElement>>(new Map())
  const saveTimer = useRef<NodeJS.Timeout | null>(null)
  const [clipboard, setClipboard] = useState<Element | null>(null)
  // History (undo/redo) for element state
  const historyRef = useRef<{ past: Element[][]; future: Element[][] }>({ past: [], future: [] })
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const MAX_HISTORY = 100
  const deepClone = (els: Element[]): Element[] => {
    try { return (structuredClone as any)(els) } catch { return JSON.parse(JSON.stringify(els)) }
  }
  const updateHistoryFlags = () => {
    setCanUndo(historyRef.current.past.length > 0)
    setCanRedo(historyRef.current.future.length > 0)
  }
  const historyCommit = useCallback(() => {
    historyRef.current.past.push(deepClone(elementsRef.current))
    if (historyRef.current.past.length > MAX_HISTORY) historyRef.current.past.shift()
    historyRef.current.future = []
    updateHistoryFlags()
  }, [])
  const undo = useCallback(() => {
    if (historyRef.current.past.length === 0) return
    const prev = historyRef.current.past.pop()!
    historyRef.current.future.push(deepClone(elementsRef.current))
    setElements(prev)
    setSelectedIds([])
    updateHistoryFlags()
    scheduleSave()
  }, [])
  const redo = useCallback(() => {
    if (historyRef.current.future.length === 0) return
    const next = historyRef.current.future.pop()!
    historyRef.current.past.push(deepClone(elementsRef.current))
    setElements(next)
    setSelectedIds([])
    updateHistoryFlags()
    scheduleSave()
  }, [])
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
  const [jointHover, setJointHover] = useState<null | { aId: string; bId: string; aSide: Side; bSide: Side; aT: number; bT: number }>(null)

  // After a quick layout, align Lehrer/Tür/Fenster/Wand to frame and edges
  const realignFixedElements = (allEls: Element[]): Element[] => {
    const elements = allEls.map(e => ({ ...e }))
    const students = elements.filter(e => e.type === 'STUDENT')
    const margin = 16
    const strongGap = 28

    // Deterministic anchoring for both room types: snap Fenster/Wand to full frame height bands, place Lehrer/Tür at bottom with gaps.
    const BAR_THICK_DEFAULT = 32
    const TEACH_W = 260, TEACH_H = 80
    const DOOR_W = 120, DOOR_H = 32

    // place/normalize wall and window bars (full height band at sides)
    for (let i = 0; i < elements.length; i++) {
      const e = elements[i]
      if (e.type === 'WALL_SIDE' || e.type === 'WINDOW_SIDE') {
        const thick = e.h || BAR_THICK_DEFAULT
        const centerX = (e.type === 'WALL_SIDE')
          ? (margin + thick / 2)
          : (frameSize.w - margin - thick / 2)
        const len = Math.max(160, frameSize.h - 2 * margin)
        elements[i] = { ...e, rotation: 90, h: thick, w: len, x: centerX - len / 2, y: (frameSize.h - thick) / 2 }
      }
    }
    // enforce equal lengths and keep centers stable
    {
      const wallIdx = elements.findIndex(e => e.type === 'WALL_SIDE')
      const winIdx = elements.findIndex(e => e.type === 'WINDOW_SIDE')
      if (wallIdx >= 0 && winIdx >= 0) {
        const wall = elements[wallIdx]
        const win = elements[winIdx]
        const desiredLen = Math.max(wall.w, win.w)
        const wallCenterX = wall.x + wall.w / 2
        const winCenterX = win.x + win.w / 2
        elements[wallIdx] = { ...wall, w: desiredLen, x: wallCenterX - desiredLen / 2 }
        elements[winIdx] = { ...win, w: desiredLen, x: winCenterX - desiredLen / 2 }
      }
    }
    const wallBar = elements.find(e => e.type === 'WALL_SIDE')
    const winBar = elements.find(e => e.type === 'WINDOW_SIDE')
    const leftThick = wallBar ? (wallBar.h || BAR_THICK_DEFAULT) : BAR_THICK_DEFAULT
    const rightThick = winBar ? (winBar.h || BAR_THICK_DEFAULT) : BAR_THICK_DEFAULT
    const TEACH_GAP_LEFT = 12  // extra gap so teacher never overlaps wall bar
    const DOOR_GAP_RIGHT = 4   // door can be near window but not overlap

    // place teacher bottom-left (offset by wall thickness + gap), door bottom-right (offset by window thickness + gap)
    for (let i = 0; i < elements.length; i++) {
      const e = elements[i]
      if (e.type === 'TEACHER_DESK') {
        const w = e.w || TEACH_W, h = e.h || TEACH_H
        const nx = Math.max(margin + leftThick + TEACH_GAP_LEFT, Math.min(frameSize.w - margin - w, margin + leftThick + TEACH_GAP_LEFT))
        elements[i] = { ...e, w, h, x: nx, y: Math.max(0, frameSize.h - margin - h) }
      } else if (e.type === 'DOOR') {
        const w = e.w || DOOR_W, h = e.h || DOOR_H
        const nx = Math.max(margin, frameSize.w - margin - rightThick - DOOR_GAP_RIGHT - w)
        elements[i] = { ...e, w, h, x: nx, y: Math.max(0, frameSize.h - margin - h) }
      }
    }

    // compute student bounds
    let minX = Infinity, minY = Infinity, maxR = -Infinity, maxB = -Infinity
    for (const s of students) {
      if (s.x < minX) minX = s.x
      if (s.y < minY) minY = s.y
      if (s.x + s.w > maxR) maxR = s.x + s.w
      if (s.y + s.h > maxB) maxB = s.y + s.h
    }
    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxR) || !isFinite(maxB)) {
      minX = 0; minY = 0; maxR = frameSize.w; maxB = frameSize.h
    }

    // Build inflated obstacles for placement helpers
    type Box = { left: number; top: number; right: number; bottom: number }
    const buildObstacles = (els: Element[]): Box[] => {
      const obs: Box[] = []
      for (const el of els) {
        const rot = (((el.rotation || 0) % 360) + 360) % 360
        const rad = rot * Math.PI / 180
        const cos = Math.cos(rad)
        const sin = Math.sin(rad)
        const bbW = Math.abs(el.w * cos) + Math.abs(el.h * sin)
        const bbH = Math.abs(el.w * sin) + Math.abs(el.h * cos)
        const cx = el.x + el.w / 2
        const cy = el.y + el.h / 2
        let left = cx - bbW / 2
        let top = cy - bbH / 2
        let right = cx + bbW / 2
        let bottom = cy + bbH / 2
        const clearance = el.type === 'STUDENT' ? 32 : (el.type === 'WINDOW_SIDE' || el.type === 'WALL_SIDE') ? 20 : 12
        left -= clearance; top -= clearance; right += clearance; bottom += clearance
        obs.push({ left, top, right, bottom })
      }
      return obs
    }
    const obstacles = buildObstacles(elements)

    // Place teacher under the leftmost student column (first row), at same band
    const placeTeacher = (e: Element): Element => {
      const base = { ...e, w: 260, h: 80 }
      const avgH = students.reduce((a, s) => a + s.h, 0) / students.length
      const tol = Math.max(24, 0.6 * avgH)
      const firstRow = students.filter(s => s.y <= minY + tol)
      const firstRowBottom = Math.max(...firstRow.map(s => s.y + s.h))
      const targetY = Math.min(frameSize.h - base.h - margin, firstRowBottom + strongGap)
      const xDomainL = margin
      const xDomainR = Math.max(xDomainL, frameSize.w - margin - base.w)
      const forbiddenXIntervals = (y: number): Array<[number, number]> => {
        const T = y, B = y + base.h
        const acc: Array<[number, number]> = []
        for (const b of obstacles) { if (!(B <= b.top || T >= b.bottom)) acc.push([b.left - base.w, b.right]) }
        acc.sort((a,b) => a[0] - b[0])
        const merged: Array<[number, number]> = []
        for (const iv of acc) { if (!merged.length || iv[0] > merged[merged.length - 1][1]) merged.push([iv[0], iv[1]]); else merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], iv[1]) }
        return merged
      }
      const tryNearestToX = (y: number, desiredX: number): number | null => {
        const merged = forbiddenXIntervals(y)
        // build gaps
        let cur = xDomainL
        const gaps: Array<[number, number]> = []
        for (const [s, e] of merged) {
          if (e <= xDomainL) { cur = Math.max(cur, e); continue }
          if (s > xDomainR) break
          if (s > cur) gaps.push([cur, Math.min(s, xDomainR)])
          cur = Math.max(cur, e)
        }
        if (cur < xDomainR) gaps.push([cur, xDomainR])
        if (gaps.length === 0) return null
        // choose gap where placing at desiredX fits, else closest edge
        let bestX: number | null = null
        let bestD = Infinity
        for (const [gL, gR] of gaps) {
          const px = Math.min(Math.max(desiredX, gL), gR - base.w)
          if (px < gL || px > gR - base.w) continue
          const center = px + base.w / 2
          const d = Math.abs(center - (desiredX + base.w / 2))
          if (d < bestD) { bestD = d; bestX = px }
        }
        return bestX
      }
      let placed = false
      const yMin = Math.min(targetY, frameSize.h - margin - base.h)
      const yMax = Math.max(yMin, frameSize.h - margin - base.h)
      // desired X under the leftmost first-row seat center
      const leftSeat = firstRow.reduce((m, s) => (s.x < m.x ? s : m), firstRow[0])
      const desiredX = leftSeat.x + leftSeat.w / 2 - base.w / 2
      for (let y = yMin; y <= yMax; y += 6) { const px = tryNearestToX(y, desiredX); if (px !== null) { base.x = px; base.y = y; placed = true; break } }
      if (!placed) { const lastY = frameSize.h - margin - base.h; const px = tryNearestToX(lastY, desiredX); if (px !== null) { base.x = px; base.y = lastY } else { base.x = Math.max(xDomainL, Math.min(xDomainR, desiredX)); base.y = lastY } }
      return base
    }

    // Place door opposite to teacher at same row (y), hugging the opposite edge, avoiding overlaps
    const placeDoorOppositeTeacher = (e: Element, teacher: Element | null): Element => {
      const base = { ...e, w: 120, h: 32 }
      const y = teacher ? teacher.y : Math.max(0, Math.min(frameSize.h - base.h, (minY + maxB) / 2))
      const xDomainL = margin
      const xDomainR = Math.max(xDomainL, frameSize.w - margin - base.w)
      const forbiddenXIntervals = (yy: number): Array<[number, number]> => {
        const T = yy, B = yy + base.h
        const acc: Array<[number, number]> = []
        for (const b of obstacles) { if (!(B <= b.top || T >= b.bottom)) acc.push([b.left - base.w, b.right]) }
        acc.sort((a,b) => a[0] - b[0])
        const merged: Array<[number, number]> = []
        for (const iv of acc) { if (!merged.length || iv[0] > merged[merged.length - 1][1]) merged.push([iv[0], iv[1]]); else merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], iv[1]) }
        return merged
      }
      const tryNearestToX = (yy: number, desiredX: number): number | null => {
        const merged = forbiddenXIntervals(yy)
        // build gaps
        let cur = xDomainL
        const gaps: Array<[number, number]> = []
        for (const [s, e] of merged) {
          if (e <= xDomainL) { cur = Math.max(cur, e); continue }
          if (s > xDomainR) break
          if (s > cur) gaps.push([cur, Math.min(s, xDomainR)])
          cur = Math.max(cur, e)
        }
        if (cur < xDomainR) gaps.push([cur, xDomainR])
        if (gaps.length === 0) return null
        // choose gap near desiredX
        let bestX: number | null = null
        let bestD = Infinity
        for (const [gL, gR] of gaps) {
          const px = Math.min(Math.max(desiredX, gL), gR - base.w)
          if (px < gL || px > gR - base.w) continue
          const center = px + base.w / 2
          const d = Math.abs(center - (desiredX + base.w / 2))
          if (d < bestD) { bestD = d; bestX = px }
        }
        return bestX
      }
      // desired X under the rightmost first-row seat center
      const firstRowSeats = students.filter(s => s.y <= (minY + Math.max(24, 0.6 * (students.reduce((a, s) => a + s.h, 0) / students.length))))
      const rightSeat = firstRowSeats.reduce((m, s) => ((s.x > m.x) ? s : m), firstRowSeats[0] ?? students[0])
      const desiredX = rightSeat.x + rightSeat.w / 2 - base.w / 2
      const px = tryNearestToX(y, desiredX)
      if (px !== null) return { ...base, x: px, y }
      // fallback small scan
      for (let dy = 0; dy <= 48; dy += 6) {
        const yy1 = Math.max(0, Math.min(frameSize.h - base.h, y - dy))
        const yy2 = Math.max(0, Math.min(frameSize.h - base.h, y + dy))
        const p1 = tryNearestToX(yy1, desiredX)
        if (p1 !== null) return { ...base, x: p1, y: yy1 }
        const p2 = tryNearestToX(yy2, desiredX)
        if (p2 !== null) return { ...base, x: p2, y: yy2 }
      }
      return { ...base, x: Math.max(xDomainL, Math.min(xDomainR, desiredX)), y }
    }

    // WINDOW_SIDE/WALL_SIDE: deterministic sides based on frame, independent of students
    const placeSideBar = (e: Element, side: 'left' | 'right', matchLen?: number): Element => {
      const base = { ...e, rotation: 90 }
      const marginLocal = 16
      // full height band
      const desiredLen = Math.max(160, frameSize.h - 2 * marginLocal)
      base.w = typeof matchLen === 'number' ? Math.max(matchLen, desiredLen) : desiredLen
      const thickness = base.h
      const centerY = frameSize.h / 2
      const centerX = side === 'left' ? (marginLocal + thickness / 2) : (frameSize.w - marginLocal - thickness / 2)
      return { ...base, x: centerX - base.w / 2, y: Math.max(0, Math.min(frameSize.h - base.h, centerY - base.h / 2)) }
    }

    const shouldWindowBeLeft = !roomNameStartsWithW
    let matchLen: number | undefined

    // Deterministic sides for window/wall, independent of creation order
    const windows = elements.filter(e => e.type === 'WINDOW_SIDE')
    const walls = elements.filter(e => e.type === 'WALL_SIDE')
    if (windows.length > 0) {
      const w0 = placeSideBar(windows[0], shouldWindowBeLeft ? 'left' : 'right', matchLen)
      matchLen = w0.w
      elements[elements.findIndex(e => e.id === windows[0].id)] = w0
    }
    if (walls.length > 0) {
      const w0 = placeSideBar(walls[0], shouldWindowBeLeft ? 'right' : 'left', matchLen)
      matchLen = w0.w
      elements[elements.findIndex(e => e.id === walls[0].id)] = w0
    }
    // Ensure Fenster (WINDOW_SIDE) and Wand (WALL_SIDE) are exactly the same length after placement
    if (windows.length > 0 && walls.length > 0) {
      const winIdx = elements.findIndex(e => e.id === windows[0].id)
      const wallIdx = elements.findIndex(e => e.id === walls[0].id)
      const win = elements[winIdx]
      const wall = elements[wallIdx]
      const desiredLen = Math.max(win.w, wall.w)
      const winCenterX = win.x + win.w / 2
      const wallCenterX = wall.x + wall.w / 2
      elements[winIdx] = { ...win, w: desiredLen, x: winCenterX - desiredLen / 2 }
      elements[wallIdx] = { ...wall, w: desiredLen, x: wallCenterX - desiredLen / 2 }
    }

    // Place teacher after side bars
    const teachers = elements.filter(e => e.type === 'TEACHER_DESK')
    let teacherPlaced: Element | null = null
    if (teachers.length > 0) {
      let t0 = placeTeacher(teachers[0])
      // W‑Räume: Lehrer direkt unter die Wand (gleiche Reihe wie Tür), x am Zentrum der Wand
      if (roomNameStartsWithW) {
        const wallBar = elements.find(e => e.type === 'WALL_SIDE') || null
        if (wallBar) {
          const centerX = wallBar.x + wallBar.w / 2
          const margin = 16
          const strongGap = 28
          // move to bottom row band aligned with door row
          const studs = elements.filter(e => e.type === 'STUDENT')
          if (studs.length > 0) {
            const minY = Math.min(...studs.map(s => s.y))
            const avgH = studs.reduce((a, s) => a + s.h, 0) / studs.length
            const tol = Math.max(24, 0.6 * avgH)
            const firstRow = studs.filter(s => s.y <= minY + tol)
            const firstRowBottom = Math.max(...firstRow.map(s => s.y + s.h))
            const targetY = Math.min(frameSize.h - t0.h - margin, firstRowBottom + strongGap)
            t0 = { ...t0, x: Math.max(margin, Math.min(frameSize.w - margin - t0.w, centerX - t0.w / 2)), y: targetY }
          }
        }
      }
      teacherPlaced = t0
      elements[elements.findIndex(e => e.id === teachers[0].id)] = t0
    }

    // Place door: already bottom-right with gap above; keep it (independent of teacher)
    const doors = elements.filter(e => e.type === 'DOOR')
    if (doors.length > 0) {
      const d = doors[0]
      elements[elements.findIndex(e => e.id === d.id)] = d
    }

    // (removed) previously aligned Tür.y to Lehrer.y; we want both flush to bottom line

    // FINAL override: keep Lehrer/Tür flush to bottom (same bottom line), non-overlapping with bars
    {
      const teacher = elements.find(e => e.type === 'TEACHER_DESK')
      const door = elements.find(e => e.type === 'DOOR')
      if (teacher || door) {
        if (teacher) {
          const idx = elements.findIndex(e => e.id === teacher.id)
          const t = elements[idx]
          const nx = Math.max(margin + leftThick + TEACH_GAP_LEFT, Math.min(frameSize.w - margin - t.w, margin + leftThick + TEACH_GAP_LEFT))
          const ny = Math.max(0, frameSize.h - margin - t.h)
          elements[idx] = { ...t, x: nx, y: ny }
        }
        if (door) {
          const idx = elements.findIndex(e => e.id === door.id)
          const d = elements[idx]
          const nx = Math.max(margin, frameSize.w - margin - rightThick - DOOR_GAP_RIGHT - d.w)
          const ny = Math.max(0, frameSize.h - margin - d.h)
          elements[idx] = { ...d, x: nx, y: ny }
        }
      }
    }

    // Normalize z-order: non-students below students, deterministic within types
    const nonStudents = elements.filter(e => e.type !== 'STUDENT')
    const studentsList = elements.filter(e => e.type === 'STUDENT')
    // Order non-students by type priority for stable z
    const typePriority: Record<ElementType, number> = {
      WINDOW_SIDE: 1 as any,
      WALL_SIDE: 2 as any,
      DOOR: 3 as any,
      TEACHER_DESK: 4 as any,
      STUDENT: 5,
    }
    nonStudents.sort((a, b) => (typePriority[a.type] ?? 100) - (typePriority[b.type] ?? 100))
    let zc = 1
    for (const e of nonStudents) e.z = zc++
    for (const e of studentsList) e.z = zc++

    return [...nonStudents, ...studentsList]
  }

  const applyPairsLayout = () => {
    if (readOnly) return
    // Ensure fixed infrastructure exists (window, wall, teacher, door)
    const fixed: Element[] = []
    const hasWin = elements.some(e => e.type === 'WINDOW_SIDE')
    const hasWall = elements.some(e => e.type === 'WALL_SIDE')
    const hasTeacher = elements.some(e => e.type === 'TEACHER_DESK')
    const hasDoor = elements.some(e => e.type === 'DOOR')
    const barThickness = Math.max(24, (typeStyles['WALL_SIDE']?.fontSize ?? 20) + 8)
    if (!hasWin) fixed.push({ id: uid('el'), type: 'WINDOW_SIDE', refId: null, x: 0, y: 0, w: 320, h: barThickness, rotation: 90, z: 1, groupId: null, meta: { fontSize: typeStyles['WALL_SIDE'].fontSize } })
    if (!hasWall) fixed.push({ id: uid('el'), type: 'WALL_SIDE', refId: null, x: 0, y: 0, w: 320, h: barThickness, rotation: 90, z: 1, groupId: null, meta: { fontSize: typeStyles['WALL_SIDE'].fontSize } })
    if (!hasTeacher) fixed.push({ id: uid('el'), type: 'TEACHER_DESK', refId: null, x: 0, y: 0, w: 160, h: 80, rotation: 0, z: 1, groupId: null, meta: { fontSize: typeStyles['TEACHER_DESK'].fontSize } })
    if (!hasDoor) fixed.push({ id: uid('el'), type: 'DOOR', refId: null, x: 0, y: 0, w: 120, h: 32, rotation: 0, z: 1, groupId: null, meta: { fontSize: typeStyles['DOOR'].fontSize } })
    // constants for simple, tight pairs
    const seatW = 120
    const seatH = 70
    // Inner margins: for W-rooms, align first/last column to exactly G from bars
    const marginX = 40
    const marginY = 60
    const betweenPairsX = 24 // default gutter (will be recomputed for W rooms)
    const betweenRowsY = 24

    // Determine how many seats to layout: prefer loaded students count, fallback to existing seat count
    const existingSeats = elements.filter(e => e.type === 'STUDENT')
    const nStudents = students.length
    const n = nStudents > 0 ? nStudents : existingSeats.length
    if (n === 0) return

    const pairWidth = seatW * 2 // tight: no gap inside pair
    // Always 4 columns (of pairs) per row, rows as needed
    const perRow = 4
    const pairCount = Math.ceil(n / 2)
    const rows = Math.ceil(pairCount / perRow)

    const newSeats: Element[] = []
    let pairIndex = 0
    for (let r = 0; r < rows; r++) {
      // For W-rooms, compute gutters to exactly fill inner band (left/right gaps == G)
      let x: number
      let gutter = betweenPairsX
      if (roomNameStartsWithW) {
        const BAR_DEFAULT = 32; const G = 12; const OUTER = 16
        const wall = elements.find(e => e.type === 'WALL_SIDE')
        const win = elements.find(e => e.type === 'WINDOW_SIDE')
        const leftBand = OUTER + (wall ? (wall.h || BAR_DEFAULT) : BAR_DEFAULT) + G
        const rightBand = OUTER + (win ? (win.h || BAR_DEFAULT) : BAR_DEFAULT) + G
        const availInner = Math.max(0, frameSize.w - leftBand - rightBand)
        gutter = perRow > 1 ? Math.max(0, (availInner - perRow * pairWidth) / (perRow - 1)) : 0
        x = leftBand
      } else {
        x = marginX
      }
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
        x += pairWidth + gutter
      }
    }

    // assign all students sequentially (use all)
    // Assign refIds: first loaded students, then preserve any existing refIds if present
    const assignedSeats = newSeats.map((e, i) => {
      if (i < nStudents) return { ...e, refId: students[i].id }
      if (i < existingSeats.length) return { ...e, refId: existingSeats[i].refId ?? null }
      return e
    })

    // replace existing student elements; keep others and then realign fixed elements
    setElements(prev => realignFixedElements([
      ...prev.filter(e => e.type !== 'STUDENT'),
      ...fixed,
      ...assignedSeats,
    ]))
    scheduleSave()
  }

  // New preformatted layouts
  const applySidesPairsCenterFour = (opts?: { angled?: boolean }) => {
    if (readOnly) return
    // Ensure fixed infrastructure exists (window, wall, teacher, door)
    const fixed: Element[] = []
    const hasWin = elements.some(e => e.type === 'WINDOW_SIDE')
    const hasWall = elements.some(e => e.type === 'WALL_SIDE')
    const hasTeacher = elements.some(e => e.type === 'TEACHER_DESK')
    const hasDoor = elements.some(e => e.type === 'DOOR')
    const barThickness = Math.max(24, (typeStyles['WALL_SIDE']?.fontSize ?? 20) + 8)
    if (!hasWin) fixed.push({ id: uid('el'), type: 'WINDOW_SIDE', refId: null, x: 0, y: 0, w: 320, h: barThickness, rotation: 90, z: 1, groupId: null, meta: { fontSize: typeStyles['WALL_SIDE'].fontSize } })
    if (!hasWall) fixed.push({ id: uid('el'), type: 'WALL_SIDE', refId: null, x: 0, y: 0, w: 320, h: barThickness, rotation: 90, z: 1, groupId: null, meta: { fontSize: typeStyles['WALL_SIDE'].fontSize } })
    if (!hasTeacher) fixed.push({ id: uid('el'), type: 'TEACHER_DESK', refId: null, x: 0, y: 0, w: 160, h: 80, rotation: 0, z: 1, groupId: null, meta: { fontSize: typeStyles['TEACHER_DESK'].fontSize } })
    if (!hasDoor) fixed.push({ id: uid('el'), type: 'DOOR', refId: null, x: 0, y: 0, w: 120, h: 32, rotation: 0, z: 1, groupId: null, meta: { fontSize: typeStyles['DOOR'].fontSize } })
    const angled = !!opts?.angled
    const seatW = 120
    const seatH = 70
    const marginX = 40
    const marginY = 60
    const betweenRowsY = 24
    const betweenGroupsX = 48 // gap between left-pair, center-4, right-pair blocks

    const nStudents = students.length
    const existingSeats = elements.filter(e => e.type === 'STUDENT')
    const n = nStudents > 0 ? nStudents : existingSeats.length
    if (n === 0) return

    const perRowSeats = 8 // 2 (pair) + 4 + 2 (pair)
    const rows = Math.ceil(n / perRowSeats)
    const newSeats: Element[] = []

    const deg2rad = (deg: number) => (deg * Math.PI) / 180
    for (let r = 0, used = 0; r < rows && used < n; r++) {
      const y = marginY + r * (seatH + betweenRowsY)
      // Compute total width of one row to center horizontally
      let totalW: number
      let leftPairSpanX: number
      let rightPairSpanX: number
      if (angled) {
        const cos = Math.cos(deg2rad(10))
        leftPairSpanX = seatW + seatW * cos
        rightPairSpanX = seatW + seatW * cos
        totalW = leftPairSpanX + betweenGroupsX + (4 * seatW) + betweenGroupsX + rightPairSpanX
      } else {
        leftPairSpanX = 2 * seatW
        rightPairSpanX = 2 * seatW
        totalW = leftPairSpanX + betweenGroupsX + (4 * seatW) + betweenGroupsX + rightPairSpanX
      }
      let startX: number
      let gapBetweenGroups = betweenGroupsX
      if (roomNameStartsWithW) {
        const BAR_DEFAULT = 32; const G = 12; const OUTER = 16
        const wall = elements.find(e => e.type === 'WALL_SIDE')
        const win = elements.find(e => e.type === 'WINDOW_SIDE')
        const leftBand = OUTER + (wall ? (wall.h || BAR_DEFAULT) : BAR_DEFAULT) + G
        const rightBand = OUTER + (win ? (win.h || BAR_DEFAULT) : BAR_DEFAULT) + G
        const availInner = Math.max(0, frameSize.w - leftBand - rightBand)
        const blocksW = leftPairSpanX + (4 * seatW) + rightPairSpanX
        const free = Math.max(0, availInner - blocksW)
        gapBetweenGroups = free / 2
        startX = leftBand
      } else {
        const availInner = frameSize.w
        startX = Math.max(marginX, Math.floor((availInner - totalW) / 2))
      }
      // Left pair
      const leftPairX = startX
      // build left pair with exact edge-to-edge when angled
      const leftAngle = angled ? -10 : 0
      const lpA: Element = { id: uid('el'), type: 'STUDENT', refId: null, x: leftPairX, y, w: seatW, h: seatH, rotation: leftAngle, z: newSeats.length, groupId: null, meta: { fontSize: typeStyles['STUDENT'].fontSize } }
      let lpB_x = leftPairX + seatW
      let lpB_y = y
      if (angled) {
        const cx = lpA.x + seatW / 2
        const cy = lpA.y + seatH / 2
        const dx = seatW * Math.cos(deg2rad(leftAngle))
        const dy = seatW * Math.sin(deg2rad(leftAngle))
        const rcx = cx + dx
        const rcy = cy + dy
        lpB_x = rcx - seatW / 2
        lpB_y = rcy - seatH / 2
      }
      const lpB: Element = { id: uid('el'), type: 'STUDENT', refId: null, x: lpB_x, y: lpB_y, w: seatW, h: seatH, rotation: leftAngle, z: newSeats.length + 1, groupId: null, meta: { fontSize: typeStyles['STUDENT'].fontSize } }
      const add = (arr: any[]|undefined, item:any)=>Array.isArray(arr)?[...arr,item]:[item]
      const lPairId = uid('pair')
      lpA.meta = { ...(lpA.meta||{}), joints: add(lpA.meta?.joints, { otherId: lpB.id, side: 'right', t: 0.5, kind: 'pair', pairId: lPairId }) }
      lpB.meta = { ...(lpB.meta||{}), joints: add(lpB.meta?.joints, { otherId: lpA.id, side: 'left', t: 0.5, kind: 'pair', pairId: lPairId }) }
      // Center 4
      const centerX = leftPairX + leftPairSpanX + gapBetweenGroups
      const c1: Element = { id: uid('el'), type: 'STUDENT', refId: null, x: centerX + 0 * seatW, y, w: seatW, h: seatH, rotation: 0, z: newSeats.length + 2, groupId: null, meta: { fontSize: typeStyles['STUDENT'].fontSize } }
      const c2: Element = { id: uid('el'), type: 'STUDENT', refId: null, x: centerX + 1 * seatW, y, w: seatW, h: seatH, rotation: 0, z: newSeats.length + 3, groupId: null, meta: { fontSize: typeStyles['STUDENT'].fontSize } }
      const c3: Element = { id: uid('el'), type: 'STUDENT', refId: null, x: centerX + 2 * seatW, y, w: seatW, h: seatH, rotation: 0, z: newSeats.length + 4, groupId: null, meta: { fontSize: typeStyles['STUDENT'].fontSize } }
      const c4: Element = { id: uid('el'), type: 'STUDENT', refId: null, x: centerX + 3 * seatW, y, w: seatW, h: seatH, rotation: 0, z: newSeats.length + 5, groupId: null, meta: { fontSize: typeStyles['STUDENT'].fontSize } }
      // Right pair
      const rightPairX = centerX + 4 * seatW + gapBetweenGroups
      const rightAngle = angled ? 10 : 0
      const rpA: Element = { id: uid('el'), type: 'STUDENT', refId: null, x: rightPairX, y, w: seatW, h: seatH, rotation: rightAngle, z: newSeats.length + 6, groupId: null, meta: { fontSize: typeStyles['STUDENT'].fontSize } }
      let rpB_x = rightPairX + seatW
      let rpB_y = y
      if (angled) {
        const cx = rpA.x + seatW / 2
        const cy = rpA.y + seatH / 2
        const dx = seatW * Math.cos(deg2rad(rightAngle))
        const dy = seatW * Math.sin(deg2rad(rightAngle))
        const rcx = cx + dx
        const rcy = cy + dy
        rpB_x = rcx - seatW / 2
        rpB_y = rcy - seatH / 2
      }
      const rpB: Element = { id: uid('el'), type: 'STUDENT', refId: null, x: rpB_x, y: rpB_y, w: seatW, h: seatH, rotation: rightAngle, z: newSeats.length + 7, groupId: null, meta: { fontSize: typeStyles['STUDENT'].fontSize } }
      const rPairId = uid('pair')
      rpA.meta = { ...(rpA.meta||{}), joints: add(rpA.meta?.joints, { otherId: rpB.id, side: 'right', t: 0.5, kind: 'pair', pairId: rPairId }) }
      rpB.meta = { ...(rpB.meta||{}), joints: add(rpB.meta?.joints, { otherId: rpA.id, side: 'left', t: 0.5, kind: 'pair', pairId: rPairId }) }

      const rowSeats = [lpA, lpB, c1, c2, c3, c4, rpA, rpB]
      for (const s of rowSeats) { if (used < n) { newSeats.push(s); used++ } }
    }

    // Assign refIds: first loaded students, then keep any existing refIds if present
    const assigned = newSeats.map((e, i) => {
      if (i < nStudents) return { ...e, refId: students[i].id }
      const prevSeat = existingSeats[i]
      if (prevSeat) return { ...e, refId: prevSeat.refId ?? null }
      return e
    })
    setElements(prev => realignFixedElements([
      ...prev.filter(e => e.type !== 'STUDENT'),
      ...fixed,
      ...assigned,
    ]))
    scheduleSave()
  }

  const applyHorseshoeLayout = () => {
    if (readOnly) return
    // Ensure fixed infrastructure exists (window, wall, teacher, door)
    const fixed: Element[] = []
    const hasWin = elements.some(e => e.type === 'WINDOW_SIDE')
    const hasWall = elements.some(e => e.type === 'WALL_SIDE')
    const hasTeacher = elements.some(e => e.type === 'TEACHER_DESK')
    const hasDoor = elements.some(e => e.type === 'DOOR')
    const barThickness = Math.max(24, (typeStyles['WALL_SIDE']?.fontSize ?? 20) + 8)
    if (!hasWin) fixed.push({ id: uid('el'), type: 'WINDOW_SIDE', refId: null, x: 0, y: 0, w: 320, h: barThickness, rotation: 90, z: 1, groupId: null, meta: { fontSize: typeStyles['WALL_SIDE'].fontSize } })
    if (!hasWall) fixed.push({ id: uid('el'), type: 'WALL_SIDE', refId: null, x: 0, y: 0, w: 320, h: barThickness, rotation: 90, z: 1, groupId: null, meta: { fontSize: typeStyles['WALL_SIDE'].fontSize } })
    if (!hasTeacher) fixed.push({ id: uid('el'), type: 'TEACHER_DESK', refId: null, x: 0, y: 0, w: 160, h: 80, rotation: 0, z: 1, groupId: null, meta: { fontSize: typeStyles['TEACHER_DESK'].fontSize } })
    if (!hasDoor) fixed.push({ id: uid('el'), type: 'DOOR', refId: null, x: 0, y: 0, w: 120, h: 32, rotation: 0, z: 1, groupId: null, meta: { fontSize: typeStyles['DOOR'].fontSize } })
    const seatW = 120
    const seatH = 70
    const marginX = 40
    const marginY = 40
    let between = 16 // will recompute for W rooms (top run)
    const downGap = 24 // vertical gap between rows/columns

    const nStudents = students.length
    const existingSeats = elements.filter(e => e.type === 'STUDENT')
    const n = nStudents > 0 ? nStudents : existingSeats.length
    if (n === 0) return

    const newSeats: Element[] = []
    const addSeat = (x: number, y: number, rot = 0) => {
      newSeats.push({ id: uid('el'), type: 'STUDENT', refId: null, x, y, w: seatW, h: seatH, rotation: rot, z: newSeats.length, groupId: null, meta: { fontSize: typeStyles['STUDENT'].fontSize } })
    }
    // Compute top run capacity inside inner band between wall/window
    let leftBandW = marginX
    let rightBandW = marginX
    let availW = (frameSize.w - 2 * marginX)
    if (roomNameStartsWithW) {
      const BAR_DEFAULT = 32; const G = 12; const OUTER = 16
      const wall = elements.find(e => e.type === 'WALL_SIDE')
      const win = elements.find(e => e.type === 'WINDOW_SIDE')
      leftBandW = OUTER + (wall ? (wall.h || BAR_DEFAULT) : BAR_DEFAULT) + G
      rightBandW = OUTER + (win ? (win.h || BAR_DEFAULT) : BAR_DEFAULT) + G
      availW = frameSize.w - leftBandW - rightBandW
    }
    const perTop = Math.max(4, Math.min(10, Math.floor((availW + between) / (seatW + between))))
    // Place top run centered
    const totalTopW = perTop * seatW + (perTop - 1) * between
    let startTopX: number
    if (roomNameStartsWithW) {
      // fill inner band exactly: recompute between so first seat starts at leftBand, last ends at rightBand
      between = perTop > 1 ? Math.max(0, (availW - perTop * seatW) / (perTop - 1)) : 0
      startTopX = leftBandW
    } else {
      startTopX = Math.max(marginX, Math.floor((frameSize.w - totalTopW) / 2))
    }
    const topY = marginY
    let used = 0
    for (let i = 0; i < perTop && used < n; i++) {
      addSeat(startTopX + i * (seatW + between), topY)
      used++
    }
    // Side columns with two inward 2er-Reihen und Bodenbegrenzung durch Lehrer/Tür
    const leftX = roomNameStartsWithW ? leftBandW : marginX
    const rightX = roomNameStartsWithW ? (frameSize.w - rightBandW - seatW) : (frameSize.w - marginX - seatW)
    const teacher = elements.find(e => e.type === 'TEACHER_DESK')
    const door = elements.find(e => e.type === 'DOOR')
    const bottomRowY = frameSize.h - marginY - Math.max(teacher?.h ?? 80, door?.h ?? 32)
    // compute vertical levels available above bottom boundary
    const levels: number[] = []
    for (let k = 0; k < 100; k++) {
      const y = topY + seatH + downGap + k * (seatH + downGap)
      if (y + seatH > bottomRowY - 1) break
      levels.push(y)
    }
    // choose 1-2 inner pair levels depending on height
    const innerIdx: number[] = []
    if (levels.length >= 6) innerIdx.push(Math.floor(levels.length / 3), Math.floor((2 * levels.length) / 3))
    else if (levels.length >= 3) innerIdx.push(Math.floor(levels.length / 2))
    // place per level, left then right, substituting the column seat with a 2er nach innen
    for (let i = 0; i < levels.length && used < n; i++) {
      const y = levels[i]
      const isInner = innerIdx.includes(i)
      const remaining = n - used
      if (isInner && remaining >= 4) {
        // vollwertige 2er-Reihen links und rechts
        addSeat(Math.min(leftX + seatW, rightX - seatW * 2), y); used++
        addSeat(Math.min(leftX + seatW * 2, rightX - seatW), y); used++
        if (used < n) { addSeat(Math.max(rightX - seatW * 2, leftX + seatW), y); used++ }
        if (used < n) { addSeat(Math.max(rightX - seatW, leftX + seatW * 2), y); used++ }
      } else {
        // Spalten ohne Lücken auffüllen (oder Fallback, wenn nicht genug für 2er-Reihen)
        addSeat(leftX, y); used++
        if (used < n) { addSeat(rightX, y); used++ }
      }
    }

    // Assign refIds consistently
    const assigned = newSeats.map((e, i) => {
      if (i < nStudents) return { ...e, refId: students[i].id }
      const prevSeat = existingSeats[i]
      if (prevSeat) return { ...e, refId: prevSeat.refId ?? null }
      return e
    })
    setElements(prev => realignFixedElements([
      ...prev.filter(e => e.type !== 'STUDENT'),
      ...fixed,
      ...assigned,
    ]))
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

  const defaultTerms: Record<string, string> = {
    STUDENT: 'Schüler',
    TEACHER_DESK: 'Lehrer',
    DOOR: 'Tür',
    WINDOW_SIDE: 'Fenster',
    WALL_SIDE: 'Wand',
  }

  useEffect(() => {
    planRef.current = plan
  }, [plan])

  useEffect(() => {
    elementsRef.current = elements
  }, [elements])

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (!meta) return
      const k = String(e.key || '').toLowerCase()
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

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
    if (!planRef.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaving('saving')
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId: planRef.current!.id, elements: elementsRef.current }),
        })
        if (!res.ok) throw new Error('save failed')
        setSaving('saved')
        setTimeout(() => setSaving('idle'), 1200)
      } catch {
        setSaving('idle')
      }
    }, 900)
  }, [])

  const primarySelectedId = selectedIds[0] ?? null
  const selected = useMemo(() => (primarySelectedId ? elements.find(e => e.id === primarySelectedId) : undefined), [elements, primarySelectedId])
  const selectedTarget = useMemo(() => (primarySelectedId ? elementRefs.current.get(primarySelectedId) ?? null : null), [primarySelectedId, elements])
  const studentById = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of students) m.set(s.id, s.foreName)
    return m
  }, [students])

  const readOnly = viewMode === 'lead'
  const currentRoom = useMemo(() => rooms.find(r => r.id === roomId) || null, [rooms, roomId])
  const roomNameStartsWithW = useMemo(() => {
    const n = (currentRoom?.name || '').trim()
    return n.length > 0 && n[0].toUpperCase() === 'W'
  }, [currentRoom])
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
      return [...visited]
    }
    if (!srcEl) return
    if (opts?.detach) {
      // Detach: remove all joints of dragged element before checking attach
      historyCommit()
      setElements(prev => prev.map(e => e.id === id ? { ...e, meta: { ...(e.meta || {}), joints: [] } } : e))
    }
    // if dragged over >=50% of another student seat: perform swap semantics
    if (srcEl.type === 'STUDENT') {
      const getStudentPairPartner = (el: Element): { partner?: Element } | null => {
        const js: any[] = Array.isArray(el.meta?.joints) ? el.meta!.joints : []
        const p = js.find((j: any) => j.kind === 'pair')
        if (!p) return null
        const partner = elements.find(e => e.id === p.otherId)
        return partner ? { partner } : null
      }
      const srcPair = getStudentPairPartner(srcEl)
      const sourceUnitIds = srcPair?.partner ? [srcEl.id!, srcPair.partner.id!] : [srcEl.id!]
      const selectionSeedStudents = selectedIds
        .map(id => elements.find(e => e.id === id))
        .filter((e): e is Element => !!e && e.type === 'STUDENT')
        .map(e => e.id!)
      const sourceGroupIds = getGroupIds(selectionSeedStudents.length > 0 ? selectionSeedStudents : [srcEl.id!])
      const sourceGroupStudents = elements.filter(e => sourceGroupIds.includes(e.id!) && e.type === 'STUDENT').map(e => e.id!)
      // find target seat by >=50% Überdeckung, Kandidaten ohne Quellgruppe
      const candidates = elements.filter(e => e.type === 'STUDENT' && !sourceGroupIds.includes(e.id!))
      let targetSeat: Element | null = null
      let bestRatio = 0
      const a = srcEl
      const aArea = a.w * a.h
      for (const e of candidates) {
        const left = Math.max(a.x, e.x)
        const right = Math.min(a.x + a.w, e.x + e.w)
        const top = Math.max(a.y, e.y)
        const bottom = Math.min(a.y + a.h, e.y + e.h)
        const area = Math.max(0, right - left) * Math.max(0, bottom - top)
        const ratio = aArea > 0 && e.w * e.h > 0 ? (area / Math.min(aArea, e.w * e.h)) : 0
        if (ratio >= 0.5 && ratio > bestRatio) { bestRatio = ratio; targetSeat = e }
      }
      if (targetSeat) {
        // Für Gruppen (>1) Zielcluster geometrisch ableiten; Singles fallen unten in 1:1 zurück
        if (sourceGroupStudents.length > 1) {
        // Zielcluster geometrisch (layout-unabhängig) bestimmen – gleiche Zeile (Row-Band) um das Ziel
        const srcList = elements.filter(e => sourceGroupStudents.includes(e.id!))
        const targetCenterY = targetSeat.y + targetSeat.h / 2
        const sameRow = (e: Element) => {
          const cy = e.y + e.h / 2
          const band = Math.max(e.h, targetSeat.h) * 0.6
          return Math.abs(cy - targetCenterY) <= band
        }
        const tgtList = elements.filter(e => e.type === 'STUDENT' && !sourceGroupIds.includes(e.id!) && sameRow(e))

        // Greedy Matching Quelle↔Ziel mit Überdeckungs-/Nähe-Score, bis min(|A|, |B|)
        const start = dragStartPositions.current
        const area = (x: Element) => x.w * x.h
        type Cand = { aId: string; bId: string; score: number }
        const cands: Cand[] = []
        const center = (el: Element) => ({ cx: el.x + el.w / 2, cy: el.y + el.h / 2 })
        for (const s of srcList) {
          for (const t of tgtList) {
            const left = Math.max(s.x, t.x)
            const right = Math.min(s.x + s.w, t.x + t.w)
            const top = Math.max(s.y, t.y)
            const bottom = Math.min(s.y + s.h, t.y + t.h)
            const inter = Math.max(0, right - left) * Math.max(0, bottom - top)
            const denom = Math.min(area(s), area(t))
            const overlap = denom > 0 ? (inter / denom) : 0
            const { cx: sx, cy: sy } = center(s)
            const { cx: tx, cy: ty } = center(t)
            const dx = Math.abs(sx - tx) / Math.max(s.w, t.w)
            const dy = Math.abs(sy - ty) / Math.max(s.h, t.h)
            // Priorisiere echte Überdeckung, sonst Nähe innerhalb der Zeile
            const score = overlap > 0 ? (1 + overlap) : (1 / (1 + dx + 0.25 * dy))
            cands.push({ aId: s.id!, bId: t.id!, score })
          }
        }
        cands.sort((p, q) => q.score - p.score)
        const usedA = new Set<string>()
        const usedB = new Set<string>()
        const pairs: Array<{ aId: string; bId: string }> = []
        const want = Math.min(srcList.length, tgtList.length)
        for (const c of cands) {
          if (pairs.length >= want) break
          if (usedA.has(c.aId) || usedB.has(c.bId)) continue
          usedA.add(c.aId); usedB.add(c.bId)
          pairs.push({ aId: c.aId, bId: c.bId })
        }
        if (pairs.length > 0) {
          // wende alle gefundenen Paare in einem State-Update an
          setElements(prev => {
            const ref = new Map(prev.map(x => [x.id!, x.refId ?? null]))
            const changes = new Map<string, any>()
            for (const p of pairs) {
              changes.set(p.aId, ref.get(p.bId) ?? null)
              changes.set(p.bId, ref.get(p.aId) ?? null)
            }
            let next = prev.map(e => {
              let out = e
              if (changes.has(e.id!)) out = { ...out, refId: changes.get(e.id!) }
              if (start.size > 0 && start.has(e.id!)) out = { ...out, x: start.get(e.id!)!.x, y: start.get(e.id!)!.y }
              return out
            })
            const protectedIds = new Set<string>(pairs.flatMap(p => [p.aId, p.bId]))
            const seen = new Map<any, string>()
            next = next.map(e => {
              if (e.type !== 'STUDENT' || e.refId == null) return e
              const key = String(e.refId)
              const owner = seen.get(key)
              if (!owner) { seen.set(key, e.id!); return e }
              if (protectedIds.has(e.id!) && !protectedIds.has(owner)) { seen.set(key, e.id!); return next.map(x => x.id===owner?{...x, refId: null}:x) as any }
              if (!protectedIds.has(e.id!) && protectedIds.has(owner)) return { ...e, refId: null }
              return { ...e, refId: null }
            }) as any
            return Array.isArray(next) ? (Array.isArray(next[0]) ? (next as any).flat() : next) : prev
          })
          scheduleSave()
          return
        }
        }
        // identify target unit (pair or single) – but swap strategy: always ensure 1:1 or 2:2, fallback 1:1
        const targetInfo = getStudentPairPartner(targetSeat)
        const targetPartner = targetInfo?.partner ?? null
        const sourceIsPair = sourceUnitIds.length === 2
        const targetIsPair = !!targetPartner && (elements.find(e => e.id === targetPartner!.id)?.type === 'STUDENT')

        const swap1to1 = (aId: string, bId: string) => {
          const start = dragStartPositions.current
          setElements(prev => {
            const ref = new Map(prev.map(x => [x.id!, x.refId ?? null]))
            const changes = new Map<string, any>([[aId, ref.get(bId) ?? null], [bId, ref.get(aId) ?? null]])
            // apply changes
            let next = prev.map(e => {
              let out = e
              if (changes.has(e.id!)) out = { ...out, refId: changes.get(e.id!) }
              if (start.size > 0 && start.has(e.id!)) out = { ...out, x: start.get(e.id!)!.x, y: start.get(e.id!)!.y }
              return out
            })
            // enforce unique refIds for affected students
            const protectedIds = new Set([aId, bId])
            const seen = new Map<any, string>()
            next = next.map(e => {
              if (e.type !== 'STUDENT' || e.refId == null) return e
              const key = String(e.refId)
              const owner = seen.get(key)
              if (!owner) { seen.set(key, e.id!); return e }
              // duplicate: prefer protected seat, else keep first
              if (protectedIds.has(e.id!) && !protectedIds.has(owner)) { seen.set(key, e.id!); return next.map(x => x.id===owner?{...x, refId: null}:x) as any }
              if (!protectedIds.has(e.id!) && protectedIds.has(owner)) return { ...e, refId: null }
              // neither or both protected: null this later duplicate
              return { ...e, refId: null }
            }) as any
            return Array.isArray(next) ? (Array.isArray(next[0]) ? (next as any).flat() : next) : prev
          })
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
          const start = dragStartPositions.current
          setElements(prev => {
            const ref = new Map(prev.map(x => [x.id!, x.refId ?? null]))
            const changes = new Map<string, any>([
              [A[0], ref.get(B[0]) ?? null],
              [A[1], ref.get(B[1]) ?? null],
              [B[0], ref.get(A[0]) ?? null],
              [B[1], ref.get(A[1]) ?? null],
            ])
            let next = prev.map(e => {
              let out = e
              if (changes.has(e.id!)) out = { ...out, refId: changes.get(e.id!) }
              if (start.size > 0 && start.has(e.id!)) out = { ...out, x: start.get(e.id!)!.x, y: start.get(e.id!)!.y }
              return out
            })
            const protectedIds = new Set([...A, ...B])
            const seen = new Map<any, string>()
            next = next.map(e => {
              if (e.type !== 'STUDENT' || e.refId == null) return e
              const key = String(e.refId)
              const owner = seen.get(key)
              if (!owner) { seen.set(key, e.id!); return e }
              if (protectedIds.has(e.id!) && !protectedIds.has(owner)) { seen.set(key, e.id!); return next.map(x => x.id===owner?{...x, refId: null}:x) as any }
              if (!protectedIds.has(e.id!) && protectedIds.has(owner)) return { ...e, refId: null }
              return { ...e, refId: null }
            }) as any
            return Array.isArray(next) ? (Array.isArray(next[0]) ? (next as any).flat() : next) : prev
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
        // geometry revert erfolgt innerhalb der swap setElements (ein Render)
        scheduleSave()
        return // do not proceed with snapping/jointing
      }
    }
    // Für Fenster/Wand: keine weitere automatische Ausrichtung/Snapping, um ungewollte Sprünge zu vermeiden
    if (srcEl && (srcEl.type === 'WINDOW_SIDE' || srcEl.type === 'WALL_SIDE')) {
      scheduleSave()
      return
    }
    setElements(prev => {
      const current = prev.find(e => e.id === id)
      if (!current) return prev
      if (opts?.detach) {
        // Remove all joints of element and counterparts
        const links: any[] = Array.isArray(current.meta?.joints) ? current.meta!.joints : []
        const otherIds = new Set(links.map(l => l.otherId))
        let next = prev.map(e => e.id === id ? { ...e, meta: { ...(e.meta || {}), joints: [] } } : e)
        next = next.map(e => otherIds.has(e.id!) ? { ...e, meta: { ...(e.meta || {}), joints: (Array.isArray(e.meta?.joints) ? (e.meta!.joints as any[]).filter((l: any) => l.otherId !== id) : []) } } : e)
        return next
      }
      // try to snap to nearest joints or create a joint on overlap
      const list = prev.map(x => ({ ...x }))
      const el = list.find(x => x.id === id)!
      const byId = new Map(list.map(x => [x.id!, x]))
      // try snapping against all others (one-shot computation)
      let snapped = false
      const others = list.filter(o => o.id !== el.id)
      const res = snapDeltaToNearest(el, others)
      if (res && (Math.abs(res.dx) > 0 || Math.abs(res.dy) > 0)) {
        el.x += res.dx
        el.y += res.dy
        snapped = true
      }
      if (!snapped) {
        // if intersects with one other, create a joint at edge midpoint
        let best: { other: Element; overlap: number } | null = null
        for (const other of list) {
          if (other.id === el.id) continue
          if (!intersects(el, other)) continue
          const left = Math.max(el.x, other.x)
          const right = Math.min(el.x + el.w, other.x + other.w)
          const top = Math.max(el.y, other.y)
          const bottom = Math.min(el.y + el.h, other.y + other.h)
          const ov = Math.max(0, right - left) * Math.max(0, bottom - top)
          if (!best || ov > best.overlap) best = { other, overlap: ov }
        }
        if (best) {
          const joint = computeEdgeJointRect({ x: el.x, y: el.y, w: el.w, h: el.h }, { x: best.other.x, y: best.other.y, w: best.other.w, h: best.other.h })
          if (joint) {
            addJoint(id, best.other.id!, joint.aSide, joint.bSide, joint.aT, joint.bT)
          }
        }
      }
      return list
    })
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
  // Track if we already auto-centered this session to avoid fighting user actions
  const autoCenterDoneRef = useRef(false)
  
  // Center elements helper (horizontally/vertically) using visual bounding boxes
  const centerAll = (mode: 'x' | 'y' | 'both' = 'x') => {
    if (readOnly) return
    if (elements.length === 0) return
    // compute visual bounds considering rotation
    let minL = Infinity, maxR = -Infinity, minT = Infinity, maxB = -Infinity
    for (const el of elements) {
      const rot = (((el.rotation || 0) % 360) + 360) % 360
      const rad = rot * Math.PI / 180
      const cos = Math.cos(rad)
      const sin = Math.sin(rad)
      const bbW = Math.abs(el.w * cos) + Math.abs(el.h * sin)
      const bbH = Math.abs(el.w * sin) + Math.abs(el.h * cos)
      const cx = el.x + el.w / 2
      const cy = el.y + el.h / 2
      const left = cx - bbW / 2
      const top = cy - bbH / 2
      const right = cx + bbW / 2
      const bottom = cy + bbH / 2
      if (left < minL) minL = left
      if (right > maxR) maxR = right
      if (top < minT) minT = top
      if (bottom > maxB) maxB = bottom
    }
    if (!isFinite(minL) || !isFinite(maxR) || !isFinite(minT) || !isFinite(maxB)) return
    const contentW = Math.max(0, maxR - minL)
    const contentH = Math.max(0, maxB - minT)
    const offsetX = (mode === 'x' || mode === 'both') ? ((frameSize.w - contentW) / 2 - minL) : 0
    const offsetY = (mode === 'y' || mode === 'both') ? ((frameSize.h - contentH) / 2 - minT) : 0
    if (offsetX === 0 && offsetY === 0) return
    setElements(prev => prev.map(el => ({ ...el, x: el.x + offsetX, y: el.y + offsetY })))
    scheduleSave()
    autoCenterDoneRef.current = true
  }

  // Default: auto-center horizontally once after load/first content
  useEffect(() => {
    if (readOnly) return
    if (autoCenterDoneRef.current) return
    if (!elements || elements.length === 0) return
    // compute visual bounds
    let minL = Infinity, maxR = -Infinity
    for (const el of elements) {
      const rot = (((el.rotation || 0) % 360) + 360) % 360
      const rad = rot * Math.PI / 180
      const cos = Math.cos(rad)
      const sin = Math.sin(rad)
      const bbW = Math.abs(el.w * cos) + Math.abs(el.h * sin)
      const cx = el.x + el.w / 2
      const left = cx - bbW / 2
      const right = cx + bbW / 2
      if (left < minL) minL = left
      if (right > maxR) maxR = right
    }
    if (!isFinite(minL) || !isFinite(maxR)) return
    const contentW = Math.max(0, maxR - minL)
    const offsetX = ((frameSize.w - contentW) / 2 - minL)
    if (Math.abs(offsetX) < 0.5) { autoCenterDoneRef.current = true; return }
    setElements(prev => prev.map(el => ({ ...el, x: el.x + offsetX })))
    scheduleSave()
    autoCenterDoneRef.current = true
  }, [elements, frameSize.w, readOnly])
  
  // Keyboard: copy/paste/select-all/delete
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (pickerOpenId) return // don't handle global shortcuts when picker open
      const target = e.target as HTMLElement | null
      const isEditable = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || (target as any).isContentEditable)
      if (isEditable) return
      // Arrow keys: nudge selected elements
      if (
        (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')
      ) {
        if (readOnly || !primarySelectedId) return
        e.preventDefault()
        // Larger default steps; Shift for coarse, Alt for fine
        const step = e.shiftKey ? 20 : (e.altKey ? 1 : 5)
        let dx = 0, dy = 0
        if (e.key === 'ArrowUp') dy = -step
        else if (e.key === 'ArrowDown') dy = step
        else if (e.key === 'ArrowLeft') dx = -step
        else if (e.key === 'ArrowRight') dx = step
        // mark as manual interaction to avoid auto-centering afterwards
        try { autoCenterDoneRef.current = true } catch {}
        moveElementBy(primarySelectedId, dx, dy)
        scheduleSave()
        return
      }
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

  const exportPng = async () => {
    if (!canvasRef.current) return
    const { toPng } = await import('html-to-image')
    const dataUrl = await toPng(canvasRef.current, { cacheBust: true, pixelRatio: 2 })
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `sitzplan-${classId}-${roomId}.png`
    a.click()
  }
  const exportPdf = async () => {
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

  // Try to create a joint by clicking the shared edge between two boxes
  const findJointCandidate = (x: number, y: number, tol = 12): null | { aId: string; bId: string; aSide: Side; bSide: Side; aT: number; bT: number } => {
    if (readOnly) return null
    type Hit = { aId: string; bId: string; aSide: Side; bSide: Side; aT: number; bT: number; dist: number }
    let best: Hit | null = null
    const N = elements.length
    for (let i = 0; i < N; i++) {
      const a = elements[i]
      for (let j = i + 1; j < N; j++) {
        const b = elements[j]
        // Horizontal adjacency (vertical edge between a.right and b.left)
        const vOverlapTop = Math.max(a.y, b.y)
        const vOverlapBottom = Math.min(a.y + a.h, b.y + b.h)
        const vOverlap = Math.max(0, vOverlapBottom - vOverlapTop)
        if (vOverlap > 0) {
          const aRight = a.x + a.w
          const bLeft = b.x
          const bRight = b.x + b.w
          const aLeft = a.x
          // a.right ~ b.left
          if (Math.abs(aRight - bLeft) <= tol) {
            const edgeX = (aRight + bLeft) / 2
            const withinY = y >= (vOverlapTop - tol) && y <= (vOverlapBottom + tol)
            const dist = Math.abs(x - edgeX)
            if (withinY && dist <= tol) {
              const aT = (Math.min(Math.max(y, a.y), a.y + a.h) - a.y) / a.h
              const bT = (Math.min(Math.max(y, b.y), b.y + b.h) - b.y) / b.h
              const hit: Hit = { aId: a.id!, bId: b.id!, aSide: 'right', bSide: 'left', aT, bT, dist }
              if (!best || dist < best.dist) best = hit
            }
          }
          // b.right ~ a.left
          if (Math.abs(bRight - aLeft) <= tol) {
            const edgeX = (bRight + aLeft) / 2
            const withinY = y >= (vOverlapTop - tol) && y <= (vOverlapBottom + tol)
            const dist = Math.abs(x - edgeX)
            if (withinY && dist <= tol) {
              const aT = (Math.min(Math.max(y, a.y), a.y + a.h) - a.y) / a.h
              const bT = (Math.min(Math.max(y, b.y), b.y + b.h) - b.y) / b.h
              const hit: Hit = { aId: a.id!, bId: b.id!, aSide: 'left', bSide: 'right', aT, bT, dist }
              if (!best || dist < best.dist) best = hit
            }
          }
        }
        // Vertical adjacency (horizontal edge between a.bottom and b.top)
        const hOverlapLeft = Math.max(a.x, b.x)
        const hOverlapRight = Math.min(a.x + a.w, b.x + b.w)
        const hOverlap = Math.max(0, hOverlapRight - hOverlapLeft)
        if (hOverlap > 0) {
          const aBottom = a.y + a.h
          const bTop = b.y
          const bBottom = b.y + b.h
          const aTop = a.y
          // a.bottom ~ b.top
          if (Math.abs(aBottom - bTop) <= tol) {
            const edgeY = (aBottom + bTop) / 2
            const withinX = x >= (hOverlapLeft - tol) && x <= (hOverlapRight + tol)
            const dist = Math.abs(y - edgeY)
            if (withinX && dist <= tol) {
              const aT = (Math.min(Math.max(x, a.x), a.x + a.w) - a.x) / a.w
              const bT = (Math.min(Math.max(x, b.x), b.x + b.w) - b.x) / b.w
              const hit: Hit = { aId: a.id!, bId: b.id!, aSide: 'bottom', bSide: 'top', aT, bT, dist }
              if (!best || dist < best.dist) best = hit
            }
          }
          // b.bottom ~ a.top
          if (Math.abs(bBottom - aTop) <= tol) {
            const edgeY = (bBottom + aTop) / 2
            const withinX = x >= (hOverlapLeft - tol) && x <= (hOverlapRight + tol)
            const dist = Math.abs(y - edgeY)
            if (withinX && dist <= tol) {
              const aT = (Math.min(Math.max(x, a.x), a.x + a.w) - a.x) / a.w
              const bT = (Math.min(Math.max(x, b.x), b.x + b.w) - b.x) / b.w
              const hit: Hit = { aId: a.id!, bId: b.id!, aSide: 'top', bSide: 'bottom', aT, bT, dist }
              if (!best || dist < best.dist) best = hit
            }
          }
        }
      }
    }
    if (!best) return null
    return { aId: best.aId, bId: best.bId, aSide: best.aSide, bSide: best.bSide, aT: best.aT, bT: best.bT }
  }

  const updateJointHover = (x: number, y: number): boolean => {
    const c = findJointCandidate(x, y)
    setJointHover(c)
    return !!c
  }

  const createJointFromCandidate = (c: { aId: string; bId: string; aSide: Side; bSide: Side; aT: number; bT: number }) => {
    historyCommit()
    addJoint(c.aId, c.bId, c.aSide, c.bSide, c.aT, c.bT)
    setJointHover(null)
    scheduleSave()
  }

  const tryCreateJointAt = (x: number, y: number): boolean => {
    const c = findJointCandidate(x, y)
    if (!c) return false
    createJointFromCandidate(c)
    return true
  }

  const addElement = (type: ElementType, refId?: string, at?: { x: number; y: number }) => {
    if (readOnly) return
    // Manual placement should not trigger the initial auto-center-on-first-content.
    try { autoCenterDoneRef.current = true } catch {}
    const startX = sidebarOpen ? 320 : 120
    // Larger default sizes to match bigger default font
    const baseFont = typeStyles[type]?.fontSize ?? 20
    // Special logic: STUDENT seats are always arranged on a grid in pairs
    if (type === 'STUDENT') {
      // 1) If a seat without assigned student exists, fill it
      if (refId) {
        const emptySeat = elements.find(e => e.type === 'STUDENT' && (e.refId == null))
        if (emptySeat) {
          setElements(prev => prev.map(e => e.id === emptySeat.id ? { ...e, refId } : e))
          scheduleSave()
          return
        }
      }
      // 2) Otherwise, create a new pair at the next free grid slot
      const seatW = 120
      const seatH = 70
      const marginX = 40
      const marginY = 60
      const betweenPairsX = 24
      const betweenRowsY = 24
      const pairWidth = seatW * 2
      const availW = Math.max(0, frameSize.w - marginX * 2)
      const perRow = Math.max(1, Math.floor((availW + betweenPairsX) / (pairWidth + betweenPairsX)))

      type Box = { left: number; top: number; right: number; bottom: number }
      const obstacles: Box[] = []
      for (const el of elements) {
        // approximate by unrotated AABB for simplicity (we mostly layout unrotated seats)
        const left = el.x
        const top = el.y
        const right = el.x + el.w
        const bottom = el.y + el.h
        obstacles.push({ left, top, right, bottom })
      }
      const rectsIntersect = (a: Box, b: Box) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom)
      const isFree = (x: number, y: number) => {
        const r1: Box = { left: x, top: y, right: x + seatW, bottom: y + seatH }
        const r2: Box = { left: x + seatW, top: y, right: x + seatW + seatW, bottom: y + seatH }
        for (const ob of obstacles) { if (rectsIntersect(r1, ob) || rectsIntersect(r2, ob)) return false }
        // inside frame
        if (x < 0 || y < 0) return false
        if (x + seatW * 2 > frameSize.w) return false
        if (y + seatH > frameSize.h) return false
        return true
      }
      let placedX = marginX
      let placedY = marginY
      let found = false
      // scan rows/cols
      for (let r = 0; r < 100 && !found; r++) {
        const y = marginY + r * (seatH + betweenRowsY)
        for (let c = 0; c < perRow; c++) {
          const x = marginX + c * (pairWidth + betweenPairsX)
          if (isFree(x, y)) { placedX = x; placedY = y; found = true; break }
        }
      }
      if (!found) {
        // fallback: place at start margins regardless
        placedX = marginX
        placedY = marginY
      }
      const pairId = uid('pair')
      const leftSeat: Element = { id: uid('el'), type: 'STUDENT', refId: null, x: placedX, y: placedY, w: seatW, h: seatH, rotation: 0, z: elements.length, groupId: null, meta: { fontSize: baseFont } }
      const rightSeat: Element = { id: uid('el'), type: 'STUDENT', refId: null, x: placedX + seatW, y: placedY, w: seatW, h: seatH, rotation: 0, z: elements.length + 1, groupId: null, meta: { fontSize: baseFont } }
      const add = (arr: any[]|undefined, item:any)=>Array.isArray(arr)?[...arr,item]:[item]
      leftSeat.meta = { ...(leftSeat.meta||{}), joints: add(leftSeat.meta?.joints, { otherId: rightSeat.id, side: 'right', t: 0.5, kind: 'pair', pairId }) }
      rightSeat.meta = { ...(rightSeat.meta||{}), joints: add(rightSeat.meta?.joints, { otherId: leftSeat.id, side: 'left', t: 0.5, kind: 'pair', pairId }) }
      // Assign new student to the first free seat (left by default)
      if (refId) leftSeat.refId = refId
      setElements(prev => [...prev, leftSeat, rightSeat])
      scheduleSave()
      return
    }
    const base: Element = { id: uid('el'), type, refId: refId ?? null, x: at?.x ?? startX, y: at?.y ?? 120, w: 120, h: 70, rotation: 0, z: elements.length, groupId: null, meta: { fontSize: baseFont } }
    if (type === 'WINDOW_SIDE' || type === 'WALL_SIDE') {
      // Vertical bar: rotate 90°, thickness = h, length = w
      const margin = 16
      // ensure enough thickness for rotated label
      base.h = Math.max(24, baseFont + 8)
      // full-frame height length with margins, independent of students
      base.w = Math.max(160, frameSize.h - 2 * margin)
      // match counterpart length if exists
      const counterpartType: ElementType = type === 'WINDOW_SIDE' ? 'WALL_SIDE' : 'WINDOW_SIDE'
      const counterpart = elements.find(e => e.type === counterpartType)
      if (counterpart) base.w = Math.max(base.w, counterpart.w)
      base.rotation = 90
      // place near edge based on type
      const thick = base.h
      const centerY = frameSize.h / 2
      const centerX = (type === 'WALL_SIDE') ? (margin + thick / 2) : (frameSize.w - margin - thick / 2)
      base.x = centerX - base.w / 2
      base.y = (frameSize.h - thick) / 2
    }
    if (type === 'DOOR') {
      // Breiter und höher, damit die Beschriftung vollständig passt
      base.w = 120; base.h = 32
      if (!at) {
        const margin = 16
        const strongGap = 28
        // align with teacher row if possible; Tür unter rechtester Schülerspalte
        const teacher = elements.find(e => e.type === 'TEACHER_DESK') || null
        const studs = elements.filter(e => e.type === 'STUDENT')
        let targetY: number
        if (teacher) {
          targetY = teacher.y
        } else if (studs.length > 0) {
          const minY = Math.min(...studs.map(s => s.y))
          const avgH = studs.reduce((a, s) => a + s.h, 0) / studs.length
          const tol = Math.max(24, 0.6 * avgH)
          const firstRow = studs.filter(s => s.y <= minY + tol)
          const firstRowBottom = Math.max(...firstRow.map(s => s.y + s.h))
          targetY = Math.min(frameSize.h - base.h - margin, firstRowBottom + strongGap)
        } else {
          targetY = Math.max(0, frameSize.h - margin - base.h)
        }
        // Build inflated obstacles with clearances
        type Box = { left: number; top: number; right: number; bottom: number }
        const obstacles: Box[] = []
        for (const el of elements) {
          const rot = (((el.rotation || 0) % 360) + 360) % 360
          const rad = rot * Math.PI / 180
          const cos = Math.cos(rad)
          const sin = Math.sin(rad)
          const bbW = Math.abs(el.w * cos) + Math.abs(el.h * sin)
          const bbH = Math.abs(el.w * sin) + Math.abs(el.h * cos)
          const cx = el.x + el.w / 2
          const cy = el.y + el.h / 2
          let left = cx - bbW / 2
          let top = cy - bbH / 2
          let right = cx + bbW / 2
          let bottom = cy + bbH / 2
          const clearance = el.type === 'STUDENT' ? 32 : (el.type === 'WINDOW_SIDE' || el.type === 'WALL_SIDE') ? 20 : 12
          left -= clearance; top -= clearance; right += clearance; bottom += clearance
          obstacles.push({ left, top, right, bottom })
        }
        const xDomainL = margin
        const xDomainR = Math.max(xDomainL, frameSize.w - margin - base.w)
        const forbiddenXIntervals = (y: number): Array<[number, number]> => {
          const T = y, B = y + base.h
          const acc: Array<[number, number]> = []
          for (const b of obstacles) { if (!(B <= b.top || T >= b.bottom)) acc.push([b.left - base.w, b.right]) }
          acc.sort((a,b) => a[0] - b[0])
          const merged: Array<[number, number]> = []
          for (const iv of acc) { if (!merged.length || iv[0] > merged[merged.length - 1][1]) merged.push([iv[0], iv[1]]); else merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], iv[1]) }
          return merged
        }
        const tryRightmostAtY = (y: number): number | null => {
          const merged = forbiddenXIntervals(y)
          let cur = xDomainL
          const gaps: Array<[number, number]> = []
          for (const [s, e] of merged) { if (e <= xDomainL) { cur = Math.max(cur, e); continue } if (s > xDomainR) break; if (s > cur) gaps.push([cur, Math.min(s, xDomainR)]); cur = Math.max(cur, e) }
          if (cur < xDomainR) gaps.push([cur, xDomainR])
          if (gaps.length === 0) return null
          const [gL, gR] = gaps[gaps.length - 1]
          const px = gR - base.w
          return px >= gL ? px : null
        }
        const tryNearestToX = (y: number, desiredX: number): number | null => {
          const merged = forbiddenXIntervals(y)
          let cur = xDomainL
          const gaps: Array<[number, number]> = []
          for (const [s, e] of merged) { if (e <= xDomainL) { cur = Math.max(cur, e); continue } if (s > xDomainR) break; if (s > cur) gaps.push([cur, Math.min(s, xDomainR)]); cur = Math.max(cur, e) }
          if (cur < xDomainR) gaps.push([cur, xDomainR])
          if (gaps.length === 0) return null
          let bestX: number | null = null
          let bestD = Infinity
          for (const [gL, gR] of gaps) {
            const px = Math.min(Math.max(desiredX, gL), gR - base.w)
            if (px < gL || px > gR - base.w) continue
            const center = px + base.w / 2
            const d = Math.abs(center - (desiredX + base.w / 2))
            if (d < bestD) { bestD = d; bestX = px }
          }
          return bestX
        }
        // desired x based on room preference: W-rooms: align under window center, else rightmost at y
        if (roomNameStartsWithW) {
          const windowBar = elements.find(e => e.type === 'WINDOW_SIDE')
          const desiredX = windowBar ? (windowBar.x + windowBar.w / 2 - base.w / 2) : (frameSize.w - margin - base.w)
          let placed = false
          const yMin = Math.min(targetY, frameSize.h - margin - base.h)
          const yMax = Math.max(yMin, frameSize.h - margin - base.h)
          for (let y = yMin; y <= yMax; y += 6) { const px = tryNearestToX(y, desiredX); if (px !== null) { base.x = px; base.y = y; placed = true; break } }
          if (!placed) {
            const lastY = frameSize.h - margin - base.h
            const px = tryNearestToX(lastY, desiredX)
            if (px !== null) { base.x = px; base.y = lastY }
            else { base.x = Math.max(margin, Math.min(frameSize.w - margin - base.w, desiredX)); base.y = lastY }
          }
        } else {
          // Default: rightmost spot at given y
          const x = tryRightmostAtY(targetY)
          if (x !== null) { base.x = x; base.y = targetY }
          else {
            // Fallback: try bottom row with same logic
            const lastY = frameSize.h - margin - base.h
            const px = tryRightmostAtY(lastY)
            if (px !== null) { base.x = px; base.y = lastY }
            else { base.x = xDomainR; base.y = lastY }
          }
        }
      } else {
        base.x = at.x; base.y = at.y
      }
    }
    if (type === 'TEACHER_DESK') {
      base.w = 260; base.h = 80
      if (!at) {
        const margin = 16
        const strongGap = 28
        // Prefer under first row of students, x aligned with wall for W-rooms
        const studs = elements.filter(e => e.type === 'STUDENT')
        if (roomNameStartsWithW) {
          const wall = elements.find(e => e.type === 'WALL_SIDE')
          if (wall) {
            const centerX = wall.x + wall.w / 2
            const minY = studs.length > 0 ? Math.min(...studs.map(s => s.y)) : 0
            const avgH = studs.length > 0 ? studs.reduce((a, s) => a + s.h, 0) / studs.length : base.h
            const tol = Math.max(24, 0.6 * avgH)
            const firstRow = studs.filter(s => s.y <= minY + tol)
            const firstRowBottom = firstRow.length > 0 ? Math.max(...firstRow.map(s => s.y + s.h)) : 0
            const targetY = Math.min(frameSize.h - base.h - margin, firstRowBottom + strongGap)
            const xDomainL = margin
            const xDomainR = Math.max(xDomainL, frameSize.w - margin - base.w)
            const desiredX = centerX - base.w / 2
            const lastY = Math.max(0, Math.min(frameSize.h - base.h, targetY))
            base.x = Math.max(xDomainL, Math.min(xDomainR, desiredX))
            base.y = lastY
          }
        } else {
          const minY = studs.length > 0 ? Math.min(...studs.map(s => s.y)) : 0
          const avgH = studs.length > 0 ? studs.reduce((a, s) => a + s.h, 0) / studs.length : base.h
          const tol = Math.max(24, 0.6 * avgH)
          const firstRow = studs.filter(s => s.y <= minY + tol)
          const firstRowBottom = firstRow.length > 0 ? Math.max(...firstRow.map(s => s.y + s.h)) : 0
          const targetY = Math.min(frameSize.h - base.h - margin, firstRowBottom + strongGap)
          base.x = roomNameStartsWithW ? margin : Math.max(0, frameSize.w - margin - base.w)
          base.y = Math.max(0, frameSize.h - margin - base.h)
          base.y = targetY
        }
      }
    }
    // Beim Hinzufügen immer neu ausrichten, damit Reihenfolge egal ist
    setElements(prev => realignFixedElements([...prev, base]))
    scheduleSave()
  }

  return {
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
    tryCreateJointAt, updateJointHover, jointHover, setJointHover, createJointFromCandidate,
    markManual: () => { autoCenterDoneRef.current = true },
    centerAll,
    undo, redo, canUndo, canRedo, historyCommit,
    applySidesPairsCenterFour,
    applySidesPairsCenterFourAngled: () => applySidesPairsCenterFour({ angled: true }),
    applyHorseshoeLayout,
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
          historyCommit()
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
        historyCommit()
        setElements((prev: any) => prev.map((x: any) => x.id === el.id ? { ...x, meta: { ...(x.meta || {}), label: val } } : x))
        scheduleSave()
      }
    },
    onMoveableResize: (e: any) => {
      if (!primarySelectedId) return
      const { width, height, drag, direction } = e
      // Pre-compute new length (w) for the selected element to sync counterpart
      const sel = elements.find(x => x.id === primarySelectedId)
      if (!sel) return
      let selNewW = Math.max(10, width)
      let selNewH = Math.max(10, height)
      const selLineLike = sel.type === 'DOOR' || sel.type === 'WINDOW_SIDE' || sel.type === 'WALL_SIDE'
      if (selLineLike) {
        const rot = ((sel.rotation % 360) + 360) % 360
        const horizontal = (Math.round(rot / 90) % 2) === 0
        if (horizontal) selNewH = sel.h
        else selNewW = sel.w
      }
      const counterpartType: ElementType | null = sel.type === 'WINDOW_SIDE' ? 'WALL_SIDE' : (sel.type === 'WALL_SIDE' ? 'WINDOW_SIDE' : null)

      setElements((prev: any) => prev.map((x: any) => {
        if (x.id === primarySelectedId) {
          // Apply the same logic as pre-compute for the selected element
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
        }
        // Keep window and wall the same length (w) by syncing counterpart(s)
        if (counterpartType && x.type === counterpartType) {
          return { ...x, w: selNewW }
        }
        return x
      }))
    },
  }
}

export type EditorState = ReturnType<typeof useEditorState>
