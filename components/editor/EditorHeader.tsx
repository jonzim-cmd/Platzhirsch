"use client"
import { Button } from '@/components/ui/Button'
import { Z } from '@/components/ui/zIndex'
import { useEditor } from '@/components/editor/EditorContext'

export function EditorHeader() {
  const { leadPlan, viewMode, setViewMode, saving } = useEditor()
  return (
    <div className="pointer-events-auto absolute right-3 top-3 flex items-center gap-2 text-xs" style={{ zIndex: Z.toolbar }}>
      {/* Undo button */}
      <UndoButton />
      {leadPlan && (
        <div className="ml-2 flex items-center gap-2">
          <span className="text-fg-muted">Ansicht:</span>
          <Button onClick={() => setViewMode('owner')} className={viewMode==='owner'?'text-primary':''}>Eigen</Button>
          <Button onClick={() => setViewMode('lead')} className={viewMode==='lead'?'text-primary':''}>KL</Button>
        </div>
      )}
      <div className="text-fg-muted">
        {saving === 'saving' && <span className="ml-3">Speichern…</span>}
        {saving === 'saved' && <span className="ml-3 text-primary">Gespeichert</span>}
      </div>
    </div>
  )
}

function UndoButton() {
  const { undo, canUndo, readOnly } = useEditor()
  const disabled = readOnly || !canUndo
  return (
    <Button aria-label="Rückgängig" title="Rückgängig (⌘Z / Ctrl+Z)" disabled={disabled} onClick={() => undo?.()}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="9 14 4 9 9 4" />
        <path d="M20 20a8 8 0 0 0-8-8H4" />
      </svg>
    </Button>
  )
}
