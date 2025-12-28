import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { datadogRum } from '@datadog/browser-rum'
import { motion } from 'framer-motion'
import { 
  ArrowLeft, 
  MessageCircle, 
  Send, 
  Copy, 
  Check,
  Sun,
  Grid3X3,
  Palette,
  Sparkles,
  Download
} from 'lucide-react'
import axios from 'axios'
import { Button } from '../components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Progress } from '../components/ui/Progress'
import { cn } from '../lib/utils'

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
    datadogRum.startView('analysis')
    onTelemetryLog({
      type: 'success',
      message: `Analysis loaded - Score: ${result.score}/100`
    })
  }, [result, image, navigate, onTelemetryLog])

  const sendChatMessage = async () => {
    if (!chatInput.trim() || isChatting) return

    const userMessage = chatInput.trim()
    setChatInput('')
    setIsChatting(true)

    setChatMessages(prev => [...prev, {
      type: 'user',
      content: userMessage,
      timestamp: new Date().toLocaleTimeString()
    }])

    onTelemetryLog({
      type: 'trace',
      message: `Chat: "${userMessage.substring(0, 40)}..."`
    })

    try {
      const imageBase64 = image.split(',')[1]
      const response = await axios.post('/api/chat', {
        message: userMessage,
        imageContext: imageBase64
      })

      setChatMessages(prev => [...prev, {
        type: 'assistant',
        content: response.data.reply,
        timestamp: new Date().toLocaleTimeString()
      }])

      onTelemetryLog({ type: 'success', message: 'Chat response received' })
    } catch (error) {
      setChatMessages(prev => [...prev, {
        type: 'error',
        content: 'Failed to get response. Please try again.',
        timestamp: new Date().toLocaleTimeString()
      }])
      onTelemetryLog({ type: 'error', message: `Chat failed: ${error.message}` })
    } finally {
      setIsChatting(false)
    }
  }

  const copyPrompt = () => {
    navigator.clipboard.writeText(result.prompt)
    setCopiedPrompt(true)
    setTimeout(() => setCopiedPrompt(false), 2000)
    onTelemetryLog({ type: 'info', message: 'Prompt copied to clipboard' })
  }

  if (!result || !image) return null

  const metrics = [
    { name: 'Lighting', value: result.lighting, icon: Sun, color: 'text-amber-400' },
    { name: 'Composition', value: result.composition, icon: Grid3X3, color: 'text-indigo-400' },
    { name: 'Mood', value: result.mood, icon: Palette, color: 'text-purple-400' }
  ]

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-emerald-400'
    if (score >= 60) return 'text-indigo-400'
    if (score >= 40) return 'text-amber-400'
    return 'text-red-400'
  }

  const getScoreLabel = (score) => {
    if (score >= 90) return 'Masterpiece'
    if (score >= 80) return 'Excellent'
    if (score >= 70) return 'Very Good'
    if (score >= 60) return 'Good'
    if (score >= 50) return 'Average'
    return 'Needs Work'
  }

  return (
    <div className="min-h-screen bg-black py-8 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-indigo-900/20 to-transparent pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/')} 
            className="gap-2 text-zinc-400 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <Badge variant="success" className="gap-2 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
            <Sparkles className="w-3 h-3" />
            Analysis Complete
          </Badge>
        </div>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Left Column - Image & Score */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image Preview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="overflow-hidden border-white/10 bg-zinc-900">
                <div className="aspect-video relative group">
                  <img
                    src={image}
                    alt="Analyzed"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <Badge variant="secondary" className="bg-white/10 text-white backdrop-blur-md">Analyzed Image</Badge>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Score Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="border-white/10 bg-zinc-900/50 backdrop-blur-sm">
                <CardContent className="p-8 text-center">
                  <p className="text-sm text-zinc-500 uppercase tracking-widest mb-2 font-medium">
                    Cinematic Score
                  </p>
                  <div className={cn('text-8xl font-bold mb-2 tracking-tighter', getScoreColor(result.score))}>
                    {result.score}
                  </div>
                  <p className="text-zinc-500 mb-6">out of 100</p>
                  <Badge 
                    variant={result.score >= 70 ? 'success' : result.score >= 50 ? 'warning' : 'destructive'}
                    className="text-sm px-6 py-1.5"
                  >
                    {getScoreLabel(result.score)}
                  </Badge>
                </CardContent>
              </Card>
            </motion.div>

            {/* Metrics */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="border-white/10 bg-zinc-900/50">
                <CardHeader>
                  <CardTitle className="text-lg text-white">Detailed Metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {metrics.map((metric, index) => (
                    <div key={index}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <metric.icon className={cn('w-4 h-4', metric.color)} />
                          <span className="text-sm font-medium text-zinc-300">{metric.name}</span>
                        </div>
                        <span className={cn('text-sm font-bold', metric.color)}>
                          {metric.value}/10
                        </span>
                      </div>
                      <Progress value={metric.value} max={10} className="bg-white/5" indicatorClassName={metric.color.replace('text-', 'bg-')} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Right Column - Insights & Chat */}
          <div className="lg:col-span-3 space-y-6">
            {/* AI Critique */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="border-white/10 bg-zinc-900/50 h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Sparkles className="w-5 h-5 text-indigo-400" />
                    AI Director's Critique
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-zinc-300 leading-relaxed text-lg font-light">
                    {result.critique}
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Prompt Generator */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="border-white/10 bg-zinc-900/50">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg text-white">Stable Diffusion Prompt</CardTitle>
                  <Button variant="secondary" size="sm" onClick={copyPrompt} className="gap-2 bg-white/10 hover:bg-white/20 text-white border-none">
                    {copiedPrompt ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy
                      </>
                    )}
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="bg-black/50 rounded-xl p-6 font-mono text-sm text-indigo-200 border border-indigo-500/10 shadow-inner">
                    {result.prompt}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Chat Interface */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card className="border-white/10 bg-zinc-900/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <MessageCircle className="w-5 h-5 text-purple-400" />
                    Chat with AI Director
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Messages */}
                  <div className="h-80 overflow-y-auto mb-4 space-y-4 bg-black/20 rounded-xl p-4 border border-white/5 custom-scrollbar">
                    {chatMessages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-sm gap-2 opacity-50">
                        <MessageCircle className="w-8 h-8" />
                        <p>Ask anything about cinematography...</p>
                      </div>
                    ) : (
                      chatMessages.map((msg, index) => (
                        <div
                          key={index}
                          className={cn(
                            'flex',
                            msg.type === 'user' ? 'justify-end' : 'justify-start'
                          )}
                        >
                          <div
                            className={cn(
                              'max-w-[80%] px-5 py-3 rounded-2xl text-sm leading-relaxed shadow-sm',
                              msg.type === 'user'
                                ? 'bg-indigo-600 text-white rounded-br-none'
                                : msg.type === 'error'
                                ? 'bg-red-900/20 text-red-400 border border-red-500/20 rounded-bl-none'
                                : 'bg-zinc-800 text-zinc-200 rounded-bl-none border border-white/5'
                            )}
                          >
                            {msg.content}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Input */}
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                      placeholder="Ask for lighting tips..."
                      className="flex-1 px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all font-light"
                      disabled={isChatting}
                    />
                    <Button 
                      onClick={sendChatMessage} 
                      disabled={!chatInput.trim() || isChatting}
                      className="px-4 bg-indigo-600 hover:bg-indigo-500 h-auto rounded-xl"
                    >
                      {isChatting ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AnalysisPage