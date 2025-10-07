"use client"
import { Button } from '@/components/ui/Button'
import { Z } from '@/components/ui/zIndex'
import { useEditor } from '@/components/editor/EditorContext'
import { useEffect, useMemo, useState } from 'react'

export function EditorHeader() {
  return (
    <div className="pointer-events-auto absolute right-0 top-0 flex items-center gap-2 text-xs" style={{ zIndex: Z.toolbar }}>
      <SaveGroup />
    </div>
  )
}

function SaveGroup() {
  const { undo, canUndo, readOnly, saving, loadingPlan, plan, classId, activeProfile, leadPlan, viewMode, setViewMode } = useEditor()
  const [isLead, setIsLead] = useState(false)
  const [shared, setShared] = useState(false)
  const [shareBusy, setShareBusy] = useState(false)
  const [toast, setToast] = useState<'shared'|'unshared'|null>(null)
  const canShare = useMemo(() => Boolean(isLead && plan && plan.title === null), [isLead, plan?.id, plan?.title])
  const disabled = readOnly || !canUndo
  useEffect(() => {
    let alive = true
    async function checkLead() {
      try {
        const res = await fetch('/api/classes')
        if (!res.ok) { if (alive) setIsLead(false); return }
        const classes = await res.json()
        const c = classes.find((x: any) => x.id === classId)
        if (alive) setIsLead(!!c && c.leadProfileId === activeProfile?.id)
      } catch { if (alive) setIsLead(false) }
    }
    if (classId && activeProfile?.id) checkLead(); else setIsLead(false)
    return () => { alive = false }
  }, [classId, activeProfile?.id])
  useEffect(() => {
    let alive = true
    async function loadShare() {
      if (!canShare || !plan?.id) { if (alive) setShared(false); return }
      try {
        const res = await fetch(`/api/plan/share?planId=${encodeURIComponent(plan.id)}`)
        if (!res.ok) { if (alive) setShared(false); return }
        const data = await res.json()
        if (alive) setShared(!!data?.shared)
      } catch { if (alive) setShared(false) }
    }
    loadShare()
    return () => { alive = false }
  }, [canShare, plan?.id])
  return (
    <div className="mr-2 flex items-center gap-2">
      <div className="leading-none text-fg-muted select-none min-w-[80px] text-right">
        {loadingPlan && <span>Laden…</span>}
        {!loadingPlan && saving === 'saving' && <span>Speichern…</span>}
        {!loadingPlan && saving === 'saved' && <span className="text-primary">Gespeichert</span>}
      </div>
      {leadPlan && (
        <div className="flex items-center gap-2 bg-neutral-950 px-1 py-0.5">
          <span className="text-fg-muted">Ansicht:</span>
          <Button size="xs" variant="subtle" title="Eigenen Plan anzeigen" onClick={() => setViewMode('owner')} className={viewMode==='owner'?'text-primary':''}>Eigen</Button>
          <Button size="xs" variant="subtle" title="Plan der Klassenleitung anzeigen" onClick={() => setViewMode('lead')} className={viewMode==='lead'?'text-primary':''}>KL</Button>
        </div>
      )}
      {canShare && (
        <div className="flex items-center gap-2 pr-1">
          {!shared && (
            <Button
              size="xs"
              variant="subtle"
              title="Plan freigeben (als Klassenleitung teilen)"
              disabled={shareBusy}
              onClick={async () => {
                setShareBusy(true)
                try {
                  await fetch('/api/plan/share', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planId: plan!.id, action: 'share' }) })
                  setShared(true)
                  setToast('shared'); setTimeout(() => setToast(null), 1200)
                } finally { setShareBusy(false) }
              }}
            >
              <span className="text-primary">Freigeben</span>
            </Button>
          )}
          {shared && (
            <Button
              size="xs"
              variant="subtle"
              title="Freigabe aufheben"
              disabled={shareBusy}
              onClick={async () => {
                setShareBusy(true)
                try {
                  await fetch('/api/plan/share', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planId: plan!.id, action: 'unshare' }) })
                  setShared(false)
                  setToast('unshared'); setTimeout(() => setToast(null), 1200)
                } finally { setShareBusy(false) }
              }}
            >
              <span className="text-red-300">Freigabe aufheben</span>
            </Button>
          )}
          {toast === 'shared' && <span className="text-primary">Freigegeben</span>}
          {toast === 'unshared' && <span className="text-fg-muted">Freigabe aufgehoben</span>}
        </div>
      )}
      <div className="rounded bg-neutral-950">
        <button
          type="button"
          aria-label="Rückgängig"
          title="Rückgängig (⌘Z / Ctrl+Z)"
          disabled={disabled}
          onClick={() => undo?.()}
          className="inline-flex items-center justify-center rounded text-fg disabled:opacity-50 px-3 py-1 focus:outline-none focus:ring-0"
        >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 7v6h6" />
          <path d="M3.51 15.49A9 9 0 1 0 5.64 5.64L3 8.29" />
        </svg>
        </button>
      </div>
    </div>
  )
}
