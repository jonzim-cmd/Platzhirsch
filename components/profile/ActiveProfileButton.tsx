"use client"
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'

export function ActiveProfileButton({ id, name }: { id: string; name: string }) {
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('activeProfile')
      if (raw) setActiveId(JSON.parse(raw).id)
    } catch {}
    const onStorage = () => {
      try {
        const raw = localStorage.getItem('activeProfile')
        setActiveId(raw ? JSON.parse(raw).id : null)
      } catch {}
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
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
              localStorage.setItem('activeProfile', JSON.stringify({ id, name }))
              // trigger update for same-tab
              window.dispatchEvent(new StorageEvent('storage', { key: 'activeProfile' }))
            } catch {}
          }}
        >Aktiv setzen</Button>
      )}
    </div>
  )
}

