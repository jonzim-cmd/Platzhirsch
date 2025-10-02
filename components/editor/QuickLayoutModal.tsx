"use client"
import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { QuickLayoutParams, LayoutPreset } from './layout'

export function QuickLayoutModal({ open, onClose, onApply }: {
  open: boolean
  onClose: () => void
  onApply: (params: QuickLayoutParams & { autoAssign: boolean; replaceStudents: boolean }) => void
}) {
  const [preset, setPreset] = useState<LayoutPreset>('PAIRS')
  const [rows, setRows] = useState(4)
  const [cols, setCols] = useState(5)
  const [seatWidth, setSeatWidth] = useState(120)
  const [seatHeight, setSeatHeight] = useState(70)
  const [spacingX, setSpacingX] = useState(24)
  const [spacingY, setSpacingY] = useState(24)
  const [pairGap, setPairGap] = useState(12)
  const [marginX, setMarginX] = useState(40)
  const [marginY, setMarginY] = useState(60)
  const [aisleEveryCols, setAisleEveryCols] = useState(0)
  const [aisleWidth, setAisleWidth] = useState(40)
  const [autoAssign, setAutoAssign] = useState(true)
  const [replaceStudents, setReplaceStudents] = useState(true)

  if (!open) return null
  return (
    <Modal onClose={onClose}>
      <div className="w-full max-w-2xl rounded border border-neutral-800 bg-neutral-950 p-4 text-sm">
        <div className="text-base font-semibold mb-3">Schnellauswahl Sitzplan</div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-xs text-fg-muted">Vorlage</span>
            <select value={preset} onChange={e => setPreset(e.target.value as LayoutPreset)} className="rounded bg-neutral-900 px-2 py-2 border border-neutral-800">
              <option value="PAIRS">Paare</option>
              <option value="SINGLES">Einzeltische</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Reihen" value={rows} onChange={(e:any)=>setRows(parseInt(e.target.value||'0')||0)} />
            <Input label="Spalten" value={cols} onChange={(e:any)=>setCols(parseInt(e.target.value||'0')||0)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Sitz Breite" value={seatWidth} onChange={(e:any)=>setSeatWidth(parseInt(e.target.value||'0')||0)} />
            <Input label="Sitz Höhe" value={seatHeight} onChange={(e:any)=>setSeatHeight(parseInt(e.target.value||'0')||0)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Abstand X" value={spacingX} onChange={(e:any)=>setSpacingX(parseInt(e.target.value||'0')||0)} />
            <Input label="Abstand Y" value={spacingY} onChange={(e:any)=>setSpacingY(parseInt(e.target.value||'0')||0)} />
          </div>
          {preset === 'PAIRS' && (
            <Input label="Abstand im Paar" value={pairGap} onChange={(e:any)=>setPairGap(parseInt(e.target.value||'0')||0)} />
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Rand X" value={marginX} onChange={(e:any)=>setMarginX(parseInt(e.target.value||'0')||0)} />
            <Input label="Rand Y" value={marginY} onChange={(e:any)=>setMarginY(parseInt(e.target.value||'0')||0)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Gang alle N Spalten" value={aisleEveryCols} onChange={(e:any)=>setAisleEveryCols(parseInt(e.target.value||'0')||0)} />
            <Input label="Gang-Breite" value={aisleWidth} onChange={(e:any)=>setAisleWidth(parseInt(e.target.value||'0')||0)} />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={autoAssign} onChange={e=>setAutoAssign(e.target.checked)} />
            <span>Schüler automatisch zuordnen</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={replaceStudents} onChange={e=>setReplaceStudents(e.target.checked)} />
            <span>Vorhandene Sitzplätze ersetzen</span>
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" onClick={() => onApply({ preset, rows, cols, seatWidth, seatHeight, spacingX, spacingY, pairGap, marginX, marginY, aisleEveryCols, aisleWidth, autoAssign, replaceStudents })}>Übernehmen</Button>
        </div>
      </div>
    </Modal>
  )
}

