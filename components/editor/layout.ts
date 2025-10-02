export type LayoutPreset = 'PAIRS' | 'SINGLES'

export type QuickLayoutParams = {
  preset: LayoutPreset
  rows: number
  cols: number
  seatWidth: number
  seatHeight: number
  spacingX: number
  spacingY: number
  pairGap: number
  marginX: number
  marginY: number
  aisleEveryCols?: number
  aisleWidth?: number
}

export type SeatPos = { x: number; y: number; w: number; h: number; pairId?: string; pairSide?: 'left' | 'right' }

export function generateQuickLayoutPositions(params: QuickLayoutParams, frameW: number, frameH: number): SeatPos[] {
  const p = { ...params }
  const seats: SeatPos[] = []
  const rowCount = Math.max(1, Math.floor(p.rows))
  const colCount = Math.max(1, Math.floor(p.cols))

  // compute per-column block width depending on preset
  const unitWidth = p.preset === 'PAIRS' ? (p.seatWidth * 2 + p.pairGap) : p.seatWidth
  let x = p.marginX
  let y = p.marginY

  for (let r = 0; r < rowCount; r++) {
    x = p.marginX
    for (let c = 0; c < colCount; c++) {
      // aisle
      if (p.aisleEveryCols && p.aisleEveryCols > 0 && c > 0 && c % p.aisleEveryCols === 0) {
        x += p.aisleWidth || 0
      }
      if (p.preset === 'PAIRS') {
        const pairId = `r${r}c${c}`
        seats.push({ x, y, w: p.seatWidth, h: p.seatHeight, pairId, pairSide: 'left' })
        seats.push({ x: x + p.seatWidth + p.pairGap, y, w: p.seatWidth, h: p.seatHeight, pairId, pairSide: 'right' })
      } else {
        seats.push({ x, y, w: p.seatWidth, h: p.seatHeight })
      }
      x += unitWidth + p.spacingX
    }
    y += p.seatHeight + p.spacingY
  }

  // clamp to frame bounds (best effort)
  return seats.filter(s => s.x < frameW && s.y < frameH)
}

