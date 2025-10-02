"use client"
import { sideAnchorWH } from '@/components/editor/geometry'
import { Z } from '@/components/ui/zIndex'

type ElementLike = { id?: string; x: number; y: number; w: number; h: number; meta?: any }

export function JointOverlay({ elements, readOnly, onDetach, hoverCandidate, onCreate }: {
  elements: ElementLike[]
  readOnly: boolean
  onDetach: (aId: string, bId: string) => void
  hoverCandidate?: { aId: string; bId: string; aSide: 'left'|'right'|'top'|'bottom'; bSide: 'left'|'right'|'top'|'bottom'; aT: number; bT: number } | null
  onCreate?: (j: { aId: string; bId: string; aSide: 'left'|'right'|'top'|'bottom'; bSide: 'left'|'right'|'top'|'bottom'; aT: number; bT: number }) => void
}) {
  if (readOnly) return null
  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: Z.overlay }}>
      {/* Hover preview for creating a joint */}
      {hoverCandidate && (() => {
        const a = elements.find(e => e.id === hoverCandidate.aId)
        if (!a) return null
        const pos = sideAnchorWH(a.w, a.h, hoverCandidate.aSide, typeof hoverCandidate.aT === 'number' ? hoverCandidate.aT : 0.5)
        const left = a.x + pos.left
        const top = a.y + pos.top
        return (
          <button
            type="button"
            title="Heftung erstellen"
            className="absolute pointer-events-auto h-6 w-6 flex items-center justify-center text-neutral-500 hover:text-neutral-50"
            style={{ left, top }}
            onClick={(e) => { e.stopPropagation(); onCreate?.(hoverCandidate) }}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.85))' }}>
              {/* simple lock icon */}
              <path d="M8 11V8a4 4 0 118 0v3" />
              <rect x="6.5" y="11" width="11" height="8" rx="2" />
            </svg>
          </button>
        )
      })()}
      {elements.flatMap((el) => {
        const id = el.id!
        const joints: Array<{ otherId: string; side: any; t: number }>
          = Array.isArray(el.meta?.joints) ? (el.meta!.joints as any[]) : []
        return joints
          .filter(j => (id || '') < (j.otherId || ''))
          .map(j => {
            const a = sideAnchorWH(el.w, el.h, j.side as any, typeof j.t === 'number' ? j.t : 0.5)
            const left = el.x + a.left
            const top = el.y + a.top
            return (
              <button
                key={`${id}-${j.otherId}`}
                type="button"
                title="Heftung lösen"
                className="absolute pointer-events-auto h-6 w-6 flex items-center justify-center text-neutral-200 hover:text-neutral-50"
                style={{ left, top }}
                onClick={(e) => { e.stopPropagation(); onDetach(id, j.otherId) }}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.85))' }}>
                  {/* closed lock indicating fixed joint */}
                  <path d="M8 11V8a4 4 0 118 0v3" />
                  <rect x="6.5" y="11" width="11" height="8" rx="2" />
                  <path d="M12 14v2" />
                </svg>
              </button>
            )
          })
      })}
    </div>
  )
}
