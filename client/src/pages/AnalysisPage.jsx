import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { datadogRum } from '@datadog/browser-rum'
import { 
  ArrowLeft, 
  MessageCircle, 
  Send, 
  Copy, 
  CheckCircle,
  Lightbulb,
  Camera,
  Palette
} from 'lucide-react'
import { motion } from 'framer-motion'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import axios from 'axios'

const AnalysisPage = ({ result, image, onTelemetryLog }) => {
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [isChatting, setIsChatting] = useState(false)
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!result || !image) {
      navigate('/')
      return
    }
    
    // Track page view
    datadogRum.startView('analysis')
    
    onTelemetryLog({
      type: 'info',
      message: `Analysis page loaded - Score: ${result.score}/100`
    })
  }, [result, image, navigate])

  const sendChatMessage = async () => {
    if (!chatInput.trim() || isChatting) return

    const userMessage = chatInput.trim()
    setChatInput('')
    setIsChatting(true)

    // Add user message
    setChatMessages(prev => [...prev, {
      type: 'user',
      content: userMessage,
      timestamp: new Date().toLocaleTimeString()
    }])

    onTelemetryLog({
      type: 'trace',
      message: `Chat request: "${userMessage.substring(0, 50)}..."`
    })

    try {
      const imageBase64 = image.split(',')[1] // Remove data:image/jpeg;base64, prefix
      
      const response = await axios.post('/api/chat', {
        message: userMessage,
        imageContext: imageBase64
      })

      setChatMessages(prev => [...prev, {
        type: 'assistant',
        content: response.data.reply,
        timestamp: new Date().toLocaleTimeString()
      }])

      onTelemetryLog({
        type: 'success',
        message: 'Chat response received'
      })

    } catch (error) {
      setChatMessages(prev => [...prev, {
        type: 'error',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toLocaleTimeString()
      }])

      onTelemetryLog({
        type: 'error',
        message: `Chat failed: ${error.message}`
      })
    } finally {
      setIsChatting(false)
    }
  }

  const copyPrompt = () => {
    navigator.clipboard.writeText(result.prompt)
    setCopiedPrompt(true)
    setTimeout(() => setCopiedPrompt(false), 2000)
    
    onTelemetryLog({
      type: 'info',
      message: 'Stable Diffusion prompt copied to clipboard'
    })
  }

  if (!result || !image) {
    return null
  }

  // Gauge chart data
  const gaugeData = [
    { name: 'Score', value: result.score, color: '#3B82F6' },
    { name: 'Remaining', value: 100 - result.score, color: '#1F2937' }
  ]

  // Metrics data
  const metrics = [
    { name: 'Lighting', value: result.lighting, max: 10, icon: Lightbulb, color: 'text-yellow-400' },
    { name: 'Composition', value: result.composition, max: 10, icon: Camera, color: 'text-blue-400' },
    { name: 'Mood', value: result.mood, max: 10, icon: Palette, color: 'text-purple-400' }
  ]

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Upload</span>
          </button>
          
          <h1 className="text-2xl font-bold gradient-text">
            Cinematography Analysis
          </h1>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Visual */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {/* Image Preview */}
            <div className="glass rounded-2xl p-6">
              <img
                src={image}
                alt="Analyzed"
                className="w-full h-64 object-cover rounded-xl mb-4"
              />
              
              {/* Cinematic Score Gauge */}
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-4">Cinematic Score</h3>
                <div className="relative w-48 h-48 mx-auto">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={gaugeData}
                        cx="50%"
                        cy="50%"
                        startAngle={90}
                        endAngle={-270}
                        innerRadius={60}
                        outerRadius={80}
                        dataKey="value"
                      >
                        {gaugeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-400">
                        {result.score}
                      </div>
                      <div className="text-sm text-gray-400">out of 100</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right Column - Data & Insights */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {/* Metrics */}
            <div className="glass rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-4">Detailed Metrics</h3>
              <div className="space-y-4">
                {metrics.map((metric) => (
                  <div key={metric.name} className="flex items-center space-x-4">
                    <metric.icon className={`w-5 h-5 ${metric.color}`} />
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">{metric.name}</span>
                        <span className="text-sm text-gray-400">
                          {metric.value}/{metric.max}
                        </span>
                      </div>
                      <div className="w-full bg-dark-800 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-1000"
                          style={{ width: `${(metric.value / metric.max) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Critique */}
            <div className="glass rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-4">AI Director's Critique</h3>
              <p className="text-gray-300 leading-relaxed">
                {result.critique}
              </p>
            </div>

            {/* Prompt Generator */}
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Stable Diffusion Prompt</h3>
                <button
                  onClick={copyPrompt}
                  className="flex items-center space-x-2 px-3 py-1 bg-blue-600/20 text-blue-400 border border-blue-600/30 rounded-md hover:bg-blue-600/30 transition-colors"
                >
                  {copiedPrompt ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span className="text-sm">Copy</span>
                    </>
                  )}
                </button>
              </div>
              <div className="bg-dark-900 rounded-lg p-4 terminal-text text-sm">
                {result.prompt}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Chat Interface */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 glass rounded-2xl p-6"
        >
          <div className="flex items-center space-x-2 mb-4">
            <MessageCircle className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold">Chat with Director</h3>
          </div>

          {/* Chat Messages */}
          <div className="h-64 overflow-y-auto mb-4 space-y-3 bg-dark-900/50 rounded-lg p-4">
            {chatMessages.length === 0 ? (
              <div className="text-gray-500 italic text-center py-8">
                Ask me anything about this image's cinematography...
              </div>
            ) : (
              chatMessages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.type === 'user'
                        ? 'bg-blue-600 text-white'
                        : message.type === 'error'
                        ? 'bg-red-600/20 text-red-400 border border-red-600/30'
                        : 'bg-dark-700 text-gray-300'
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    <p className="text-xs opacity-70 mt-1">{message.timestamp}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Chat Input */}
          <div className="flex space-x-3">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
              placeholder="Ask about lighting, composition, or get improvement tips..."
              className="flex-1 px-4 py-2 bg-dark-800 border border-dark-600 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
              disabled={isChatting}
            />
            <button
              onClick={sendChatMessage}
              disabled={!chatInput.trim() || isChatting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isChatting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default AnalysisPage