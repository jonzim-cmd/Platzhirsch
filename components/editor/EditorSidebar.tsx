"use client"
import { Button } from '@/components/ui/Button'
import { Z } from '@/components/ui/zIndex'
import { useEditor } from '@/components/editor/EditorContext'
import { useState, useMemo } from 'react'

export function EditorSidebar() {
  const ctx = useEditor()
  const { leadPlan, viewMode, setViewMode, saving, students, addElement, applyPairsLayout, usedStudentIds, selected, selectedIds, setElements, scheduleSave, exportPng, exportPdf, elements, classId, roomId, loadPlan } = ctx
  const [studentQuery, setStudentQuery] = useState('')
  const filteredStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase()
    if (!q) return students
    return students.filter((s: any) => String(s.foreName || '').toLowerCase().includes(q))
  }, [studentQuery, students])

  // Determine if the currently selected class has any rooms assigned for the active profile
  const hasRoomsForSelectedClass = useMemo(() => {
    try {
      if (!ctx.activeProfile?.id || !classId) return false
      const raw = localStorage.getItem(`profile:${ctx.activeProfile.id}:classRooms`)
      if (!raw) return false
      const mapping = JSON.parse(raw) as Record<string, string[]>
      if (!Object.prototype.hasOwnProperty.call(mapping, classId)) return false
      const arr = mapping[classId] || []
      return Array.isArray(arr) && arr.length > 0
    } catch {
      return false
    }
  }, [ctx.activeProfile?.id, classId])

  const openSettingsModal = () => {
    try {
      const payload = { open: true, jumpTo: 'classes' }
      localStorage.setItem('openSettings', JSON.stringify(payload))
      window.dispatchEvent(new StorageEvent('storage', { key: 'openSettings', newValue: JSON.stringify(payload) }))
    } catch {}
  }

  return (
    <aside className={`fixed left-0 top-[48px] h-[calc(100vh-48px)] w-72 transform border-r border-neutral-900 bg-bg-soft p-3 overflow-auto transition-transform ${ctx.sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`} style={{ zIndex: Z.toolbar }}>
      {/* Guard: No class selected -> show info, no students/functions */}
      {!classId && (
        <div className="rounded border border-neutral-900 p-3 grid gap-2">
          <div className="text-sm font-medium">Klasse auswählen</div>
          <div className="text-xs text-fg-muted">Bitte wähle oben eine Klasse, um Schüler und Funktionen der Sidebar zu nutzen.</div>
        </div>
      )}

      {/* Guard: Class selected but no rooms mapped -> block functions with hint */}
      {!!classId && !hasRoomsForSelectedClass && (
        <div className="rounded border border-neutral-900 p-3 grid gap-2 mb-3">
          <div className="text-sm font-medium">Keine Räume zugeordnet</div>
          <div className="text-xs text-fg-muted">Für diese Klasse sind noch keine Räume zugewiesen. Weise der Klasse Räume zu, um mit der Planung zu beginnen.</div>
          <div>
            <Button variant="primary" onClick={openSettingsModal}>Räume zuweisen…</Button>
          </div>
        </div>
      )}

      {/* When blocked (no rooms), do not show actionable sections below */}
      {!!classId && !hasRoomsForSelectedClass ? null : (
        <>
      {/* Vorlagen */}
      <div className="rounded border border-neutral-900 p-3 mb-3 grid gap-2">
        <div className="text-xs uppercase tracking-wide text-fg-muted">Vorlagen</div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { ctx.historyCommit?.(); applyPairsLayout() }}>Paare</Button>
          <Button onClick={() => { ctx.historyCommit?.(); ctx.applySidesPairsCenterFour() }}>2-4-2</Button>
          <Button onClick={() => { ctx.historyCommit?.(); ctx.applySidesPairsCenterFourAngled() }}>2-4-2 schräg</Button>
          <Button onClick={() => { ctx.historyCommit?.(); ctx.applyHorseshoeLayout() }}>U-Form</Button>
        </div>
      </div>
      {leadPlan && viewMode==='lead' && (
        <div className="rounded border border-neutral-900 p-3 grid gap-2">
          <div className="text-sm font-medium">KL-Plan</div>
          <div className="text-xs text-fg-muted">Du kannst den Plan der Klassenleitung ansehen. Änderungen sind hier nicht möglich.</div>
          {ctx.activeProfile && ctx.plan?.id && (
            <Button variant="primary" onClick={async () => { await fetch('/api/plan/copy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetPlanId: ctx.plan!.id, sourcePlanId: leadPlan!.id }) }); setViewMode('owner'); await loadPlan(false) }}>Als Kopie übernehmen</Button>
          )}
        </div>
      )}
      {/* Elemente */}
      <div className="rounded border border-neutral-900 p-3 mb-3">
        <div className="text-xs uppercase tracking-wide text-fg-muted mb-2">Elemente</div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { ctx.historyCommit?.(); ctx.addEmptyStudent() }}>Tisch</Button>
          <Button onClick={() => { ctx.historyCommit?.(); addElement('TEACHER_DESK') }}>Lehrer</Button>
          <Button onClick={() => { ctx.historyCommit?.(); addElement('DOOR') }}>Tür</Button>
          <Button onClick={() => { ctx.historyCommit?.(); addElement('WINDOW_SIDE') }}>Fenster</Button>
          <Button onClick={() => { ctx.historyCommit?.(); addElement('WALL_SIDE') }}>Wand</Button>
        </div>
      </div>

      {/* Schüler */}
      <div className="rounded border border-neutral-900 p-3 mb-3">
        <div className="text-xs uppercase tracking-wide text-fg-muted mb-2">Schüler</div>
        {!classId ? (
          <div className="text-xs text-fg-muted">Bitte zuerst eine Klasse auswählen.</div>
        ) : (
          <>
            <input
              type="text"
              placeholder="Schüler suchen…"
              className="mb-2 w-full rounded border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs"
              value={studentQuery}
              onChange={(e) => setStudentQuery(e.target.value)}
            />
            <div className="grid gap-2 max-h-[260px] overflow-auto">
              {filteredStudents.map((s: any) => (
                <Button key={s.id} onClick={() => { ctx.historyCommit?.(); addElement('STUDENT', s.id) }} className={`justify-start ${usedStudentIds.has(String(s.id)) ? 'opacity-60' : ''}`} disabled={usedStudentIds.has(String(s.id))}>
                  <span className="flex-1 text-left">{s.foreName}</span>
                  {usedStudentIds.has(String(s.id)) && <span className="text-green-400">✔</span>}
                </Button>
              ))}
              {filteredStudents.length === 0 && <div className="text-xs text-fg-muted">Keine Schüler gefunden.</div>}
            </div>
          </>
        )}
      </div>
      {/* Auswahl */}
      <div className="rounded border border-neutral-900 p-3 grid gap-2 mb-3">
        <div className="text-xs uppercase tracking-wide text-fg-muted">Auswahl</div>
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
              <Button title="Übernimmt die aktuelle Schriftgröße auf alle STUDENT-Elemente." onClick={() => { ctx.historyCommit?.(); const v = selected?.meta?.fontSize ?? 20; const selTypes = new Set(elements.filter((e: any) => selectedIds.includes(e.id!)).map((e: any) => e.type)); ctx.setTypeStyles((prev: any) => { const cp: any = { ...prev }; for (const t of selTypes) (cp as any)[t as any] = { fontSize: v }; return cp }); setElements((prev: any) => prev.map((x: any) => selTypes.has(x.type) ? { ...x, meta: { ...(x.meta || {}), fontSize: v } } : x)); scheduleSave() }}>Auf alle Elemente dieses Typs anwenden</Button>
            </div>
          </>
        )}
      </div>
      {/* Export */}
      <div className="rounded border border-neutral-900 p-3 grid gap-2">
        <div className="text-xs uppercase tracking-wide text-fg-muted">Export</div>
        <div className="flex gap-2">
          <Button onClick={exportPng}>PNG</Button>
          <Button onClick={exportPdf}>PDF</Button>
        </div>
      </div>
      </>
      )}
    </aside>
  )
}
