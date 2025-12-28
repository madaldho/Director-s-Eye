import React, { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { datadogRum } from '@datadog/browser-rum'
import { motion } from 'framer-motion'
import { 
  Upload, 
  Activity,
  Zap,
  Eye,
  Sparkles
} from 'lucide-react'
import axios from 'axios'
import { Button } from '../components/ui/Button'
import { Card, CardContent } from '../components/ui/Card'
import { cn } from '../lib/utils'

const HomePage = ({ onAnalysisComplete, onTelemetryLog }) => {
  const [isUploading, setIsUploading] = useState(false)
  const [demoMode, setDemoMode] = useState(true)
  const [dragActive, setDragActive] = useState(false)
  const navigate = useNavigate()

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0]
    if (!file) return

    setIsUploading(true)
    
    datadogRum.addAction('image_upload_started', {
      fileSize: file.size,
      fileType: file.type,
      demoMode
    })

    onTelemetryLog({
      type: 'info',
      message: `Uploading ${file.name} (${(file.size / 1024).toFixed(1)}KB)`
    })

    try {
      const formData = new FormData()
      formData.append('image', file)
      formData.append('demoMode', demoMode.toString())

      onTelemetryLog({
        type: 'trace',
        message: `Sending to Gemini AI (Demo: ${demoMode ? 'ACTIVE' : 'INACTIVE'})`
      })

      const response = await axios.post('/api/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      const reader = new FileReader()
      reader.onload = () => {
        onAnalysisComplete(response.data, reader.result)
        navigate('/analysis')
      }
      reader.readAsDataURL(file)

    } catch (error) {
      console.error('Analysis failed:', error)
      datadogRum.addError(error, { errorType: 'analysis_failed' })
      onTelemetryLog({
        type: 'error',
        message: `Analysis failed: ${error.response?.data?.message || error.message}`
      })
    } finally {
      setIsUploading(false)
    }
  }, [demoMode, navigate, onAnalysisComplete, onTelemetryLog])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    maxFiles: 1,
    disabled: isUploading,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
  })

  // Sci-Fi Feature icons
  const features = [
    {
      icon: Eye,
      title: 'Neural Vision v2.0',
      description: 'Powered by Gemini 2.0 Flash for sub-second analysis',
      gradient: 'bg-gradient-to-br from-[var(--cyber-cyan)] to-[var(--nebula-purple)]'
    },
    {
      icon: Activity,
      title: 'Deep Observability',
      description: 'End-to-end tracing via Datadog Neural Network',
      gradient: 'bg-gradient-to-br from-[var(--matrix-green)] to-[var(--cyber-cyan)]'
    },
    {
      icon: Zap,
      title: 'Instant Feedback',
      description: 'Quantum-speed processing for immediate insights',
      gradient: 'bg-gradient-to-br from-[var(--plasma-pink)] to-[var(--nebula-purple)]'
    }
  ]

  return (
    <div className="min-h-screen bg-[var(--space-black)]">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        
        {/* Aurora Background Effects - Sci-Fi Edition */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[var(--nebula-purple)] rounded-full mix-blend-screen filter blur-[100px] opacity-20 animate-pulse-glow" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-[var(--cyber-cyan)] rounded-full mix-blend-screen filter blur-[100px] opacity-20 animate-float" />
          
          {/* Holographic Grid */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,243,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,243,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_100%)] opacity-30" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="mb-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--cyber-cyan)]/30 bg-[var(--cyber-cyan)]/10 backdrop-blur-md mb-8 shadow-[0_0_15px_rgba(0,243,255,0.2)]">
              <span className="w-2 h-2 rounded-full bg-[var(--cyber-cyan)] animate-pulse shadow-[0_0_10px_var(--cyber-cyan)]" />
              <span className="text-[var(--cyber-cyan)] text-xs font-mono tracking-widest uppercase">
                AI Neural Interface v2.0 // ONLINE
              </span>
            </div>
            
            <h1 className="text-5xl md:text-8xl font-bold tracking-tight mb-6 font-display">
              <span className="block text-white mb-2 tracking-wide drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">DIRECTOR'S</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--cyber-cyan)] via-white to-[var(--nebula-purple)] animate-pulse-glow drop-shadow-[0_0_20px_var(--cyber-cyan)]">
                EYE
              </span>
            </h1>
            
            <p className="text-xl text-zinc-400 max-w-2xl mx-auto font-light leading-relaxed font-mono">
              Advanced cinematography analysis system powered by <span className="text-[var(--cyber-cyan)]">Gemini 2.0 Flash</span> and real-time Neural Observability.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex justify-center mb-12"
          >
            <button
              onClick={() => setDemoMode(!demoMode)}
              className={cn(
                'flex items-center gap-3 px-6 py-3 rounded-full border transition-all duration-300 backdrop-blur-sm font-mono text-xs tracking-widest',
                demoMode 
                  ? 'bg-[var(--nebula-purple)]/10 border-[var(--nebula-purple)]/30 text-[var(--nebula-purple)] shadow-[0_0_15px_rgba(112,0,255,0.2)]' 
                  : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10'
              )}
            >
              <div className={cn(
                'w-8 h-4 rounded-full p-0.5 transition-colors duration-300 relative',
                demoMode ? 'bg-[var(--nebula-purple)]' : 'bg-zinc-700'
              )}>
                <div className={cn(
                  'w-3 h-3 rounded-full bg-white transition-transform duration-300 shadow-sm',
                  demoMode ? 'translate-x-4' : 'translate-x-0'
                )} />
              </div>
              <span>
                SIMULATION_MODE: {demoMode ? 'ACTIVE' : 'STANDBY'}
              </span>
            </button>
          </motion.div>

          {/* Upload Zone - HUD Style */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="max-w-2xl mx-auto"
          >
            <div
              {...getRootProps()}
              className={cn(
                'relative group cursor-pointer rounded-3xl border border-dashed p-10 transition-all duration-500 ease-out glass-hud',
                isDragActive || dragActive
                  ? 'border-[var(--cyber-cyan)] bg-[var(--cyber-cyan)]/10 scale-[1.02] shadow-[0_0_30px_rgba(0,243,255,0.2)]'
                  : 'border-white/10 hover:border-[var(--cyber-cyan)]/50 hover:bg-white/5',
                isUploading && 'pointer-events-none opacity-80'
              )}
            >
              <input {...getInputProps()} />
              
              {/* Corner Brackets for HUD feel */}
              <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-[var(--cyber-cyan)] opacity-50" />
              <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-[var(--cyber-cyan)] opacity-50" />
              <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-[var(--cyber-cyan)] opacity-50" />
              <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-[var(--cyber-cyan)] opacity-50" />
              
              <div className="flex flex-col items-center text-center relative z-10">
                {isUploading ? (
                  <>
                    <div className="relative mb-8">
                      <div className="absolute inset-0 bg-[var(--cyber-cyan)]/20 rounded-full blur-xl animate-pulse" />
                      <div className="relative w-24 h-24 rounded-full border-4 border-white/10 border-t-[var(--cyber-cyan)] animate-spin" />
                      <Sparkles className="absolute inset-0 m-auto w-10 h-10 text-[var(--cyber-cyan)] animate-pulse" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2 font-display tracking-wide">
                      NEURAL_ANALYSIS_INIT...
                    </h3>
                    <p className="text-[var(--cyber-cyan)] font-mono text-xs">
                      {demoMode ? 'GENERATING_SYNTHETIC_METRICS' : 'CONNECTING_TO_GEMINI_CORE'}
                    </p>
                  </>
                ) : (
                  <>
                    <div className={cn(
                      'w-24 h-24 rounded-full flex items-center justify-center mb-8 transition-all duration-500 shadow-[0_0_20px_rgba(0,0,0,0.5)] border border-white/5',
                      isDragActive 
                        ? 'bg-[var(--cyber-cyan)] text-black translate-y-[-10px] shadow-[0_0_30px_var(--cyber-cyan)]' 
                        : 'bg-gradient-to-br from-zinc-800 to-zinc-950 text-[var(--cyber-cyan)] group-hover:scale-110 group-hover:border-[var(--cyber-cyan)]'
                    )}>
                      <Upload className="w-10 h-10" />
                    </div>
                    <h3 className="text-3xl font-bold text-white mb-3 font-display">
                      {isDragActive ? 'System Ready: Drop File' : 'Initialize Analysis'}
                    </h3>
                    <p className="text-zinc-400 mb-8 font-mono text-xs tracking-wide">
                      Upload footage for immediate neural evaluation
                    </p>
                    
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="bg-white text-black px-10 py-4 rounded-full font-bold tracking-widest hover:bg-[var(--cyber-cyan)] hover:text-black transition-all hover:shadow-[0_0_20px_var(--cyber-cyan)] font-mono text-xs uppercase"
                    >
                      [ Select Source File ]
                    </motion.button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section - HUD Cards */}
      <section className="relative py-32 border-t border-[var(--cyber-cyan)]/10 bg-black/50 overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[var(--cyber-cyan)] to-transparent opacity-30" />
        
        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full bg-black/40 border border-white/10 hover:border-[var(--cyber-cyan)]/50 transition-all duration-500 group overflow-hidden hover:shadow-[0_0_20px_rgba(0,243,255,0.1)]">
                  <div className={cn(
                    "absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500",
                    feature.gradient
                  )} />
                  <CardContent className="p-8 relative">
                    <div className={cn(
                      'w-12 h-12 rounded-lg flex items-center justify-center mb-6 shadow-lg',
                      feature.gradient
                    )}>
                      <feature.icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3 font-display tracking-wide">
                      {feature.title}
                    </h3>
                    <p className="text-zinc-400 text-sm font-mono leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

export default HomePage