"use client"
import { useEffect } from 'react'
import { Z } from '@/components/ui/zIndex'
import { createPortal } from 'react-dom'

export function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [onClose])

  const content = (
    <div aria-modal="true" role="dialog" className="fixed inset-0" style={{ zIndex: Z.modal }}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4 overflow-auto">
        {children}
      </div>
    </div>
  )
  if (typeof document === 'undefined') return null
  return createPortal(content, document.body)
}
