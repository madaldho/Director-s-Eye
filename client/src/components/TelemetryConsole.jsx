import React, { useEffect, useRef } from 'react'
import { Terminal, Minimize2, Maximize2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const TelemetryConsole = ({ logs }) => {
  const [isMinimized, setIsMinimized] = React.useState(false)
  const logsEndRef = useRef(null)

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [logs])

  const getLogColor = (type) => {
    switch (type) {
      case 'error': return 'text-red-400'
      case 'warning': return 'text-yellow-400'
      case 'success': return 'text-green-400'
      case 'metric': return 'text-blue-400'
      case 'trace': return 'text-purple-400'
      default: return 'text-gray-300'
    }
  }

  const getLogPrefix = (type) => {
    switch (type) {
      case 'error': return '[ERROR]'
      case 'warning': return '[WARN]'
      case 'success': return '[INFO]'
      case 'metric': return '[METRIC]'
      case 'trace': return '[TRACE]'
      default: return '[LOG]'
    }
  }

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className="fixed bottom-0 left-0 right-0 z-50"
    >
      <div className="bg-dark-900/95 backdrop-blur-md border-t border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-green-400" />
            <span className="text-sm font-medium text-green-400">
              Datadog Telemetry Console
            </span>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          </div>
          
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-white/10 rounded transition-colors"
          >
            {isMinimized ? (
              <Maximize2 className="w-4 h-4" />
            ) : (
              <Minimize2 className="w-4 h-4" />
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
              <div className="h-32 overflow-y-auto p-4 terminal-text text-xs">
                {logs.length === 0 ? (
                  <div className="text-gray-500 italic">
                    Waiting for telemetry data...
                  </div>
                ) : (
                  logs.map((log) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`mb-1 ${getLogColor(log.type)}`}
                    >
                      <span className="text-gray-500">[{log.timestamp}]</span>
                      <span className="ml-2 font-semibold">
                        {getLogPrefix(log.type)}
                      </span>
                      <span className="ml-2">{log.message}</span>
                    </motion.div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

export default TelemetryConsole