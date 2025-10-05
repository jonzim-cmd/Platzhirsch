"use client"
import { EditorHeader } from '@/components/editor/EditorHeader'
import { EditorCanvas } from '@/components/editor/EditorCanvas'
import { EditorSidebar } from '@/components/editor/EditorSidebar'

export function EditorView() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <div className="lg:col-span-5 h-[calc(100vh-48px)] rounded border border-neutral-900 bg-neutral-950/40 relative">
        <EditorHeader />
        <EditorCanvas />
      </div>
      <EditorSidebar />
    </div>
  )
}
