import * as React from 'react'

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, className = '', ...props }, ref) => {
    return (
      <label className="grid gap-2 text-sm">
        {label ? <span className="text-fg-muted">{label}</span> : null}
        <input
          ref={ref}
          className={
            'rounded border border-neutral-800 bg-neutral-900 px-3 py-2 outline-none ring-0 focus:border-neutral-600 ' +
            className
          }
          {...props}
        />
      </label>
    )
  }
)
Input.displayName = 'Input'

