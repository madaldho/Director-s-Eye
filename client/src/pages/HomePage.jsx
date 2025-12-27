import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { datadogRum } from '@datadog/browser-rum'
import { Upload, Camera, Sparkles, ToggleLeft, ToggleRight } from 'lucide-react'
import { motion } from 'framer-motion'
import axios from 'axios'

const HomePage = ({ onAnalysisComplete, onTelemetryLog }) => {
  const [isUploading, setIsUploading] = useState(false)
  const [demoMode, setDemoMode] = useState(true)
  const navigate = useNavigate()

  const onDrop = async (acceptedFiles) => {
    const file = acceptedFiles[0]
    if (!file) return

    setIsUploading(true)
    
    // Track RUM action
    datadogRum.addAction('image_upload_started', {
      fileSize: file.size,
      fileType: file.type,
      demoMode
    })

    onTelemetryLog({
      type: 'info',
      message: `Starting analysis - File: ${file.name} (${(file.size / 1024).toFixed(1)}KB)`
    })

    try {
      const formData = new FormData()
      formData.append('image', file)
      formData.append('demoMode', demoMode.toString())

      onTelemetryLog({
        type: 'trace',
        message: `Sending request to Vertex AI (Demo: ${demoMode ? 'ON' : 'OFF'})`
      })

      const response = await axios.post('/api/analyze', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      // Convert file to base64 for display
      const reader = new FileReader()
      reader.onload = () => {
        onAnalysisComplete(response.data, reader.result)
        navigate('/analysis')
      }
      reader.readAsDataURL(file)

    } catch (error) {
      console.error('Analysis failed:', error)
      
      datadogRum.addError(error, {
        errorType: 'analysis_failed',
        fileSize: file.size
      })

      onTelemetryLog({
        type: 'error',
        message: `Analysis failed: ${error.response?.data?.message || error.message}`
      })
    } finally {
      setIsUploading(false)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    maxFiles: 1,
    disabled: isUploading
  })

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-4xl mx-auto text-center">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-12"
        >
          <h1 className="text-6xl font-bold mb-6">
            <span className="gradient-text">Director's Eye</span>
          </h1>
          <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
            Analyze your photos with AI-powered cinematography insights. 
            Get professional feedback on lighting, composition, and mood using Google Vertex AI.
          </p>
          
          {/* Demo Mode Toggle */}
          <div className="flex items-center justify-center space-x-3 mb-8">
            <span className="text-sm text-gray-400">Demo Mode</span>
            <button
              onClick={() => setDemoMode(!demoMode)}
              className="flex items-center"
            >
              {demoMode ? (
                <ToggleRight className="w-8 h-8 text-green-400" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-gray-600" />
              )}
            </button>
            <span className={`text-sm ${demoMode ? 'text-green-400' : 'text-gray-600'}`}>
              {demoMode ? 'ON' : 'OFF'}
            </span>
          </div>
          
          {demoMode && (
            <div className="text-sm text-yellow-400 mb-6 p-3 glass rounded-lg max-w-md mx-auto">
              <Sparkles className="w-4 h-4 inline mr-2" />
              Demo mode uses dummy data for smooth presentation without API keys
            </div>
          )}
        </motion.div>

        {/* Upload Zone */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mb-8"
        >
          <div
            {...getRootProps()}
            className={`
              relative p-12 border-2 border-dashed rounded-2xl cursor-pointer
              transition-all duration-300 glass
              ${isDragActive 
                ? 'border-blue-400 bg-blue-400/10' 
                : 'border-gray-600 hover:border-gray-500 glass-hover'
              }
              ${isUploading ? 'pointer-events-none opacity-50' : ''}
            `}
          >
            <input {...getInputProps()} />
            
            <div className="flex flex-col items-center space-y-4">
              {isUploading ? (
                <>
                  <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-lg font-medium text-blue-400">
                    Analyzing with AI...
                  </p>
                  <p className="text-sm text-gray-400">
                    {demoMode ? 'Generating demo insights' : 'Processing with Gemini Pro Vision'}
                  </p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 glass rounded-full flex items-center justify-center">
                    {isDragActive ? (
                      <Upload className="w-8 h-8 text-blue-400" />
                    ) : (
                      <Camera className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                  
                  <div>
                    <p className="text-lg font-medium mb-2">
                      {isDragActive 
                        ? 'Drop your image here' 
                        : 'Upload an image to analyze'
                      }
                    </p>
                    <p className="text-sm text-gray-400">
                      Supports JPEG, PNG, WebP • Max 10MB
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {[
            {
              icon: Camera,
              title: 'AI Analysis',
              description: 'Powered by Google Vertex AI Gemini Pro Vision'
            },
            {
              icon: Sparkles,
              title: 'Cinematic Scoring',
              description: 'Get detailed scores for lighting, composition & mood'
            },
            {
              icon: Upload,
              title: 'Instant Results',
              description: 'Real-time analysis with Datadog observability'
            }
          ].map((feature, index) => (
            <div key={index} className="p-6 glass rounded-xl">
              <feature.icon className="w-8 h-8 text-blue-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-400">{feature.description}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}

export default HomePage