import React from 'react'
import { cn } from '../../lib/utils'

const Progress = React.forwardRef(({ className, value = 0, max = 100, ...props }, ref) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))
  
  return (
    <div
      ref={ref}
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-slate-800', className)}
      {...props}
    >
      <div
        className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500 ease-out rounded-full"
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
})

Progress.displayName = 'Progress'

export { Progress }