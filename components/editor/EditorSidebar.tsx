"use client"
import { Button } from '@/components/ui/Button'
import { Z } from '@/components/ui/zIndex'
import { useEditor } from '@/components/editor/EditorContext'

export function EditorSidebar() {
  const ctx = useEditor()
  const { leadPlan, viewMode, setViewMode, saving, students, addElement, applyPairsLayout, usedStudentIds, selected, selectedIds, setElements, scheduleSave, exportPng, exportPdf, elements, classId, roomId, loadPlan } = ctx
  return (
    <aside className={`fixed left-0 top-[48px] h-[calc(100vh-48px)] w-72 transform border-r border-neutral-900 bg-bg-soft p-3 overflow-auto transition-transform ${ctx.sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`} style={{ zIndex: Z.toolbar }}>
      <div className="rounded border border-neutral-900 p-3 mb-3 grid gap-2">
        <div className="text-sm font-medium mb-1">Plan</div>
        {leadPlan && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-fg-muted">Ansicht:</span>
            <Button onClick={() => setViewMode('owner')} className={viewMode==='owner'?'text-primary':''}>Eigen</Button>
            <Button onClick={() => setViewMode('lead')} className={viewMode==='lead'?'text-primary':''}>KL</Button>
          </div>
        )}
        <div className="text-xs text-fg-muted">
          {saving === 'saving' && <span>Speichern…</span>}
          {saving === 'saved' && <span className="text-primary">Gespeichert</span>}
        </div>
      </div>
      {leadPlan && viewMode==='lead' && (
        <div className="rounded border border-neutral-900 p-3 grid gap-2">
          <div className="text-sm font-medium">KL-Plan</div>
          <div className="text-xs text-fg-muted">Du kannst den Plan der Klassenleitung ansehen. Änderungen sind hier nicht möglich.</div>
          {ctx.activeProfile && (
            <Button variant="primary" onClick={async () => { await fetch('/api/plan/copy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ownerProfileId: ctx.activeProfile!.id, classId, roomId, sourcePlanId: leadPlan!.id }) }); setViewMode('owner'); await loadPlan(false) }}>Als Kopie übernehmen</Button>
          )}
        </div>
      )}
      <div className="rounded border border-neutral-900 p-3">
        <div className="text-sm font-medium mb-2">Palette</div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => addElement('TEACHER_DESK')}>Lehrer</Button>
          <Button onClick={() => addElement('DOOR')}>Tür</Button>
          <Button onClick={() => addElement('WINDOW_SIDE')}>Fenster</Button>
          <Button onClick={() => addElement('WALL_SIDE')}>Wand</Button>
          <Button onClick={applyPairsLayout} variant="primary">Paare</Button>
          <Button onClick={() => ctx.applySidesPairsCenterFour()}>Seiten-Paare + Mitte 4er</Button>
          <Button onClick={() => ctx.applySidesPairsCenterFourAngled()}>Seiten-Paare (schräg) + Mitte 4er</Button>
          <Button onClick={ctx.applyHorseshoeLayout}>Hufeisen</Button>
        </div>
      </div>
      <div className="rounded border border-neutral-900 p-3">
        <div className="text-sm font-medium mb-2">Schüler hinzufügen</div>
        <div className="grid gap-2 max-h-[260px] overflow-auto">
          {students.map((s: any) => (
            <Button key={s.id} onClick={() => addElement('STUDENT', s.id)} className={`justify-start ${usedStudentIds.has(String(s.id)) ? 'opacity-60' : ''}`} disabled={usedStudentIds.has(String(s.id))}>
              <span className="flex-1 text-left">{s.foreName}</span>
              {usedStudentIds.has(String(s.id)) && <span className="text-green-400">✔</span>}
            </Button>
          ))}
          {students.length === 0 && <div className="text-xs text-fg-muted">Keine Schüler geladen.</div>}
        </div>
      </div>
      <div className="rounded border border-neutral-900 p-3 grid gap-2">
        <div className="text-sm font-medium">Auswahl</div>
        {!selected && <div className="text-xs text-fg-muted">Nichts ausgewählt</div>}
        {selected && (
          <>
            <div className="text-xs text-fg-muted">Typ: {selected.type}</div>
            <label className="text-xs text-fg-muted flex items-center gap-2">
              <span>Schriftgröße</span>
              <input type="range" min={8} max={24} value={selected.meta?.fontSize ?? 12} onChange={(e) => { const v = parseInt(e.target.value, 10); const selSet = new Set(selectedIds); setElements((prev: any) => prev.map((x: any) => selSet.has(x.id!) ? { ...x, meta: { ...(x.meta||{}), fontSize: v } } : x)); scheduleSave() }} />
              <span className="tabular-nums">{selected.meta?.fontSize ?? 12}px</span>
            </label>
            <div className="flex items-center gap-2">
              <Button onClick={() => { const sel = new Set(selectedIds); setElements((prev: any) => prev.map((el: any) => { if (!sel.has(el.id!)) return el; const links = Array.isArray(el.meta?.joints) ? el.meta!.joints as any[] : []; const nextLinks = links.filter((l: any) => !sel.has(l.otherId)); return { ...el, meta: { ...(el.meta || {}), joints: nextLinks } }; })); setElements((prev: any) => prev.map((el: any) => { const links = Array.isArray(el.meta?.joints) ? el.meta!.joints as any[] : []; const nextLinks = links.filter((l: any) => !sel.has(el.id!) || !sel.has(l.otherId)); return { ...el, meta: { ...(el.meta || {}), joints: nextLinks } }; })); scheduleSave() }}>Verbindungen der Auswahl lösen</Button>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => { const v = selected?.meta?.fontSize ?? 20; const selTypes = new Set(elements.filter((e: any) => selectedIds.includes(e.id!)).map((e: any) => e.type)); ctx.setTypeStyles((prev: any) => { const cp: any = { ...prev }; for (const t of selTypes) (cp as any)[t as any] = { fontSize: v }; return cp }); setElements((prev: any) => prev.map((x: any) => selTypes.has(x.type) ? { ...x, meta: { ...(x.meta || {}), fontSize: v } } : x)); scheduleSave() }}>Auf alle Typen in Auswahl anwenden</Button>
            </div>
            <div className="flex gap-2">
              <Button onClick={ctx.removeSelected} variant="danger">Löschen</Button>
            </div>
          </>
        )}
      </div>
      <div className="rounded border border-neutral-900 p-3 grid gap-2">
        <div className="text-sm font-medium">Export</div>
        <div className="flex gap-2">
          <Button onClick={exportPng}>PNG</Button>
          <Button onClick={exportPdf}>PDF (A4 Quer)</Button>
        </div>
      </div>
    </aside>
  )
}
