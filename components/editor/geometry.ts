export type Side = 'left' | 'right' | 'top' | 'bottom'

export function sideAnchorWH(w: number, h: number, side: Side, t: number) {
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
  const tt = clamp(t, 0, 1)
  if (side === 'left') return { left: -12, top: h * tt - 12 }
  if (side === 'right') return { left: w - 12, top: h * tt - 12 }
  if (side === 'top') return { left: w * tt - 12, top: -12 }
  return { left: w * tt - 12, top: h - 12 }
}

type Rect = { x: number; y: number; w: number; h: number }

export function computeEdgeJointRect(a: Rect, b: Rect): { aSide: Side; bSide: Side; aT: number; bT: number } | null {
  const vOverlap = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
  const hOverlap = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
  const tol = 0.75
  if (vOverlap > 0) {
    if (Math.abs((a.x + a.w) - b.x) <= tol) {
      const top = Math.max(a.y, b.y)
      const bottom = Math.min(a.y + a.h, b.y + b.h)
      const aT = ((top + bottom) / 2 - a.y) / a.h
      const bT = ((top + bottom) / 2 - b.y) / b.h
      return { aSide: 'right', bSide: 'left', aT, bT }
    }
    if (Math.abs(a.x - (b.x + b.w)) <= tol) {
      const top = Math.max(a.y, b.y)
      const bottom = Math.min(a.y + a.h, b.y + b.h)
      const aT = ((top + bottom) / 2 - a.y) / a.h
      const bT = ((top + bottom) / 2 - b.y) / b.h
      return { aSide: 'left', bSide: 'right', aT, bT }
    }
  }
  if (hOverlap > 0) {
    if (Math.abs((a.y + a.h) - b.y) <= tol) {
      const left = Math.max(a.x, b.x)
      const right = Math.min(a.x + a.w, b.x + b.w)
      const aT = ((left + right) / 2 - a.x) / a.w
      const bT = ((left + right) / 2 - b.x) / b.w
      return { aSide: 'bottom', bSide: 'top', aT, bT }
    }
    if (Math.abs(a.y - (b.y + b.h)) <= tol) {
      const left = Math.max(a.x, b.x)
      const right = Math.min(a.x + a.w, b.x + b.w)
      const aT = ((left + right) / 2 - a.x) / a.w
      const bT = ((left + right) / 2 - b.x) / b.w
      return { aSide: 'top', bSide: 'bottom', aT, bT }
    }
  }
  // Overlap: choose nearest edge pair
  const aCx = a.x + a.w / 2, aCy = a.y + a.h / 2
  const bCx = b.x + b.w / 2, bCy = b.y + b.h / 2
  const dx = bCx - aCx, dy = bCy - aCy
  if (Math.abs(dx) > Math.abs(dy)) {
    const top = Math.max(a.y, b.y)
    const bottom = Math.min(a.y + a.h, b.y + b.h)
    const aT = ((top + bottom) / 2 - a.y) / a.h
    const bT = ((top + bottom) / 2 - b.y) / b.h
    if (dx > 0) return { aSide: 'right', bSide: 'left', aT, bT }
    return { aSide: 'left', bSide: 'right', aT, bT }
  } else {
    const left = Math.max(a.x, b.x)
    const right = Math.min(a.x + a.w, b.x + b.w)
    const aT = ((left + right) / 2 - a.x) / a.w
    const bT = ((left + right) / 2 - b.x) / b.w
    if (dy > 0) return { aSide: 'bottom', bSide: 'top', aT, bT }
    return { aSide: 'top', bSide: 'bottom', aT, bT }
  }
}

