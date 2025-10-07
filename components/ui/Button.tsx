import * as React from 'react'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger' | 'success' | 'subtle'
  size?: 'xs' | 'sm' | 'md'
}

export function Button({ variant = 'ghost', size = 'md', className = '', ...props }: ButtonProps) {
  const base = 'inline-flex items-center rounded transition-colors'
  const variants: Record<string, string> = {
    primary: 'text-primary border border-neutral-700 hover:bg-neutral-800',
    ghost: 'bg-neutral-800 text-fg hover:bg-neutral-700',
    danger: 'bg-red-900/40 text-red-300 hover:bg-red-900/60',
    success: 'bg-green-900/40 text-green-300 hover:bg-green-900/60 border border-green-700',
    subtle: 'bg-transparent text-fg-muted hover:bg-neutral-800/30'
  }
  const sizes: Record<string, string> = {
    xs: 'px-1 py-0.5 text-xs',
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
  }
  return <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props} />
}
