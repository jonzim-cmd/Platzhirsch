import type { Element } from './editorTypes'

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}

// Axis-aligned bounding box intersection (rotation ignored)
export function intersects(a: Element, b: Element) {
  const ar = { left: a.x, top: a.y, right: a.x + a.w, bottom: a.y + a.h }
  const br = { left: b.x, top: b.y, right: b.x + b.w, bottom: b.y + b.h }
  return !(ar.right < br.left || ar.left > br.right || ar.bottom < br.top || ar.top > br.bottom)
}

export function overlapAmount(a1: number, a2: number, b1: number, b2: number) {
  const left = Math.max(a1, b1)
  const right = Math.min(a2, b2)
  return Math.max(0, right - left)
}

// True if overlapping or edges touch within a small tolerance
export function touchesOrIntersects(a: Element | undefined | null, b: Element | undefined | null, tol = 0.5) {
  if (!a || !b) return false
  const vOverlap = overlapAmount(a.y, a.y + a.h, b.y, b.y + b.h)
  const hOverlap = overlapAmount(a.x, a.x + a.w, b.x, b.x + b.w)
  if (vOverlap > 0 && Math.abs((a.x + a.w) - b.x) <= tol) return true
  if (vOverlap > 0 && Math.abs(a.x - (b.x + b.w)) <= tol) return true
  if (hOverlap > 0 && Math.abs((a.y + a.h) - b.y) <= tol) return true
  if (hOverlap > 0 && Math.abs(a.y - (b.y + b.h)) <= tol) return true
  return intersects(a as Element, b as Element)
}

// Snap a to nearest edges of others within threshold; returns best delta
export function snapDeltaToNearest(a: Element, others: Element[], threshold = 8) {
  let best: { dx: number; dy: number } | null = null
  for (const b of others) {
    // vertical overlap for horizontal snapping
    const vOverlap = overlapAmount(a.y, a.y + a.h, b.y, b.y + b.h)
    if (vOverlap > 0) {
      const d1 = b.x - a.x
      if (Math.abs(d1) <= threshold) best = (!best || Math.abs(d1) < Math.hypot(best.dx, best.dy)) ? { dx: d1, dy: 0 } : best
      const d2 = (b.x + b.w) - (a.x + a.w)
      if (Math.abs(d2) <= threshold) best = (!best || Math.abs(d2) < Math.hypot(best.dx, best.dy)) ? { dx: d2, dy: 0 } : best
      const d3 = b.x - (a.x + a.w)
      if (Math.abs(d3) <= threshold) best = (!best || Math.abs(d3) < Math.hypot(best.dx, best.dy)) ? { dx: d3, dy: 0 } : best
      const d4 = (b.x + b.w) - a.x
      if (Math.abs(d4) <= threshold) best = (!best || Math.abs(d4) < Math.hypot(best.dx, best.dy)) ? { dx: d4, dy: 0 } : best
    }
    // horizontal overlap for vertical snapping
    const hOverlap = overlapAmount(a.x, a.x + a.w, b.x, b.x + b.w)
    if (hOverlap > 0) {
      const d5 = b.y - a.y
      if (Math.abs(d5) <= threshold) best = (!best || Math.abs(d5) < Math.hypot(best.dx, best.dy)) ? { dx: 0, dy: d5 } : best
      const d6 = (b.y + b.h) - (a.y + a.h)
      if (Math.abs(d6) <= threshold) best = (!best || Math.abs(d6) < Math.hypot(best.dx, best.dy)) ? { dx: 0, dy: d6 } : best
      const d7 = b.y - (a.y + a.h)
      if (Math.abs(d7) <= threshold) best = (!best || Math.abs(d7) < Math.hypot(best.dx, best.dy)) ? { dx: 0, dy: d7 } : best
      const d8 = (b.y + b.h) - a.y
      if (Math.abs(d8) <= threshold) best = (!best || Math.abs(d8) < Math.hypot(best.dx, best.dy)) ? { dx: 0, dy: d8 } : best
    }
  }
  return best
}

