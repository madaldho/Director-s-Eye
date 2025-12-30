import React, { useState, useEffect } from 'react'
import { Activity, Settings, HelpCircle, Key, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../lib/utils'
import axios from 'axios'
import { datadogRum } from '@datadog/browser-rum'

// Model configurations
const IMAGE_MODELS = {
  'nano-banana': {
    id: 'gemini-2.5-flash-image',
    name: 'Nano Banana',
    limit: 5,
    description: 'Fast & efficient'
  },
  'nano-banana-pro': {
    id: 'gemini-3-pro-image-preview',
    name: 'Nano Banana Pro',
    limit: 1,
    description: 'Premium quality'
  }
}

const Navbar = () => {
  const [health, setHealth] = useState({ status: 'checking', service: '...' })
  const [showConfig, setShowConfig] = useState(false)
  
  // Model & API Key state
  const [selectedModel, setSelectedModel] = useState(() => 
    localStorage.getItem('image_model') || 'nano-banana'
  )
  const [customApiKey, setCustomApiKey] = useState(() => 
    localStorage.getItem('gemini_api_key') || ''
  )
  const [apiKeyStatus, setApiKeyStatus] = useState('idle') // 'idle' | 'validating' | 'valid' | 'valid-free' | 'invalid'
  const [apiKeyWarning, setApiKeyWarning] = useState('')
  const [usageCount, setUsageCount] = useState(0)

  const checkHealth = async () => {
    try {
      const res = await axios.get('/api/health')
      setHealth(res.data)
    } catch (err) {
      setHealth({ status: 'error', service: 'offline' })
    }
  }

  // Fetch usage count
  const fetchUsage = async () => {
    try {
      const sessionId = sessionStorage.getItem('session_id')
      const res = await axios.get(`/api/usage?session=${sessionId}&model=${selectedModel}`)
      setUsageCount(res.data.count || 0)
    } catch (err) {
      // Ignore usage fetch errors
    }
  }

  useEffect(() => {
    checkHealth()
    fetchUsage()
    const healthInterval = setInterval(checkHealth, 30000)
    // Refresh usage every 3 seconds for real-time sync
    const usageInterval = setInterval(fetchUsage, 3000)
    
    // Listen for storage events (when AnalysisPage updates usage)
    const handleStorageChange = (e) => {
      if (e.key === 'magic_edit_quota' || e.key === 'usage_updated') {
        fetchUsage()
      }
    }
    window.addEventListener('storage', handleStorageChange)
    
    // Also listen for custom event within same tab
    const handleUsageUpdate = () => fetchUsage()
    window.addEventListener('usage_updated', handleUsageUpdate)
    
    return () => {
      clearInterval(healthInterval)
      clearInterval(usageInterval)
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('usage_updated', handleUsageUpdate)
    }
  }, [])

  useEffect(() => {
    fetchUsage()
  }, [selectedModel])

  // Save model selection
  const handleModelChange = (model) => {
    setSelectedModel(model)
    localStorage.setItem('image_model', model)
    datadogRum.addAction('model_changed', { model })
  }

  // Save API key with validation (debounced)
  const validateTimeoutRef = React.useRef(null)
  
  const handleApiKeyChange = (key) => {
    setCustomApiKey(key)
    localStorage.setItem('gemini_api_key', key)
    setApiKeyWarning('')
    
    // Clear previous timeout
    if (validateTimeoutRef.current) {
      clearTimeout(validateTimeoutRef.current)
    }
    
    if (key.length === 0) {
      setApiKeyStatus('idle')
      return
    }
    
    // Debounce validation (wait 1 second after user stops typing)
    if (key.length > 30) {
      setApiKeyStatus('validating')
      validateTimeoutRef.current = setTimeout(async () => {
        try {
          const res = await axios.post('/api/validate-key', {}, {
            headers: { 'X-User-API-Key': key },
            timeout: 15000 // 15 second timeout
          })
          
          if (res.data.valid) {
            if (res.data.tier === 'free') {
              setApiKeyStatus('valid-free')
              setApiKeyWarning(res.data.warning || 'Free tier may have limited image generation.')
            } else {
              setApiKeyStatus('valid')
              setApiKeyWarning(res.data.warning || '')
            }
          } else {
            setApiKeyStatus('invalid')
            setApiKeyWarning(res.data.message || 'Invalid API key')
          }
        } catch (e) {
          // Network error or timeout - assume key might be valid
          console.error('Validation error:', e)
          setApiKeyStatus('valid')
          setApiKeyWarning('Could not verify key. Will test on first use.')
        }
      }, 1000)
    } else {
      setApiKeyStatus('idle')
    }
  }

  const simulateError = async () => {
    datadogRum.addAction('simulate_error_click', { component: 'navbar' })
    try {
      await axios.post('/api/simulate-error')
    } catch (err) {
      // Intentionally ignored for simulation
    }
  }

  const currentModelConfig = IMAGE_MODELS[selectedModel]
  const hasCustomKey = customApiKey.length > 10
  const remainingUses = hasCustomKey ? '∞' : Math.max(0, currentModelConfig.limit - usageCount)

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
          <a href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <img src="/logo.webp" alt="Director's Eye" className="w-8 h-8 rounded-lg object-cover" />
            <span className="font-display font-bold tracking-tight text-sm text-white">
              Director's Eye
            </span>
          </a>

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

      {/* Config Panel (Enhanced with Model Selection & API Key) */}
      <AnimatePresence>
        {showConfig && (
          <>
            {/* Backdrop - click to close */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-30"
              onClick={() => setShowConfig(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="fixed top-24 inset-x-6 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 z-40 flex justify-center"
            >
             <div className="bento-card w-full max-w-96 shadow-2xl">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-semibold text-sm">Configuration</h4>
                  <button onClick={() => setShowConfig(false)} className="text-[var(--bento-muted)] hover:text-white text-xs">Close</button>
                </div>
                
                <div className="space-y-4 text-sm">
                  {/* Environment & Session */}
                  <div className="flex justify-between py-2 border-b border-[var(--bento-border)]">
                    <span className="text-[var(--bento-muted)]">Environment</span>
                    <span>Production</span>
                  </div>
                  
                  <div className="flex justify-between py-2 border-b border-[var(--bento-border)]">
                    <span className="text-[var(--bento-muted)]">Session ID</span>
                    <span className="font-mono text-[var(--bento-accent)] truncate ml-4">
                      {sessionStorage.getItem('session_id') || (() => {
                        const id = Math.random().toString(36).substring(7).toUpperCase();
                        sessionStorage.setItem('session_id', id);
                        return id;
                      })()}
                    </span>
                  </div>

                  {/* Image Model Selection */}
                  <div className="py-2 border-b border-[var(--bento-border)]">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-[var(--bento-accent)]" />
                      <span className="text-white font-medium">Image Generation Model</span>
                    </div>
                    <div className="space-y-2">
                      {Object.entries(IMAGE_MODELS).map(([key, model]) => (
                        <label 
                          key={key}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border",
                            selectedModel === key 
                              ? "bg-[var(--bento-accent)]/10 border-[var(--bento-accent)]" 
                              : "bg-[var(--bento-card)] border-[var(--bento-border)] hover:border-[var(--bento-accent)]/50"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="imageModel"
                              value={key}
                              checked={selectedModel === key}
                              onChange={() => handleModelChange(key)}
                              className="w-4 h-4 accent-[var(--bento-accent)]"
                            />
                            <div>
                              <div className="text-white font-medium">{model.name}</div>
                              <div className="text-xs text-[var(--bento-muted)]">{model.description}</div>
                            </div>
                          </div>
                          <span className="text-xs bg-[var(--bento-border)] px-2 py-1 rounded">
                            {hasCustomKey ? '∞' : `${model.limit}/day`}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Custom API Key Section */}
                  <div className="py-2 border-b border-[var(--bento-border)]">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Key className="w-4 h-4 text-[var(--bento-accent)]" />
                        <span className="text-white font-medium">Custom API Key</span>
                      </div>
                      <a 
                        href="https://aistudio.google.com/app/apikey" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-1 rounded-full hover:bg-[var(--bento-border)] transition-colors"
                        title="How to get your API key"
                      >
                        <HelpCircle className="w-4 h-4 text-[var(--bento-muted)]" />
                      </a>
                    </div>
                    
                    <div className="space-y-2">
                      <input
                        type="password"
                        placeholder="Enter your Gemini API key..."
                        value={customApiKey}
                        onChange={(e) => handleApiKeyChange(e.target.value)}
                        className={cn(
                          "w-full px-3 py-2 bg-[var(--bento-card)] border rounded-lg text-white placeholder-[var(--bento-muted)] focus:outline-none transition-colors",
                          apiKeyStatus === 'valid' ? "border-green-500 focus:border-green-500" :
                          apiKeyStatus === 'invalid' ? "border-red-500 focus:border-red-500" :
                          "border-[var(--bento-border)] focus:border-[var(--bento-accent)]"
                        )}
                      />
                      <div className="text-xs space-y-1">
                        {apiKeyStatus === 'validating' ? (
                          <span className="text-yellow-400 flex items-center gap-1">
                            <span className="w-3 h-3 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
                            Validating API key...
                          </span>
                        ) : apiKeyStatus === 'valid' ? (
                          <span className="text-green-400">✓ API key valid — Unlimited usage!</span>
                        ) : apiKeyStatus === 'valid-free' ? (
                          <span className="text-yellow-400">✓ API key valid (Free tier)</span>
                        ) : apiKeyStatus === 'invalid' ? (
                          <span className="text-red-400">✗ Invalid API key. Please check and try again.</span>
                        ) : hasCustomKey ? (
                          <span className="text-[var(--bento-success)]">✓ Using your API key — Unlimited usage!</span>
                        ) : (
                          <span className="text-[var(--bento-muted)]">Add your own key for unlimited usage</span>
                        )}
                        {/* Warning message for free tier or other issues */}
                        {apiKeyWarning && (apiKeyStatus === 'valid-free' || apiKeyStatus === 'valid') && (
                          <p className="text-yellow-400/80 text-[10px] leading-tight mt-1 p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                            ⚠️ {apiKeyWarning}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Usage Counter */}
                  <div className="flex justify-between py-2">
                    <span className="text-[var(--bento-muted)]">Usage Today</span>
                    <span className={cn(
                      "font-mono",
                      hasCustomKey ? "text-[var(--bento-success)]" : 
                        remainingUses === 0 ? "text-red-500" : "text-[var(--bento-accent)]"
                    )}>
                      {hasCustomKey ? '∞ Unlimited' : `${remainingUses}/${currentModelConfig.limit} remaining`}
                    </span>
                  </div>
                </div>
             </div>
          </motion.div>
          </>
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