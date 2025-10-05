"use client"
import { Button } from '@/components/ui/Button'
import { Z } from '@/components/ui/zIndex'
import { useEditor } from '@/components/editor/EditorContext'

export function EditorHeader() {
  const { leadPlan, viewMode, setViewMode, saving } = useEditor()
  return (
    <div className="pointer-events-auto absolute right-0 top-0 flex items-center gap-2 text-xs" style={{ zIndex: Z.toolbar }}>
      <SaveGroup />
      {leadPlan && (
        <div className="ml-2 flex items-center gap-2">
          <span className="text-fg-muted">Ansicht:</span>
          <Button onClick={() => setViewMode('owner')} className={viewMode==='owner'?'text-primary':''}>Eigen</Button>
          <Button onClick={() => setViewMode('lead')} className={viewMode==='lead'?'text-primary':''}>KL</Button>
        </div>
      )}
    </div>
  )
}

function SaveGroup() {
  const { undo, canUndo, readOnly, saving } = useEditor()
  const disabled = readOnly || !canUndo
  return (
    <div className="mr-2 flex items-center gap-2 rounded bg-bg pl-2 pr-0 py-1">
      <div className="leading-none text-fg-muted select-none">
        {saving === 'saving' && <span>Speichern…</span>}
        {saving === 'saved' && <span className="text-primary">Gespeichert</span>}
      </div>
      <button
        type="button"
        aria-label="Rückgängig"
        title="Rückgängig (⌘Z / Ctrl+Z)"
        disabled={disabled}
        onClick={() => undo?.()}
        className="inline-flex items-center justify-center rounded text-fg disabled:opacity-50 hover:bg-neutral-800/40 px-3 py-1"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 7v6h6" />
          <path d="M3.51 15.49A9 9 0 1 0 5.64 5.64L3 8.29" />
        </svg>
      </button>
    </div>
  )
}
