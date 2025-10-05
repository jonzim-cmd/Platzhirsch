"use client"
import { Button } from '@/components/ui/Button'
import { Z } from '@/components/ui/zIndex'
import { useEditor } from '@/components/editor/EditorContext'

export function EditorHeader() {
  const { leadPlan, viewMode, setViewMode, saving } = useEditor()
  return (
    <div className="pointer-events-auto absolute right-3 top-3 flex items-center gap-2 text-xs" style={{ zIndex: Z.toolbar }}>
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
  )
}

