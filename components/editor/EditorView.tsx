"use client"
import { EditorHeader } from '@/components/editor/EditorHeader'
import { EditorCanvas } from '@/components/editor/EditorCanvas'
import { EditorSidebar } from '@/components/editor/EditorSidebar'
import { useEditor } from '@/components/editor/EditorContext'
import { Z } from '@/components/ui/zIndex'
import { useEffect, useState } from 'react'

export function EditorView() {
  const ctx = useEditor()
  const [showLoading, setShowLoading] = useState(false)
  useEffect(() => {
    let t: any
    if (ctx.loadingPlan) {
      t = setTimeout(() => setShowLoading(true), 120)
    } else {
      setShowLoading(false)
    }
    return () => { if (t) clearTimeout(t) }
  }, [ctx.loadingPlan])
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <div className="lg:col-span-5 h-[calc(100vh-48px)] rounded border border-neutral-900 bg-neutral-950/40 relative">
        <EditorHeader />
        <EditorCanvas />
        {showLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-950" style={{ zIndex: Z.overlay }}>
            <div className="flex items-center gap-2 text-fg-muted">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="9" className="opacity-20" />
                <path d="M21 12a9 9 0 0 0-9-9" />
              </svg>
              <span>Laden…</span>
            </div>
          </div>
        )}
      </div>
      {ctx.sidebarOpen && (
        <div
          className="fixed left-0 top-[48px] h-[calc(100vh-48px)] w-full"
          style={{ zIndex: Z.overlay }}
          onClick={() => {
            try {
              window.dispatchEvent(new CustomEvent('sidebar-toggle', { detail: { open: false } }) as any)
            } catch {}
          }}
        />
      )}
      <EditorSidebar />
    </div>
  )
}
