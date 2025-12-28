import React from 'react'
import { cn } from '../../lib/utils'

const Badge = ({ className, variant = 'default', children, ...props }) => {
  const variants = {
    default: 'bg-blue-600/20 text-blue-400 border-blue-600/30',
    secondary: 'bg-slate-700/50 text-slate-300 border-slate-600/30',
    success: 'bg-emerald-600/20 text-emerald-400 border-emerald-600/30',
    warning: 'bg-amber-600/20 text-amber-400 border-amber-600/30',
    destructive: 'bg-red-600/20 text-red-400 border-red-600/30',
    outline: 'bg-transparent text-slate-300 border-slate-600',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}

export { Badge }