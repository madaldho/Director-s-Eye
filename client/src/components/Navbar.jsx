import React, { useState, useEffect } from 'react'
import { Activity, RotateCcw, Monitor, Settings, Zap, Menu } from 'lucide-react'
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
    } catch (err) { }
  }

  return (
    <>
      <motion.nav
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-6 inset-x-0 z-50 flex justify-center px-6 pointer-events-none"
      >
        <div className="bg-[var(--bento-card)]/80 backdrop-blur-md border border-[var(--bento-border)] rounded-full px-5 py-2.5 flex items-center gap-6 shadow-xl shadow-black/20 pointer-events-auto">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <img src="/logo.webp" alt="Director's Eye" className="w-8 h-8 rounded-lg object-cover" />
            <span className="font-display font-bold tracking-tight text-sm text-white">
              Director's Eye
            </span>
          </div>

          <div className="w-px h-4 bg-[var(--bento-border)]" />

          {/* Status Pills */}
          <div className="flex items-center gap-3">
             <StatusDot active={health.status === 'healthy'} label="System" />
             <StatusDot active={health.aiStatus === 'connected'} label="Gemini AI" />
          </div>

          <div className="w-px h-4 bg-[var(--bento-border)]" />

          {/* Minimal Controls */}
          <div className="flex items-center gap-1">
            <IconButton onClick={simulateError} icon={Activity} title="Simulate Error" />
            <IconButton onClick={() => setShowConfig(!showConfig)} icon={Settings} title="Settings" />
          </div>
        </div>
      </motion.nav>

      {/* Config Panel (Minimalist Popover) */}
      <AnimatePresence>
        {showConfig && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="fixed top-24 right-1/2 translate-x-1/2 z-40"
          >
             <div className="bento-card w-80 shadow-2xl">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-semibold text-sm">Configuration</h4>
                  <button onClick={() => setShowConfig(false)} className="text-[var(--bento-muted)] hover:text-white text-xs">Close</button>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-[var(--bento-border)]">
                    <span className="text-[var(--bento-muted)]">Environment</span>
                    <span>Production (Hackathon)</span>
                  </div>
                   <div className="flex justify-between py-2 border-b border-[var(--bento-border)]">
                    <span className="text-[var(--bento-muted)]">Region</span>
                    <span>AP-Southeast</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-[var(--bento-muted)]">Session ID</span>
                    <span className="font-mono text-[var(--bento-accent)]">
                      {sessionStorage.getItem('session_id') || (() => {
                        const id = Math.random().toString(36).substring(7).toUpperCase();
                        sessionStorage.setItem('session_id', id);
                        return id;
                      })()}
                    </span>
                  </div>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

const StatusDot = ({ active, label }) => (
  <div className="flex items-center gap-2">
    <div className={cn(
      "w-2 h-2 rounded-full transition-colors duration-300",
      active ? "bg-[var(--bento-success)]" : "bg-red-500"
    )} />
    <span className="text-xs font-medium text-[var(--bento-muted)] hidden sm:block">
      {label}
    </span>
  </div>
)

const IconButton = ({ onClick, icon: Icon, title }) => (
  <button 
    onClick={onClick}
    title={title}
    className="p-2 rounded-full hover:bg-[var(--bento-border)] text-[var(--bento-muted)] hover:text-white transition-all"
  >
    <Icon className="w-4 h-4" />
  </button>
)

export default Navbar