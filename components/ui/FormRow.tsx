import * as React from 'react'

type FormRowProps = {
  label: React.ReactNode
  children: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

// Consistent 3-column grid for label, control, and actions
export function FormRow({ label, children, actions, className = '' }: FormRowProps) {
  return (
    <div className={`grid grid-cols-[max-content,1fr] items-center gap-3 ${className}`}>
      <div className="text-sm text-fg-muted">{label}</div>
      <div className="flex items-center gap-2 flex-wrap">
        {children}
        {actions}
      </div>
    </div>
  )
}
