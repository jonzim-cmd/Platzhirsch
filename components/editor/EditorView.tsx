"use client"
import Moveable from 'react-moveable'
import { Button } from '@/components/ui/Button'
import { JointOverlay } from '@/components/editor/JointOverlay'
import { Z } from '@/components/ui/zIndex'
import { Portal } from '@/components/ui/Portal'

export function EditorView({ ctx }: { ctx: any }) {
  const {
    leadPlan, viewMode, setViewMode, saving,
    frameRef, canvasRef, frameSize,
    readOnly, elements, selectedIds, setSelectedIds,
    elementRefs, selected, studentById, defaultTerms,
    pickerOpenId, setPickerOpenId, pickerQuery, setPickerQuery,
    usedStudentIds, addElement, applyPairsLayout, removeJoint, scheduleSave,
    exportPng, exportPdf, selectedTarget, primarySelectedId,
    moveElementBy, onDragEnd, setElements, students, classId, roomId, loadPlan,
  } = ctx

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <div className="lg:col-span-5 h-[calc(100vh-48px)] rounded border border-neutral-900 bg-neutral-950/40 relative">
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

        <div ref={frameRef} className="relative h-full w-full overflow-auto">
          <div
            ref={canvasRef}
            className="relative"
            style={{ width: frameSize.w, height: frameSize.h }}
            onMouseDown={(e) => {
              if (readOnly) return
              if (e.target === canvasRef.current) {
                const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
                const x = e.clientX - rect.left
                const y = e.clientY - rect.top
                // First, try to create a joint if clicking on the edge between two boxes
                if (typeof ctx.tryCreateJointAt === 'function') {
                  const created = ctx.tryCreateJointAt(x, y)
                  if (created) return
                }
                ctx.setMarquee({ active: true, x0: x, y0: y, x1: x, y1: y })
                setSelectedIds([])
                const onMove = (ev: MouseEvent) => {
                  const nx = ev.clientX - rect.left
                  const ny = ev.clientY - rect.top
                  ctx.setMarquee((prev: any) => ({ ...prev, x1: nx, y1: ny }))
                  const minx = Math.min(x, nx)
                  const miny = Math.min(y, ny)
                  const maxx = Math.max(x, nx)
                  const maxy = Math.max(y, ny)
                  const rectsIntersect = (aL: number, aT: number, aR: number, aB: number, bL: number, bT: number, bR: number, bB: number) => !(aR < bL || aL > bR || aB < bT || aT > bB)
                  const sel = elements.filter((el: any) => {
                    const rot = (((el.rotation || 0) % 360) + 360) % 360
                    const rad = rot * Math.PI / 180
                    const cos = Math.cos(rad)
                    const sin = Math.sin(rad)
                    const bbW = Math.abs(el.w * cos) + Math.abs(el.h * sin)
                    const bbH = Math.abs(el.w * sin) + Math.abs(el.h * cos)
                    const cx = el.x + el.w / 2
                    const cy = el.y + el.h / 2
                    const left = cx - bbW / 2
                    const top = cy - bbH / 2
                    const right = cx + bbW / 2
                    const bottom = cy + bbH / 2
                    const lineLike = el.type === 'DOOR' || el.type === 'WINDOW_SIDE' || el.type === 'WALL_SIDE'
                    // For line-like elements, select on intersection to make thin bars easier to grab
                    if (lineLike) return rectsIntersect(left, top, right, bottom, minx, miny, maxx, maxy)
                    // For other elements, require full containment
                    return left >= minx && top >= miny && right <= maxx && bottom <= maxy
                  }).map((el: any) => el.id!)
                  setSelectedIds(sel)
                }
                const onUp = (ev: MouseEvent) => {
                  const nx = ev.clientX - rect.left
                  const ny = ev.clientY - rect.top
                  ctx.setMarquee((prev: any) => ({ ...prev, active: false, x1: nx, y1: ny }))
                  window.removeEventListener('mousemove', onMove)
                  window.removeEventListener('mouseup', onUp)
                }
                window.addEventListener('mousemove', onMove)
                window.addEventListener('mouseup', onUp)
              }
            }}
            onMouseMove={(e) => {
              if (readOnly) return
              if (!canvasRef.current) return
              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
              const x = e.clientX - rect.left
              const y = e.clientY - rect.top
              ctx.updateJointHover?.(x, y)
            }}
            onMouseLeave={() => { if (!readOnly) ctx.setJointHover?.(null) }}
          >
            {(viewMode==='owner' ? elements : (leadPlan?.elements || [])).map((el: any) => (
              <div
                key={el.id}
                role="button"
                onMouseDown={(ev) => {
                  if (readOnly) return
                  const id = el.id!
                  // Wenn Element bereits in der Auswahl ist: als primär markieren,
                  // damit Drag von jedem ausgewählten Element die ganze Gruppe bewegt.
                  if (selectedIds.includes(id)) {
                    setSelectedIds((prev: any) => [id, ...prev.filter((x: any) => x !== id)])
                  }
                }}
                onClick={(ev) => {
                  if (readOnly) return
                  if (ev.metaKey || ev.ctrlKey) {
                    setSelectedIds((prev: any) => prev.includes(el.id!) ? prev.filter((id: any) => id !== el.id) : [...prev, el.id!])
                  } else {
                    setSelectedIds([el.id!])
                  }
                }}
                className={`absolute select-none ${selectedIds.includes(el.id!) ? 'ring-2 ring-primary/60' : ''}`}
                data-el={el.id}
                style={{ left: el.x, top: el.y, width: el.w, height: el.h, transform: `rotate(${el.rotation}deg)`, zIndex: el.z }}
                ref={(node) => { if (node) elementRefs.current.set(el.id!, node); else elementRefs.current.delete(el.id!) }}
              >
                <div
                  className={`h-full w-full ${el.type === 'TEACHER_DESK' ? 'rounded-xl' : 'rounded'} border ${
                    el.type === 'WINDOW_SIDE'
                      ? 'border-sky-700 bg-sky-900/30 border-dashed'
                      : el.type === 'WALL_SIDE'
                        ? 'border-neutral-600 bg-neutral-700/60'
                        : 'border-neutral-700 bg-neutral-800/60'
                  } flex items-center justify-center px-1`}
                  style={{ fontSize: (el.meta?.fontSize ?? 20) + 'px' }}
                  onDoubleClick={(ev) => {
                    if (readOnly) return
                    ev.stopPropagation()
                    let current = ''
                    if (el.type === 'STUDENT') {
                      current = el.refId ? (studentById.get(String(el.refId)) || '') : (el.meta?.label || '')
                    } else {
                      current = (el.meta?.label as string) || defaultTerms[el.type]
                    }
                    ctx.setEditing({ id: el.id!, value: current })
                  }}
                >
                  {!readOnly && el.type === 'STUDENT' && (
                    <div className="absolute left-0 top-0 z-10">
                      <button
                        type="button"
                        className="h-7 w-7 flex items-start justify-start text-[14px] leading-none text-neutral-400 hover:text-neutral-200 bg-transparent pl-1 pt-0.5"
                        title="Schüler auswählen"
                        onClick={(e) => { e.stopPropagation(); setPickerOpenId(pickerOpenId === el.id ? null : el.id); setPickerQuery('') }}
                      >▾</button>
                      {pickerOpenId === el.id && (() => {
                        const host = elementRefs.current.get(el.id!)
                        const rect = host?.getBoundingClientRect()
                        const left = (rect?.left ?? 0) + window.scrollX
                        const top = (rect?.top ?? 0) + window.scrollY + 28
                        return (
                          <Portal>
                            <div className="fixed w-56 rounded border border-neutral-800 bg-neutral-900 shadow-lg p-1 grid gap-1 text-sm max-h-64 overflow-auto" style={{ left, top, zIndex: Z.dropdown }} onClick={(e) => e.stopPropagation()}>
                              <input autoFocus placeholder="Suchen…" className="w-full rounded border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs" value={pickerQuery} onChange={(e) => setPickerQuery(e.target.value)} />
                              <button className="w-full text-left rounded px-2 py-1 hover:bg-neutral-800" onClick={() => { setElements((prev: any) => prev.map((x: any) => x.id === el.id ? { ...x, refId: null } : x)); setPickerOpenId(null); scheduleSave() }}>– Leer –</button>
                              {students.filter((s: any) => s.foreName.toLowerCase().includes(pickerQuery.toLowerCase())).map((s: any) => {
                                const used = usedStudentIds.has(String(s.id)) && el.refId !== s.id
                                return (
                                  <button key={s.id} disabled={used} className={`w-full text-left rounded px-2 py-1 hover:bg-neutral-800 ${used ? 'opacity-60 cursor-not-allowed' : ''}`} onClick={() => { if (used) return; setElements((prev: any) => prev.map((x: any) => x.id === el.id ? { ...x, refId: s.id } : x)); setPickerOpenId(null); scheduleSave() }}>
                                    {s.foreName} {el.refId === s.id && '✓'} {used && '✔'}
                                  </button>
                                )
                              })}
                            </div>
                          </Portal>
                        )
                      })()}
                    </div>
                  )}
                  {ctx.editing?.id === el.id ? (
                    <input
                      autoFocus
                      className="w-full bg-transparent text-center outline-none caret-primary"
                      value={ctx.editing.value}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => ctx.setEditing((prev: any) => ({ ...prev, value: e.target.value }))}
                      onKeyDown={ctx.onInlineEditKeyDown?.bind(null, el)}
                      onBlur={ctx.onInlineEditBlur?.bind(null, el)}
                    />
                  ) : (
                    <span className="truncate w-full text-center">
                      {el.type === 'STUDENT' ? (el.refId ? (studentById.get(String(el.refId)) || 'Schüler') : (el.meta?.label || 'leer')) : ((el.meta?.label as string) || defaultTerms[el.type])}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {ctx.marquee?.active && (
              <div className="absolute border border-primary/60 bg-primary/10 pointer-events-none" style={{ left: Math.min(ctx.marquee.x0, ctx.marquee.x1), top: Math.min(ctx.marquee.y0, ctx.marquee.y1), width: Math.abs(ctx.marquee.x1 - ctx.marquee.x0), height: Math.abs(ctx.marquee.y1 - ctx.marquee.y0) }} />
            )}
            {!readOnly && selectedTarget && (
              <Moveable
                target={selectedTarget as HTMLElement}
                draggable
                resizable
                rotatable
                throttleDrag={0}
                throttleResize={0}
                throttleRotate={0}
                snappable
                snapThreshold={8}
                elementGuidelines={Array.from(elementRefs.current.entries()).filter(([id]: any) => !selectedIds.includes(id)).map(([_id, node]: any) => node)}
                bounds={{ left: 0, top: 0, right: frameSize.w, bottom: frameSize.h }}
                origin={false}
                renderDirections={(() => {
                  if (!selected) return undefined
                  const lineLike = selected.type === 'DOOR' || selected.type === 'WINDOW_SIDE' || selected.type === 'WALL_SIDE'
                  if (!lineLike) return undefined
                  const rot = ((selected.rotation % 360) + 360) % 360
                  const horizontal = (Math.round(rot / 90) % 2) === 0
                  return horizontal ? ['e', 'w'] as any : ['n', 's'] as any
                })()}
                onDrag={(e: any) => {
                  if (!primarySelectedId) return
                  const dx = e.beforeDelta[0]
                  const dy = e.beforeDelta[1]
                  moveElementBy(primarySelectedId, dx, dy)
                  ;(window as any).__lastMoveableEvent = e.inputEvent
                }}
                onDragStart={(e: any) => {
                  // keine Shortcut-Gesten: immer Gruppenbewegung, kein Detach-on-drag
                  ctx.detachOnDragRef.current = false
                  ctx.markManual?.()
                  ;(window as any).__lastMoveableEvent = e.inputEvent
                  if (!primarySelectedId) return
                  const byId: Map<string, any> = new Map(elements.map((el: any) => [el.id, el]))
                  // move union der Gruppen aller selektierten, sofern primary enthalten, sonst nur primary Gruppe
                  const seeds: string[] = (selectedIds.includes(primarySelectedId) ? selectedIds : [primarySelectedId])
                  const toVisit: string[] = [...seeds]
                  const visited = new Set<string>()
                  while (toVisit.length) {
                    const curId = toVisit.pop()!
                    if (visited.has(curId)) continue
                    visited.add(curId)
                    const node: any = byId.get(curId)
                    const links: any[] = Array.isArray(node?.meta?.joints) ? node!.meta!.joints : []
                    for (const l of links) if (!visited.has(l.otherId)) toVisit.push(l.otherId)
                  }
                  // no drag preview highlighting
                  ctx.dragStartPositions.current.clear()
                  for (const vid of visited) {
                    const n = byId.get(vid)
                    if (n) ctx.dragStartPositions.current.set(vid, { x: n.x, y: n.y })
                  }
                }}
                onDragEnd={() => { if (primarySelectedId) { onDragEnd(primarySelectedId, { detach: ctx.detachOnDragRef.current }) } }}
                onResizeStart={(e: any) => { ctx.markManual?.(); e.setKeepRatio?.(e.inputEvent?.shiftKey === true) }}
                onResize={ctx.onMoveableResize}
                onResizeEnd={() => scheduleSave()}
                onRotate={(e: any) => { if (!primarySelectedId) return; setElements((prev: any) => prev.map((x: any) => x.id === primarySelectedId ? { ...x, rotation: e.beforeRotate } : x)) }}
                onRotateEnd={() => scheduleSave()}
              />
            )}
            <JointOverlay elements={elements} readOnly={readOnly} hoverCandidate={ctx.jointHover} onCreate={(c:any)=>ctx.createJointFromCandidate?.(c)} onDetach={(a: string, b: string) => { removeJoint(a, b); scheduleSave() }} />
          </div>
        </div>
      </div>
      <aside className={`fixed left-0 top-[48px] h-[calc(100vh-48px)] w-72 transform border-r border-neutral-900 bg-bg-soft p-3 overflow-auto transition-transform ${ctx.sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`} style={{ zIndex: Z.toolbar }}>
        <div className="rounded border border-neutral-900 p-3 mb-3 grid gap-2">
          <div className="text-sm font-medium mb-1">Plan</div>
          {leadPlan && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-fg-muted">Ansicht:</span>
              <Button onClick={() => setViewMode('owner')} className={viewMode==='owner'?'bg-primary/20 text-primary':''}>Eigen</Button>
              <Button onClick={() => setViewMode('lead')} className={viewMode==='lead'?'bg-primary/20 text-primary':''}>KL</Button>
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
              <Button variant="primary" onClick={async () => { await fetch('/api/plan/copy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ownerProfileId: ctx.activeProfile.id, classId, roomId, sourcePlanId: leadPlan!.id }) }); setViewMode('owner'); await loadPlan(false) }}>Als Kopie übernehmen</Button>
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
            <Button onClick={ctx.applySidesPairsCenterFour}>Seiten-Paare + Mitte 4er</Button>
            <Button onClick={ctx.applySidesPairsCenterFourAngled}>Seiten-Paare (schräg) + Mitte 4er</Button>
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
    </div>
  )
}
