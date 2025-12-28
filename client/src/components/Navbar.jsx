import React, { useState, useEffect } from 'react'
import { Activity, RotateCcw, Monitor, Settings, Zap } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../lib/utils'
import axios from 'axios'
import { datadogRum } from '@datadog/browser-rum'

const Navbar = () => {
  const [health, setHealth] = useState({ status: 'checking', service: '...' })
  const [showConfig, setShowConfig] = useState(false)

  const checkHealth = async () => {
    try {
      const res = await axios.get('/api/health')
      setHealth(res.data)
    } catch (err) {
      setHealth({ status: 'error', service: 'offline' })
    }
  }

  useEffect(() => {
    checkHealth()
    const interval = setInterval(checkHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  const simulateError = async () => {
    datadogRum.addAction('simulate_error_click', { component: 'navbar' })
    try {
      await axios.post('/api/simulate-error')
    } catch (err) {
      // Ignore
    }
  }

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        className="fixed top-6 left-0 right-0 z-50 flex justify-center pointer-events-none"
      >
        <div className="glass-hud rounded-full px-6 py-3 flex items-center gap-8 pointer-events-auto">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-[var(--cyber-cyan)] blur-md opacity-50 animate-pulse" />
              <Monitor className="w-5 h-5 text-[var(--cyber-cyan)] relative z-10" />
            </div>
            <span className="font-mono font-bold tracking-wider text-sm">
              DIRECTOR_<span className="text-[var(--cyber-cyan)]">EYE</span>
            </span>
          </div>

          <div className="h-4 w-px bg-white/10" />

          {/* Status Indicators */}
          <div className="flex items-center gap-4">
            <StatusBadge 
              label="SYSTEM" 
              active={health.status === 'healthy'} 
              color="text-[var(--cyber-cyan)]"
            />
            <div className="h-4 w-px bg-white/10" />
            <StatusBadge 
              label="AI_CORE" 
              active={health.aiStatus === 'connected'} 
              color="text-[var(--nebula-purple)]"
            />
          </div>

          <div className="h-4 w-px bg-white/10" />

          {/* Actions */}
          <div className="flex items-center gap-2">
            <NavButton 
              onClick={simulateError}
              icon={Activity}
              label="ERR_SIM"
              variant="danger"
            />
            <NavButton 
              onClick={() => setShowConfig(!showConfig)}
              icon={Settings}
              label="CONFIG"
            />
          </div>
        </div>
      </motion.nav>

      <ConfigPanel isOpen={showConfig} onClose={() => setShowConfig(false)} />
    </>
  )
}

const StatusBadge = ({ label, active, color }) => (
  <div className="flex items-center gap-2 font-mono text-[10px]">
    <div className={cn(
      "w-1.5 h-1.5 rounded-full shadow-[0_0_5px_currentColor]",
      active ? color.replace('text-', 'bg-') : "bg-zinc-600"
    )} />
    <span className={cn("tracking-widest", active ? "text-white" : "text-zinc-600")}>
      {label}
    </span>
  </div>
)

const NavButton = ({ onClick, icon: Icon, label, variant = 'default' }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-300 border border-transparent",
      variant === 'danger' 
        ? "hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-400 text-zinc-400" 
        : "hover:bg-white/10 hover:border-white/20 text-zinc-400 hover:text-white"
    )}
  >
    <Icon className="w-3.5 h-3.5" />
    <span className="font-mono text-[10px] uppercase font-bold tracking-wider hidden md:block">
      {label}
    </span>
  </button>
)

const ConfigPanel = ({ isOpen, onClose }) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="fixed top-24 right-1/2 translate-x-1/2 z-40"
      >
        <div className="glass-hud rounded-xl p-6 w-80 text-xs font-mono">
          <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/10">
            <h3 className="text-[var(--cyber-cyan)] font-bold">SYSTEM_CONFIG</h3>
            <button onClick={onClose} className="hover:text-white text-zinc-500">ESC</button>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-zinc-400">VERSION</span>
              <span className="text-white">v2.1.0-RC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">REGION</span>
              <span className="text-white">AP-SOUTHEAST</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">TRACE_ID</span>
              <span className="text-[var(--nebula-purple)]">
                {Math.random().toString(36).substring(7).toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
)

export default Navbar