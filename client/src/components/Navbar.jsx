import React, { useState } from 'react'
import { Camera, Settings, AlertTriangle, CheckCircle } from 'lucide-react'
import { datadogRum } from '@datadog/browser-rum'
import axios from 'axios'

const Navbar = ({ onTelemetryLog }) => {
  const [systemStatus, setSystemStatus] = useState('healthy')
  const [showConfig, setShowConfig] = useState(false)

  const checkSystemHealth = async () => {
    try {
      const response = await axios.get('/api/health')
      setSystemStatus('healthy')
      onTelemetryLog({
        type: 'info',
        message: 'System health check: OK'
      })
    } catch (error) {
      setSystemStatus('incident')
      onTelemetryLog({
        type: 'error',
        message: 'System health check: FAILED'
      })
    }
  }

  const simulateError = async () => {
    try {
      await axios.post('/api/simulate-error')
    } catch (error) {
      setSystemStatus('incident')
      onTelemetryLog({
        type: 'error',
        message: 'CRITICAL: Simulated system failure triggered'
      })
      
      datadogRum.addError(new Error('Simulated critical system failure'), {
        errorType: 'simulated_failure',
        severity: 'critical'
      })
    }
  }

  React.useEffect(() => {
    checkSystemHealth()
    const interval = setInterval(checkSystemHealth, 30000) // Check every 30s
    return () => clearInterval(interval)
  }, [])

  return (
    <nav className="glass border-b border-white/10 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center space-x-3">
          <Camera className="w-8 h-8 text-blue-400" />
          <h1 className="text-2xl font-bold gradient-text">
            Director's Eye
          </h1>
        </div>

        {/* Status & Controls */}
        <div className="flex items-center space-x-4">
          {/* System Status */}
          <div className="flex items-center space-x-2">
            {systemStatus === 'healthy' ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-green-400 text-sm font-medium">
                  System Healthy
                </span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-5 h-5 text-red-400 animate-pulse" />
                <span className="text-red-400 text-sm font-medium">
                  Incident Detected
                </span>
              </>
            )}
          </div>

          {/* Demo Controls */}
          <button
            onClick={simulateError}
            className="px-3 py-1 text-xs bg-red-600/20 text-red-400 border border-red-600/30 rounded-md hover:bg-red-600/30 transition-colors"
          >
            Simulate Error
          </button>

          {/* Config Button */}
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="p-2 glass glass-hover rounded-lg"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Config Panel */}
      {showConfig && (
        <div className="mt-4 p-4 glass rounded-lg">
          <h3 className="text-lg font-semibold mb-3">Configuration</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <label className="block text-gray-400 mb-1">Datadog RUM Status</label>
              <span className="text-green-400">✓ Connected</span>
            </div>
            <div>
              <label className="block text-gray-400 mb-1">Vertex AI Status</label>
              <span className="text-green-400">✓ Ready</span>
            </div>
            <div>
              <label className="block text-gray-400 mb-1">Service Version</label>
              <span className="text-blue-400">v1.0.0</span>
            </div>
            <div>
              <label className="block text-gray-400 mb-1">Environment</label>
              <span className="text-purple-400">production</span>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}

export default Navbar