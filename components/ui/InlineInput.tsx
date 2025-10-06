import * as React from 'react'

type InlineInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  className?: string
}

// Bare input control (no internal label), sized to align with buttons
export const InlineInput = React.forwardRef<HTMLInputElement, InlineInputProps>(
  ({ className = '', ...props }, ref) => (
    <input
      ref={ref}
      className={
        'h-9 rounded border border-neutral-800 bg-neutral-900 px-2 text-sm outline-none ring-0 focus:border-neutral-600 ' +
        className
      }
      {...props}
    />
  )
)
InlineInput.displayName = 'InlineInput'

