"use client"
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Z } from '@/components/ui/zIndex'

export type Option = { value: string; label: string }

export function MultiSelect({
  options,
  selectedValues,
  onChange,
  placeholder = 'Auswählen…',
  className = '',
}: {
  options: Option[]
  selectedValues: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const byValue = useMemo(() => new Map(options.map(o => [o.value, o.label])), [options])
  const label = useMemo(() => {
    if (!selectedValues.length) return placeholder
    const labels = selectedValues.map(v => byValue.get(v) || v)
    return labels.length <= 3 ? labels.join(', ') : `${labels.length} ausgewählt`
  }, [selectedValues, placeholder, byValue])

  const toggle = (v: string) => {
    const set = new Set(selectedValues)
    if (set.has(v)) set.delete(v); else set.add(v)
    onChange(Array.from(set))
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" className="w-full h-9 truncate rounded border border-neutral-800 bg-neutral-900 px-2 text-sm hover:border-neutral-700 flex items-center" onClick={() => setOpen(v => !v)}>
        {label}
      </button>
      {open && (
        <div className="absolute mt-1 max-h-56 w-full overflow-auto rounded border border-neutral-800 bg-neutral-950 shadow-lg" style={{ zIndex: Z.dropdown }}>
          <ul className="py-1 text-sm">
            {options.map(o => {
              const checked = selectedValues.includes(o.value)
              return (
                <li key={o.value}>
                  <button type="button" className={`flex w-full items-center gap-2 px-2 py-1 text-left hover:bg-neutral-900 ${checked ? 'text-primary' : ''}`} onClick={() => toggle(o.value)}>
                    <span className={`inline-block h-4 w-4 rounded border ${checked ? 'border-primary bg-primary/20' : 'border-neutral-700'}`}>
                      {checked && (
                        <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current">
                          <path d="M7.629 13.233 3.9 9.504l1.414-1.414 2.315 2.315 6.364-6.364 1.414 1.414z" />
                        </svg>
                      )}
                    </span>
                    <span className="flex-1 truncate">{o.label}</span>
                  </button>
                </li>
              )
            })}
            {options.length === 0 && <li className="px-2 py-1 text-fg-muted">Keine Optionen</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
