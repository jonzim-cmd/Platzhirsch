"use client"
import Moveable from 'react-moveable'
import { JointOverlay } from '@/components/editor/JointOverlay'
import { Z } from '@/components/ui/zIndex'
import { Portal } from '@/components/ui/Portal'
import { useEditor } from '@/components/editor/EditorContext'

export function EditorCanvas() {
  const ctx = useEditor()
  const {
    leadPlan, viewMode,
    frameRef, canvasRef, frameSize,
    readOnly, elements, selectedIds, setSelectedIds,
    elementRefs, selected, studentById, defaultTerms,
    pickerOpenId, setPickerOpenId, pickerQuery, setPickerQuery,
    usedStudentIds, addElement, removeJoint, scheduleSave,
    exportPng, exportPdf, selectedTarget, primarySelectedId,
    moveElementBy, onDragEnd, setElements, students,
  } = ctx

  return (
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
                if (lineLike) return rectsIntersect(left, top, right, bottom, minx, miny, maxx, maxy)
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
              if ((ev.target as HTMLElement).closest('[data-student-picker]')) return
              ev.stopPropagation()
              const multi = ev.shiftKey || ev.metaKey || ev.ctrlKey
              if (multi) {
                // Toggle membership; make clicked element primary when adding
                if (selectedIds.includes(el.id)) {
                  const rest = selectedIds.filter(id => id !== el.id)
                  ctx.setSelectedIds(rest)
                } else {
                  ctx.setSelectedIds([el.id, ...selectedIds])
                }
              } else {
                // Single-select; if already selected, bring to front as primary
                if (selectedIds.includes(el.id)) {
                  if (selectedIds[0] !== el.id) {
                    const rest = selectedIds.filter(id => id !== el.id)
                    ctx.setSelectedIds([el.id, ...rest])
                  }
                } else {
                  ctx.setSelectedIds([el.id])
                }
              }
            }}
            onDoubleClick={(ev) => {
              if (readOnly) return
              ev.stopPropagation()
              let current = ''
              if (el.type === 'STUDENT') current = el.refId ? (studentById.get(String(el.refId)) || '') : (el.meta?.label || '')
              else current = (el.meta?.label as string) || defaultTerms[el.type]
              ctx.setEditing({ id: el.id!, value: current })
            }}
            className={`absolute select-none ${selectedIds.includes(el.id) ? 'ring-2 ring-primary/60' : ''}`}
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
            >
              {!readOnly && el.type === 'STUDENT' && (
                <div className="absolute left-0 top-0 z-10" data-student-picker>
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
              ctx.detachOnDragRef.current = false
              ctx.markManual?.()
              ;(window as any).__lastMoveableEvent = e.inputEvent
              if (!primarySelectedId) return
              const byId: Map<string, any> = new Map(elements.map((el: any) => [el.id, el]))
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
  )
}
