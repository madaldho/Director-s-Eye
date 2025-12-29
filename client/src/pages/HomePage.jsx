import React, { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { datadogRum } from '@datadog/browser-rum'
import { motion } from 'framer-motion'
import { 
  Upload, 
  Activity,
  Zap,
  Eye,
  ArrowRight
} from 'lucide-react'
import axios from 'axios'
import { cn } from '../lib/utils'
import { SAMPLE_ANALYSIS } from '../data/sampleAnalysis'

const HomePage = ({ onAnalysisComplete, onTelemetryLog }) => {
  const [isUploading, setIsUploading] = useState(false)

  const navigate = useNavigate()

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0]
    if (!file) return
    setIsUploading(true)
    datadogRum.addAction('image_upload_started', { fileSize: file.size })
    onTelemetryLog({ type: 'info', message: `Uploading ${file.name}` })

    try {
      const formData = new FormData()
      formData.append('image', file)

      const response = await axios.post('/api/analyze', formData)
      
      const reader = new FileReader()
      reader.onload = () => {
        onAnalysisComplete(response.data, reader.result)
        navigate('/analysis')
      }
      reader.readAsDataURL(file)
    } catch (error) {
      datadogRum.addError(error)
      alert("Analysis failed. See console.")
    } finally {
      setIsUploading(false)
    }
  }, [navigate, onAnalysisComplete, onTelemetryLog])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': ['.jpeg', '.png'] }, maxFiles: 1, disabled: isUploading
  })

  // Loading State Logic
  const [loadingText, setLoadingText] = useState('Initializing Director...')
  
  useEffect(() => {
    let interval
    if (isUploading) {
      const phrases = [
        "Calibrating visual sensors...",
        "Analyzing lighting ratios...", 
        "Deconstructing composition...",
        "Measuring color harmony...",
        "Consulting the archives...",
        "Finalizing director's score..."
      ]
      let i = 0
      setLoadingText(phrases[0])
      interval = setInterval(() => {
        i = (i + 1) % phrases.length
        setLoadingText(phrases[i])
      }, 800)
    }
    return () => clearInterval(interval)
  }, [isUploading])

  return (
    <div className="min-h-screen pt-24 pb-12 px-6 max-w-7xl mx-auto flex flex-col justify-center">
      
      {/* Header */}
      <div className="text-center mb-12 fade-in">
        <span className="inline-block py-1 px-3 rounded-full bg-[var(--bento-card)] border border-[var(--bento-border)] text-xs font-medium text-[var(--bento-accent)] mb-4">
          Best Cinematography Analysis
        </span>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-4 text-white font-display">
          Director's <span className="text-[var(--bento-accent)]">Eye</span>
        </h1>
        <p className="text-lg text-[var(--bento-muted)] max-w-2xl mx-auto">
          Professional cinematography analysis powered by <span className="text-white font-medium">AI</span>. 
          Instant grading on lighting, composition, and mood.
        </p>
      </div>



      {/* 1. Main Upload Section (Top) */}
      <motion.div 
        className="w-full max-w-4xl mx-auto mb-16 relative group"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div 
          {...getRootProps()}
          className={cn(
            "w-full h-auto py-12 md:py-0 md:h-full md:aspect-[21/9] bento-card flex flex-col items-center justify-center cursor-pointer border-dashed hover:border-[var(--bento-accent)] bg-[var(--bento-card)] relative overflow-hidden transition-all",
            isDragActive && "border-[var(--bento-accent)] bg-[var(--bento-accent)]/5"
          )}
        >
          <input {...getInputProps()} />
          
          {/* Background Gradient */}
          <div className="absolute inset-0 bg-gradient-to-tr from-[var(--bento-accent)]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          <div className="relative z-10 flex flex-col items-center">
            <div className="w-20 h-20 rounded-2xl bg-[var(--bento-accent)] flex items-center justify-center mb-6 shadow-xl shadow-[var(--bento-accent)]/20 group-hover:scale-110 transition-transform duration-300">
              {isUploading ? (
                <Activity className="w-10 h-10 text-white animate-spin" />
              ) : (
                <Upload className="w-10 h-10 text-white" />
              )}
            </div>
            <h3 className="text-3xl font-bold text-white mb-2 font-display min-h-[40px] flex items-center">
              {isUploading ? (
                <span className="animate-pulse">{loadingText}</span>
              ) : (
                'Drop Footage Here'
              )}
            </h3>
            <p className="text-[var(--bento-muted)] mb-8">
              {isUploading ? 'Gemini 2.5 Flash Lite is thinking...' : 'Support JPG, PNG up to 10MB'}
            </p>
            
            {!isUploading && (
              <button className="px-8 py-3 rounded-xl bg-white text-black font-bold text-sm hover:bg-gray-200 transition-colors shadow-lg shadow-white/10">
                Select File
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* 2. Smart Suggestions (Middle) */}
      <div className="max-w-5xl mx-auto mb-16">
        <div className="flex items-center gap-4 mb-8">
           <div className="h-px flex-1 bg-[var(--bento-border)]" />
           <span className="text-xs font-semibold text-[var(--bento-muted)] uppercase tracking-widest">
             Or Try Instant Analysis 
           </span>
           <div className="h-px flex-1 bg-[var(--bento-border)]" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { id: 'landscape', img: '/samples/landscape.webp', label: 'Landscape', icon: Eye },
            { id: 'christmas', img: '/samples/christmas.webp', label: 'Low Light', icon: Zap },
            { id: 'portrait', img: '/samples/portrait.webp', label: 'Portrait', icon: Activity },
          ].map((sample) => (
            <motion.div
              key={sample.id}
              whileHover={{ y: -5 }}
              className="bento-card group cursor-pointer relative overflow-hidden aspect-[4/3] p-0 border-0 shadow-lg shadow-black/50"
              onClick={() => {
                const result = SAMPLE_ANALYSIS[sample.id];
                onTelemetryLog({ type: 'info', message: `Quick Analysis: ${sample.label}` });
                onAnalysisComplete(result, sample.img);
                navigate('/analysis');
              }}
            >
              <img 
                src={sample.img} 
                alt={sample.label} 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-6">
                 <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2 text-white">
                     <div className="p-2 rounded-lg bg-white/20 backdrop-blur-md">
                       <sample.icon className="w-4 h-4" />
                     </div>
                     <span className="font-semibold text-sm">{sample.label}</span>
                   </div>
                   <span className="text-[10px] bg-[var(--bento-accent)] px-2 py-0.5 rounded text-white font-bold tracking-wider">INSTANT</span>
                 </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* 3. Feature Info Cards (Bottom) */}
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* Feature 1: Datadog */}
          <motion.div 
            className="bento-card relative overflow-hidden flex flex-row items-center gap-4 p-6 group cursor-default"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#6366f1] blur-[60px] opacity-10 group-hover:opacity-20 transition-opacity" />
            <div className="w-12 h-12 rounded-xl bg-[#634FDD]/20 flex items-center justify-center text-[#634FDD] shrink-0">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Deep Observability</h3>
              <p className="text-xs text-[var(--bento-muted)]">Real-time measurements with Datadog RUM & Tracing</p>
            </div>
          </motion.div>

          {/* Feature 2: Gemini */}
          <motion.div 
            className="bento-card relative overflow-hidden flex flex-row items-center gap-4 p-6 group cursor-default"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
             <div className="absolute top-0 right-0 w-32 h-32 bg-[#4aaefa] blur-[60px] opacity-10 group-hover:opacity-20 transition-opacity" />
            <div className="w-12 h-12 rounded-xl bg-[#4aaefa]/20 flex items-center justify-center text-[#4aaefa] shrink-0">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Gemini AI</h3>
              <p className="text-xs text-[var(--bento-muted)]">Sub-second multimodal cinematography grading</p>
            </div>
          </motion.div>
      </div>

      <div className="mt-12 text-center pb-8 opacity-40 hover:opacity-100 transition-opacity">
         <p className="text-xs text-[var(--bento-muted)] font-mono">
           Director's Eye — AI Cinematography Analysis
         </p>
      </div>

    </div>
  )
}

export default HomePage