"use client"
import { useEffect, useState } from 'react'

export function ActiveProfileNav() {
  const [name, setName] = useState<string | null>(null)
  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem('activeProfile')
        if (!raw) return setName(null)
        const parsed = JSON.parse(raw)
        setName(parsed?.name ?? null)
      } catch {
        setName(null)
      }
    }
    read()
    const handler = () => read()
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  if (!name) return null
  return (
    <span className="ml-2 rounded bg-neutral-800 px-2 py-1 text-xs text-fg">{name}</span>
  )
}

