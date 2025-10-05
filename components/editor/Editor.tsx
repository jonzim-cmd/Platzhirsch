"use client"
import { EditorView } from '@/components/editor/EditorView'
import { EditorProvider } from '@/components/editor/EditorContext'
import { useEditorState } from '@/components/editor/useEditorState'

export function Editor({ classes, rooms }: { classes: { id: string; name: string }[]; rooms: { id: string; name: string; type: string }[] }) {
  const state = useEditorState({ classes, rooms })
  return (
    <EditorProvider value={state}>
      <EditorView />
    </EditorProvider>
  )
}

