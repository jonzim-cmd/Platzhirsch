"use client"
import { useEffect, useState } from 'react'

export function ActiveProfileNav() {
  const [name, setName] = useState<string | null>(null)
  useEffect(() => {
    const read = () => {
      try {
        const url = new URL(window.location.href)
        const p = url.searchParams.get('p')
        if (!p) return setName(null)
        ;(async () => {
          try {
            const list = await fetch('/api/profiles').then(r=>r.json())
            const prof = Array.isArray(list) ? list.find((x: any) => x.id === p) : null
            setName(prof?.name || null)
          } catch { setName(null) }
        })()
      } catch { setName(null) }
    }
    read()
    const onSelection = (e: StorageEvent) => { if (e.key === 'selection' && e.newValue) read() }
    window.addEventListener('storage', onSelection)
    return () => window.removeEventListener('storage', onSelection)
  }, [])

  if (!name) return null
  return (
    <span className="ml-2 rounded bg-neutral-800 px-2 py-1 text-xs text-fg">{name}</span>
  )
}
