"use client"
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'

export function ActiveProfileButton({ id, name }: { id: string; name: string }) {
  const [activeId, setActiveId] = useState<string | null>(null)
  useEffect(() => {
    const url = new URL(window.location.href)
    const p = url.searchParams.get('p')
    setActiveId(p)
    const onSelection = (e: StorageEvent) => {
      if (e.key === 'selection' && e.newValue) {
        try { const v = JSON.parse(e.newValue); setActiveId(v?.p || null) } catch {}
      }
    }
    window.addEventListener('storage', onSelection)
    return () => window.removeEventListener('storage', onSelection)
  }, [])

  const isActive = activeId === id

  return (
    <div className="flex items-center gap-2">
      {isActive ? (
        <span className="text-xs text-primary">Aktiv</span>
      ) : (
        <Button
          onClick={() => {
            try {
              const url = new URL(window.location.href)
              url.searchParams.set('p', id)
              url.searchParams.delete('c'); url.searchParams.delete('r'); url.searchParams.delete('pl')
              window.history.replaceState({}, '', url.toString())
              window.dispatchEvent(new StorageEvent('storage', { key: 'selection', newValue: JSON.stringify({ p: id, c: undefined, r: undefined, pl: undefined }) }))
            } catch {}
          }}
        >Aktiv setzen</Button>
      )}
    </div>
  )
}
