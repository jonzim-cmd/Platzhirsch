import * as React from 'react'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger'
}

export function Button({ variant = 'ghost', className = '', ...props }: ButtonProps) {
  const base = 'inline-flex items-center rounded px-3 py-2 text-sm transition-colors'
  const variants: Record<string, string> = {
    primary: 'bg-primary/20 text-primary hover:bg-primary/30',
    ghost: 'bg-neutral-800 text-fg hover:bg-neutral-700',
    danger: 'bg-red-900/40 text-red-300 hover:bg-red-900/60'
  }
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />
}

