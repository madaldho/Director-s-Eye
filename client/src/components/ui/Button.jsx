import React from 'react'
import { cn } from '../../lib/utils'

const Button = React.forwardRef(({ 
  className, 
  variant = 'default', 
  size = 'default',
  children,
  ...props 
}, ref) => {
  const variants = {
    default: 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/25',
    secondary: 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700',
    outline: 'border border-slate-600 bg-transparent hover:bg-slate-800 text-white',
    ghost: 'hover:bg-slate-800 text-slate-300 hover:text-white',
    destructive: 'bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/25',
  }

  const sizes = {
    default: 'h-10 px-4 py-2',
    sm: 'h-8 px-3 text-sm',
    lg: 'h-12 px-6 text-lg',
    icon: 'h-10 w-10',
  }

  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
})

Button.displayName = 'Button'

export { Button }