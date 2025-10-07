"use client"
import { EditorHeader } from '@/components/editor/EditorHeader'
import { EditorCanvas } from '@/components/editor/EditorCanvas'
import { EditorSidebar } from '@/components/editor/EditorSidebar'
import { useEditor } from '@/components/editor/EditorContext'
import { Z } from '@/components/ui/zIndex'

export function EditorView() {
  const ctx = useEditor()
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <div className="lg:col-span-5 h-[calc(100vh-48px)] rounded border border-neutral-900 bg-neutral-950/40 relative">
        <EditorHeader />
        <EditorCanvas />
      </div>
      {ctx.sidebarOpen && (
        <div
          className="fixed left-0 top-[48px] h-[calc(100vh-48px)] w-full"
          style={{ zIndex: Z.overlay }}
          onClick={() => {
            try {
              window.dispatchEvent(new StorageEvent('storage', { key: 'sidebar', newValue: JSON.stringify({ open: false }) }))
            } catch {}
          }}
        />
      )}
      <EditorSidebar />
    </div>
  )
}
