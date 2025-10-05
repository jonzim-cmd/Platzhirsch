"use client"
import React, { createContext, useContext } from 'react'
import type { EditorState } from '@/components/editor/useEditorState'

type Ctx = EditorState

const EditorContext = createContext<Ctx | null>(null)

export function EditorProvider({ value, children }: { value: Ctx; children: React.ReactNode }) {
  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
}

export function useEditor() {
  const ctx = useContext(EditorContext)
  if (!ctx) throw new Error('useEditor must be used within an EditorProvider')
  return ctx
}
