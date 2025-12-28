import React, { useEffect, useRef, useState } from 'react'
import { Terminal, Minimize2, Maximize2, Circle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../lib/utils'

const TelemetryConsole = ({ logs }) => {
  const [isMinimized, setIsMinimized] = useState(false)
  const logsEndRef = useRef(null)

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const getLogStyles = (type) => {
    switch (type) {
      case 'error': return { color: 'text-red-400', bg: 'bg-red-500/10', prefix: 'ERR' }
      case 'warning': return { color: 'text-amber-400', bg: 'bg-amber-500/10', prefix: 'WRN' }
      case 'success': return { color: 'text-emerald-400', bg: 'bg-emerald-500/10', prefix: 'OK' }
      case 'metric': return { color: 'text-indigo-400', bg: 'bg-indigo-500/10', prefix: 'MTR' }
      case 'trace': return { color: 'text-purple-400', bg: 'bg-purple-500/10', prefix: 'TRC' }
      default: return { color: 'text-zinc-400', bg: 'bg-zinc-500/10', prefix: 'LOG' }
    }
  }

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className="fixed bottom-0 left-0 right-0 z-40"
    >
      <div className="bg-black/90 backdrop-blur-xl border-t border-white/10 shadow-2xl shadow-black">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium text-white tracking-wide">Datadog Telemetry</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Circle className="w-2 h-2 fill-emerald-400 text-emerald-400 animate-pulse" />
              <span className="text-xs text-zinc-500 font-mono">LIVE</span>
            </div>
          </div>
          
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 hover:bg-white/10 rounded-md transition-colors"
          >
            {isMinimized ? (
              <Maximize2 className="w-4 h-4 text-zinc-400" />
            ) : (
              <Minimize2 className="w-4 h-4 text-zinc-400" />
            )}
          </button>
        </div>

        {/* Console Content */}
        <AnimatePresence>
          {!isMinimized && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="h-32 overflow-y-auto p-3 font-mono text-xs custom-scrollbar bg-black/50">
                {logs.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-zinc-600 italic">
                    Waiting for telemetry data...
                  </div>
                ) : (
                  <div className="space-y-1">
                    {logs.map((log) => {
                      const styles = getLogStyles(log.type)
                      return (
                        <motion.div
                          key={log.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-start gap-3 hover:bg-white/5 p-0.5 rounded px-2 transition-colors"
                        >
                          <span className="text-zinc-600 shrink-0 select-none min-w-[60px]">{log.timestamp}</span>
                          <span className={cn(
                            'px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold shrink-0 min-w-[35px] text-center tracking-wider',
                            styles.bg,
                            styles.color
                          )}>
                            {styles.prefix}
                          </span>
                          <span className={cn('break-all font-light tracking-wide', styles.color)}>
                            {log.message}
                          </span>
                        </motion.div>
                      )
                    })}
                    <div ref={logsEndRef} />
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

export default TelemetryConsole