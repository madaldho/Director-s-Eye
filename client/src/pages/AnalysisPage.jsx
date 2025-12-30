import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { datadogRum } from '@datadog/browser-rum'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ArrowLeft, 
  Send, 
  Copy, 
  Check,
  Share2,
  Sparkles,
  Aperture,
  Maximize2,
  Info,
  Globe,
  Download,
  Users,
  Lock,
  CheckCircle,
  X,
  AlertCircle
} from 'lucide-react'
import { db } from '../firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import ReactMarkdown from 'react-markdown'
import axios from 'axios'
import { cn } from '../lib/utils'
import { compressImage } from '../lib/imageUtils'

const AnalysisPage = ({ result, image, onTelemetryLog }) => {
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [isChatting, setIsChatting] = useState(false)

  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const [copiedSummary, setCopiedSummary] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  
  // Share to Community Modal State
  const [shareModal, setShareModal] = useState({ open: false, image: null, prompt: '' })
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishSuccess, setPublishSuccess] = useState(false)
  const [toast, setToast] = useState({ show: false, type: '', message: '' })

  // Toast helper
  const showToast = (type, message) => {
    setToast({ show: true, type, message })
    setTimeout(() => setToast({ show: false, type: '', message: '' }), 3000)
  }
  
  // Edit State
  const [isEditing, setIsEditing] = useState(false)
  const [editPrompt, setEditPrompt] = useState('')
  const [isGeneratingEdit, setIsGeneratingEdit] = useState(false)
  const [editedImage, setEditedImage] = useState(null)
  const [lastUsedPrompt, setLastUsedPrompt] = useState('') // Store the prompt used for current edited image
  
  // Model configurations - must match Navbar
  const MODEL_CONFIG = {
    'nano-banana': { name: 'Nano Banana', limit: 5, model: 'gemini-2.5-flash-image' },
    'nano-banana-pro': { name: 'Nano Banana Pro', limit: 1, model: 'gemini-3-pro-image-preview' }
  }
  
  // Get selected model from localStorage (synced with Navbar)
  const [selectedModel, setSelectedModel] = useState(() => 
    localStorage.getItem('image_model') || 'nano-banana'
  )
  
  // Check if user has custom API key (synced with Navbar)
  const [hasCustomKey, setHasCustomKey] = useState(() => {
    const key = localStorage.getItem('gemini_api_key') || ''
    return key.length > 10
  })
  
  // Listen for model and API key changes from Navbar
  useEffect(() => {
    const syncFromStorage = () => {
      const newModel = localStorage.getItem('image_model') || 'nano-banana'
      setSelectedModel(newModel)
      
      const apiKey = localStorage.getItem('gemini_api_key') || ''
      setHasCustomKey(apiKey.length > 10)
    }
    
    window.addEventListener('storage', syncFromStorage)
    // Poll every 500ms for same-tab changes (faster sync)
    const interval = setInterval(syncFromStorage, 500)
    return () => {
      window.removeEventListener('storage', syncFromStorage)
      clearInterval(interval)
    }
  }, [])
  
  const currentModelConfig = MODEL_CONFIG[selectedModel] || MODEL_CONFIG['nano-banana']
  const MAX_EDITS = currentModelConfig.limit
  
  // Server-side quota tracking (IP + fingerprint based)
  const [editCount, setEditCount] = useState(0)
  
  // Fetch quota from server
  const fetchQuota = async () => {
    try {
      const res = await axios.get(`/api/usage?model=${selectedModel}`)
      setEditCount(res.data.count || 0)
    } catch (err) {
      console.error('Failed to fetch quota:', err)
    }
  }
  
  // Fetch quota on mount and when model changes
  useEffect(() => {
    fetchQuota()
  }, [selectedModel])
  
  // Refresh quota periodically
  useEffect(() => {
    const interval = setInterval(fetchQuota, 5000)
    return () => clearInterval(interval)
  }, [selectedModel])

  const [magicHistory, setMagicHistory] = useState([])

  const messagesEndRef = useRef(null)
  const navigate = useNavigate()

  const handleMagicEdit = async () => {
    // Bypass limit if user has custom API key
    const apiKey = localStorage.getItem('gemini_api_key') || ''
    const userHasKey = apiKey.length > 10
    
    if (!editPrompt.trim()) return
    if (!userHasKey && editCount >= MAX_EDITS) return
    
    const newHistoryItem = { role: 'user', text: editPrompt, timestamp: Date.now() }
    setMagicHistory(prev => [...prev, newHistoryItem])
    
    setIsGeneratingEdit(true)
    try {
      // Get model and API key from localStorage
      const selectedModel = localStorage.getItem('image_model') || 'nano-banana'
      const customApiKey = localStorage.getItem('gemini_api_key') || ''
      const sessionId = sessionStorage.getItem('session_id') || 'default'
      
      const headers = {}
      if (customApiKey) {
        headers['X-User-API-Key'] = customApiKey
      }
      
      const response = await axios.post('/api/edit-image', {
        image: image,
        prompt: editPrompt,
        model: selectedModel,
        sessionId: sessionId
      }, { headers })
      
      if (response.data.limitReached) {
        setMagicHistory(prev => [...prev, { 
          role: 'ai', 
          text: response.data.reply, 
          timestamp: Date.now() 
        }])
        return
      }
      
      if (response.data.editedImage) {
        setEditedImage(response.data.editedImage)
        setLastUsedPrompt(editPrompt) // Save the prompt used for this edit
        
        // Refresh quota from server (server tracks by IP)
        await fetchQuota()
        
        // Dispatch custom event to notify Navbar to refresh usage
        window.dispatchEvent(new Event('usage_updated'))

        // Auto-save to private history
        try {
           const sessionId = sessionStorage.getItem('session_id') || 'default'
           // Compress image before saving to Firestore
           const compressedImage = await compressImage(response.data.editedImage, 600, 0.6)
           const compressedOriginal = await compressImage(image, 400, 0.5)
           
           await addDoc(collection(db, 'gallery'), {
             image: compressedImage,
             originalImage: compressedOriginal,
             prompt: editPrompt,
             model: selectedModel,
             sessionId: sessionId,
             isPublic: false,
             // Save analysis context for later viewing
             analysisResult: result,
             timestamp: serverTimestamp()
           })
           console.log('Saved to gallery:', { sessionId, prompt: editPrompt, isPublic: false })
           // Dispatch event to refresh gallery
           window.dispatchEvent(new Event('gallery_updated'))
        } catch (e) {
           console.error('Failed to save to gallery:', e)
        }

        // Add success message to history
        setMagicHistory(prev => [...prev, { role: 'ai', text: "Image generated successfully.", image: response.data.editedImage, timestamp: Date.now() }])
      } else {
        setMagicHistory(prev => [...prev, { role: 'ai', text: response.data.reply, timestamp: Date.now() }])
      }
    } catch (e) {
      let errorMessage = e.response?.data?.reply || "Edit failed. Please try again."
      
      // Handle 429 quota exceeded error with user-friendly message
      if (e.response?.status === 429 || e.response?.data?.limitReached) {
        errorMessage = e.response?.data?.reply || "Daily limit reached. Add your own API key in Settings (⚙️) for unlimited usage!"
      }
      
      // Handle API quota errors (from Gemini)
      if (e.message?.includes('quota') || e.message?.includes('429') || e.response?.data?.reply?.includes('quota')) {
        errorMessage = "⚠️ API quota exceeded. If you're using a free tier API key, image generation has limited daily usage. Consider upgrading to a paid plan at Google AI Studio."
      }
      
      setMagicHistory(prev => [...prev, { role: 'ai', text: errorMessage, timestamp: Date.now() }])
      showToast('error', 'Generation failed. Check the message above for details.')
    } finally {
      setIsGeneratingEdit(false)
      setEditPrompt('') // Clear input
    }
  }

  // Gallery Share Handler (Public or Private)
  const handleShareToGallery = async (imageToShare, prompt, isPublic = true) => {
    if (isPublic) {
      // Open modern share modal instead of confirm()
      setShareModal({ open: true, image: imageToShare, prompt: prompt })
      return
    }
    
    // Private save (silent)
    try {
      const sessionId = sessionStorage.getItem('session_id') || 'default'
      await addDoc(collection(db, 'gallery'), {
        image: imageToShare,
        originalImage: image,
        prompt: prompt,
        model: selectedModel,
        sessionId: sessionId,
        isPublic: false,
        analysisResult: result,
        timestamp: serverTimestamp()
      });
      window.dispatchEvent(new Event('gallery_updated'))
    } catch (e) {
      console.error('Failed to save:', e)
    }
  }

  // Actual publish to community
  const handlePublishToCommunity = async () => {
    if (!shareModal.image) return
    
    setIsPublishing(true)
    try {
      const sessionId = sessionStorage.getItem('session_id') || 'default'
      // Compress images before saving
      const compressedImage = await compressImage(shareModal.image, 800, 0.7)
      const compressedOriginal = image ? await compressImage(image, 400, 0.5) : null
      
      await addDoc(collection(db, 'gallery'), {
        image: compressedImage,
        originalImage: compressedOriginal,
        prompt: shareModal.prompt,
        model: selectedModel,
        sessionId: sessionId,
        isPublic: true,
        analysisResult: result,
        timestamp: serverTimestamp()
      });
      
      window.dispatchEvent(new Event('gallery_updated'))
      setPublishSuccess(true)
      
      // Auto close after success animation
      setTimeout(() => {
        setShareModal({ open: false, image: null, prompt: '' })
        setPublishSuccess(false)
      }, 2000)
    } catch (e) {
      console.error('Failed to publish:', e)
      setShareModal({ open: false, image: null, prompt: '' })
      showToast('error', 'Failed to publish. Please try again.')
    } finally {
      setIsPublishing(false)
    }
  }

  useEffect(() => {
    if (!result || !image) {
      navigate('/')
      return
    }
    datadogRum.startView('analysis')
    
    // Check for remix prompt from Gallery
    const remixPrompt = localStorage.getItem('remix_prompt')
    if (remixPrompt) {
      setEditPrompt(remixPrompt)
      localStorage.removeItem('remix_prompt') // Clear it
      // Automatically scroll to magic edit section if needed
      // window.scrollTo({ bottom: 0, behavior: 'smooth' })
    }
  }, [result, image, navigate])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [chatMessages])

  const sendChatMessage = async () => {
    if (!chatInput.trim() || isChatting) return

    const userMessage = chatInput.trim()
    setChatInput('')
    setIsChatting(true)

    setChatMessages(prev => [...prev, { id: Date.now(), type: 'user', content: userMessage }])
    
    // Format history for Gemini
    const history = chatMessages.map(msg => ({
      role: msg.type === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    try {
      const imageBase64 = image.split(',')[1]
      const response = await axios.post('/api/chat', {
        message: userMessage,
        history: history, // Send History
        imageContext: imageBase64,
        analysisContext: result
      })

      setChatMessages(prev => [...prev, { id: Date.now(), type: 'assistant', content: response.data.reply }])
    } catch (error) {
      // no-dd-sa:javascript-best-practices/no-console
      console.error('Chat Error:', error);
      const errorMessage = error.response?.data?.message || 'Connection lost. Try again.';
      setChatMessages(prev => [...prev, { id: Date.now(), type: 'error', content: errorMessage }])
    } finally {
      setIsChatting(false)
    }
  }

  if (!result || !image) return null

  return (
    <div className="min-h-screen bg-black text-white font-sans overflow-x-hidden relative selection:bg-indigo-500/30">
      
      {/* Immersive Background (Blurred) */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-black/60 z-10" />
        <img src={image} className="w-full h-full object-cover blur-3xl opacity-50 scale-110" alt="Background" />
      </div>

      <div className="relative z-10 max-w-[1600px] mx-auto min-h-screen p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 pt-24">
        
        {/* LEFT: Cinematic View */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative rounded-3xl overflow-hidden shadow-2xl shadow-black/50 border border-white/10 group aspect-video bg-black"
          >
            <img src={image} className="w-full h-full object-contain" alt="Analyzed" />
             
            {/* Overlay Gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
            
            {/* Bottom Info */}
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 md:gap-0">
               <div className="w-full md:w-auto">
                  <div className="flex gap-2 mb-2">
                     <span className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs font-mono border border-white/5">RAW_INPUT</span>
                     <span className="bg-indigo-500/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-mono text-indigo-300 border border-indigo-500/20">AI_PROCESSED</span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold font-display tracking-tight text-white drop-shadow-xl">
                    Cinematic Analysis
                  </h2>
               </div>
               <div className="flex gap-3 w-full md:w-auto">
                 <button 
                  onClick={() => setIsSharing(true)}
                  className="p-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 transition-all active:scale-95 flex-none"
                 >
                   <Share2 className="w-5 h-5" />
                 </button>
                 <button onClick={() => navigate('/')} className="flex-1 md:flex-none px-6 py-3 rounded-full bg-white text-black font-semibold hover:bg-gray-200 transition-all flex items-center justify-center md:justify-start gap-2 text-sm md:text-base">
                   <ArrowLeft className="w-4 h-4" /> New Upload
                 </button>
               </div>
            </div>
          </motion.div>

          {/* Prompt Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl bg-white/5 border border-white/10 p-6 backdrop-blur-xl"
          >
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                <div className="flex items-center gap-2 text-indigo-300">
                   <Sparkles className="w-4 h-4" />
                   <span className="text-sm font-semibold uppercase tracking-wider">Generated Prompt</span>
                </div>
                
                <div className="flex items-center gap-3 self-end md:self-auto">
                   <button 
                     onClick={() => setIsEditing(true)}
                     className="text-xs flex items-center gap-2 text-white bg-indigo-600 hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20 px-4 py-2 rounded-full font-medium"
                   >
                     <Sparkles className="w-3 h-3" />
                     MAGIC EDIT
                   </button>
                   <button 
                     onClick={() => {
                       navigator.clipboard.writeText(result.prompt);
                       setCopiedPrompt(true);
                       setTimeout(() => setCopiedPrompt(false), 2000);
                     }}
                     className="text-xs flex items-center gap-2 text-zinc-400 hover:text-white transition-colors border border-white/10 px-3 py-2 rounded-full hover:bg-white/5"
                   >
                     {copiedPrompt ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                     {copiedPrompt ? "COPIED" : "COPY"}
                   </button>
                </div>
             </div>
             <p className="font-mono text-sm text-zinc-300 leading-relaxed opacity-80 select-all">
                {result.prompt}
             </p>
          </motion.div>
        </div>

        {/* RIGHT: HUD Panel */}
        <div className="lg:col-span-4 flex flex-col gap-6 lg:h-[calc(100vh-8rem)] lg:sticky lg:top-24">
          
          {/* Score Card */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl bg-gradient-to-br from-zinc-900 to-black border border-white/10 p-8 text-center relative overflow-hidden group"
          >
             <div className="absolute top-0 right-0 w-[150%] h-[150%] bg-indigo-600/10 blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
             
             <span className="text-xs font-mono text-zinc-500 uppercase tracking-[0.2em] mb-4 block">Total Score</span>
             <div className="relative inline-block">
                <span className={cn(
                  "text-8xl font-bold font-display tracking-tighter bg-clip-text text-transparent bg-gradient-to-b",
                  result.score >= 80 ? "from-emerald-300 to-emerald-600" :
                  result.score >= 60 ? "from-indigo-300 to-indigo-600" :
                  "from-amber-300 to-amber-600"
                )}>
                  {result.score}
                </span>
                <span className="absolute -top-4 -right-8 text-2xl text-zinc-600 font-normal">/100</span>
             </div>
             
             <div className="grid grid-cols-3 gap-2 mt-8">
               {[
                 { l: 'Light', v: result.lighting },
                 { l: 'Comp', v: result.composition },
                 { l: 'Mood', v: result.mood }
               ].map(s => (
                 <div key={s.l} className="bg-white/5 rounded-lg p-2 border border-white/5">
                    <div className="text-2xl font-bold text-white">{s.v}</div>
                    <div className="text-[10px] text-zinc-500 uppercase">{s.l}</div>
                 </div>
               ))}
             </div>
          </motion.div>

          {/* AI Chat / Critique */}
          <motion.div 
             initial={{ opacity: 0, x: 20 }}
             animate={{ opacity: 1, x: 0 }}
             transition={{ delay: 0.3 }}
             className="flex-1 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl flex flex-col overflow-hidden min-h-[400px]"
          >
             {/* Tab Header */}
             <div className="flex border-b border-white/10">
                <button className="flex-1 py-4 text-sm font-semibold text-white border-b-2 border-indigo-500 bg-white/5">
                   AI Director
                </button>
                <div className="flex-1 py-4 text-center">
                  <span className="text-xs text-zinc-500 font-mono flex items-center justify-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    ONLINE
                  </span>
                </div>
             </div>

             {/* Chat History */}
             <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {/* Initial Critique */}
                <div className="flex justify-start">
                   <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-zinc-800 border border-white/5 p-4 text-sm text-zinc-200 leading-relaxed shadow-sm">
                      <span className="block text-[10px] bg-indigo-500/20 text-indigo-300 w-fit px-2 py-0.5 rounded mb-2">INITIAL REPORT</span>
                      {result.critique}
                   </div>
                </div>

                {chatMessages.map((msg, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={msg.id || i} 
                    className={cn("flex", msg.type === 'user' ? 'justify-end' : 'justify-start')}
                  >
                     <div className={cn(
                       "max-w-[85%] rounded-2xl p-3 text-sm shadow-sm break-words",
                       msg.type === 'user' 
                         ? "bg-indigo-600 text-white rounded-tr-sm" 
                         : "bg-zinc-800 text-zinc-200 border border-white/5 rounded-tl-sm"
                     )}
                     style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
                     >
                        {msg.type === 'assistant' ? (
                          <div className="prose prose-invert prose-sm max-w-none prose-p:my-2 prose-p:leading-relaxed prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-headings:my-2 prose-strong:text-white prose-a:text-indigo-400">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        ) : (
                          msg.content
                        )}
                     </div>
                  </motion.div>
                ))}
                
                {/* Chat Loading Animation */}
                {isChatting && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-start"
                  >
                    <div className="bg-zinc-800 rounded-2xl rounded-tl-sm p-4 border border-white/5 flex items-center gap-2">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
             </div>

             {/* Input Area */}
             <div className="p-4 bg-black/20 border-t border-white/10">
                <div className="relative">
                   <input 
                     type="text" 
                     value={chatInput}
                     onChange={e => setChatInput(e.target.value)}
                     onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
                     placeholder="Ask about your score..." 
                     className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-zinc-600"
                   />
                   <button 
                     onClick={sendChatMessage}
                     disabled={isChatting}
                     className="absolute right-2 top-2 p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50"
                   >
                     <Send className="w-4 h-4" />
                   </button>
                </div>
             </div>
          </motion.div>
        </div>
      </div>

      {/* Share Modal */}
      <AnimatePresence>
        {isSharing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
             <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               className="w-full max-w-sm bento-card border border-[var(--bento-border)] bg-zinc-900 overflow-hidden"
             >
                <div className="p-6">
                   <h3 className="text-xl font-bold text-white mb-2 font-display">Share Analysis</h3>
                   <p className="text-sm text-zinc-400 mb-6">Show off your cinematography grade.</p>
                   
                   <div className="space-y-3">
                      <button 
                         onClick={() => {
                           const text = `I got a ${result.score}/100 on Director's Eye! 🎬\nAI Cinematography Analysis \n`;
                           const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
                           window.open(url, '_blank');
                         }}
                         className="w-full flex items-center justify-center gap-3 p-3 rounded-xl bg-[#1DA1F2]/10 text-[#1DA1F2] hover:bg-[#1DA1F2]/20 transition-colors font-medium"
                      >
                         <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.244 4.134a4.917 4.917 0 01-2.229-.616c-.054 2.281 1.581 4.415 3.949 4.89a4.935 4.935 0 01-2.224.084 4.928 4.928 0 004.6 3.419A9.9 9.9 0 010 21.543a14.048 14.048 0 007.548 2.212c9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
                         Share on Twitter
                      </button>
                      
                      <button 
                         onClick={() => {
                            const text = `Check out my cinematography analysis on Director's Eye! Score: ${result.score}/100 🎥`;
                            const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`; // In real app, this needs a valid public URL
                            window.open(url, '_blank');
                         }}
                         className="w-full flex items-center justify-center gap-3 p-3 rounded-xl bg-[#0A66C2]/10 text-[#0A66C2] hover:bg-[#0A66C2]/20 transition-colors font-medium"
                      >
                         <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                         Share on LinkedIn
                      </button>

                      <button 
                         onClick={() => {
                            const text = `Director's Eye Analysis:\nScore: ${result.score}/100\nVerdict: ${result.score > 80 ? 'Masterpiece' : 'Standard'}\n#Hackathon2025`;
                            navigator.clipboard.writeText(text);
                            setCopiedSummary(true);
                            setTimeout(() => setCopiedSummary(false), 2000);
                            setIsSharing(false);
                         }}
                         className="w-full flex items-center justify-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors font-medium border border-white/10"
                      >
                         <Copy className="w-5 h-5" />
                         Copy Summary
                      </button>
                   </div>
                </div>
                <div className="bg-white/5 p-4 flex justify-center border-t border-white/5">
                   <button onClick={() => setIsSharing(false)} className="text-sm text-zinc-400 hover:text-white">Maybe Later</button>
                </div>
             </motion.div>
          </div>
        )}
        {isEditing && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/90 backdrop-blur-md md:p-4">
             <motion.div 
               initial={{ opacity: 0, y: 100 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: 100 }}
               className="w-full max-w-5xl bg-zinc-900 md:border border-white/10 rounded-t-3xl md:rounded-3xl overflow-hidden flex flex-col h-[90vh] md:h-[85vh] shadow-2xl"
             >
                {/* Modal Header */}
                <div className="p-4 md:p-6 border-b border-white/10 flex justify-between items-center bg-zinc-900 shrink-0">
                   <div className="flex flex-col">
                      <h3 className="text-xl font-bold font-display flex items-center gap-2 text-white">
                        <Sparkles className="w-5 h-5 text-indigo-400" />
                        Magic Director's Edit
                      </h3>
                      <p className="text-xs text-zinc-400 hidden md:block">AI-powered image remixing and color grading</p>
                   </div>
                   <button 
                     onClick={() => { setIsEditing(false); setEditedImage(null); }} 
                     className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                   >
                     <span className="sr-only">Close</span>
                     <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                   </button>
                </div>
                
                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-black/50 custom-scrollbar">
                   {editedImage ? (
                     <div className="flex flex-col md:grid md:grid-cols-2 gap-6 h-full">
                        <div className="space-y-3 flex flex-col">
                           <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-zinc-600" />
                             Original Shot
                           </span>
                           <div className="relative rounded-2xl overflow-hidden border border-white/10 flex-1 bg-zinc-900/50 min-h-[200px]">
                              <img src={image} className="w-full h-full object-contain absolute inset-0" alt="Original" />
                           </div>
                        </div>
                        <div className="space-y-3 flex flex-col">
                           <span className="text-xs font-mono text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                             AI Remixed
                           </span>
                           <div className="relative rounded-2xl overflow-hidden border border-indigo-500/30 flex-1 bg-indigo-900/10 min-h-[200px] shadow-[0_0_30px_rgba(99,102,241,0.1)] group">
                              <img src={editedImage} className="w-full h-full object-contain absolute inset-0" alt="Edited" />
                              {/* Action buttons overlay */}
                              <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <a 
                                  href={editedImage} 
                                  download={`directors-eye-remix-${Date.now()}.png`}
                                  className="p-3 bg-black/70 hover:bg-black/90 backdrop-blur text-white rounded-xl border border-white/20 transition-all flex items-center gap-2"
                                  title="Download Image"
                                >
                                  <Download className="w-4 h-4" />
                                  <span className="text-xs font-medium">Save</span>
                                </a>
                              </div>
                           </div>
                           {/* Mobile hint */}
                           <div className="md:hidden text-center text-xs text-zinc-500 italic">
                             Long press image to save on mobile
                           </div>
                        </div>
                     </div>
                   ) : (
                     <div className="flex flex-col h-full">
                        {/* Top Context Bar: Small ID Image + Suggestions */}
                        <div className="flex items-center gap-4 mb-6 p-4 bg-white/5 rounded-2xl border border-white/10 shrink-0 overflow-x-auto">
                            {/* Small Original Image Context */}
                            <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-white/20 shrink-0 group">
                                <img src={image} className="w-full h-full object-cover" alt="Context" />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-white font-mono text-center leading-tight p-1">
                                    Original Source
                                </div>
                            </div>

                            {/* Horizontal Suggestions */}
                            <div className="flex gap-2">
                                {["3D Animation Style", "Golden Hour", "B&W Film Noir", "Art pencil style", "Moody Fog", "make cinematic style"].map((suggestion) => (
                                    <button 
                                      key={suggestion}
                                      onClick={() => setEditPrompt(suggestion)}
                                      className="whitespace-nowrap px-4 py-2 rounded-full bg-black/40 hover:bg-indigo-600/20 border border-white/10 hover:border-indigo-500/50 text-xs text-zinc-300 hover:text-white transition-all"
                                    >
                                      {suggestion}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Chat History Area */}
                        <div className="flex-1 overflow-y-auto space-y-4 px-2">
                           {magicHistory.length === 0 ? (
                               <div className="flex flex-col items-center justify-center h-full text-center opacity-50 space-y-4">
                                   <Sparkles className="w-12 h-12 text-zinc-600" />
                                   <p className="text-zinc-400 text-sm max-w-xs">
                                     Select a suggestion above or describe your vision below. <br/>
                                     <span className="text-xs text-zinc-600">(Batas {MAX_EDITS} edit per hari)</span>
                                   </p>
                               </div>
                           ) : (
                               magicHistory.map((msg) => (
                                   <div key={msg.timestamp} className={cn("flex w-full", msg.role === 'user' ? "justify-end" : "justify-start")}>
                                       <div className={cn(
                                           "max-w-[80%] rounded-2xl p-4 text-sm",
                                           msg.role === 'user' 
                                            ? "bg-indigo-600 text-white rounded-br-none" 
                                            : "bg-zinc-800 text-zinc-200 rounded-bl-none border border-white/10"
                                       )}>
                                           {msg.text}
                                           {msg.image && (
                                               <div className="mt-3 rounded-lg overflow-hidden border border-white/10">
                                                   <img src={msg.image} className="w-full h-auto" alt="History Result" />
                                               </div>
                                           )}
                                       </div>
                                   </div>
                               ))
                           )}
                           {/* Loading Indicator in Chat */}
                           {isGeneratingEdit && (
                               <div className="flex justify-start w-full">
                                   <div className="bg-zinc-800 rounded-2xl rounded-bl-none p-4 border border-white/10 flex items-center gap-2">
                                       <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                       <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                       <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                   </div>
                               </div>
                           )}
                           <div ref={messagesEndRef} />
                        </div>
                     </div>
                   )}
                </div>

                {/* Input Footer - Sticky */}
                <div className="p-4 md:p-6 bg-zinc-900 border-t border-white/10 shrink-0 mb-safe-area">
                   {!editedImage ? (
                     <div className="flex flex-col gap-3">
                        {!hasCustomKey && editCount >= MAX_EDITS ? (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-4 text-red-200 text-center text-sm font-medium flex items-center justify-center gap-2">
                                <Info className="w-4 h-4" />
                                Daily limit reached ({MAX_EDITS}/{MAX_EDITS}). Add your API key in Settings for unlimited usage!
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-center px-1">
                                    <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">MODEL: {currentModelConfig.name}</span>
                                    <span className={cn(
                                      "text-[10px] font-mono font-bold",
                                      hasCustomKey ? "text-green-400" : "text-indigo-400"
                                    )}>
                                      {hasCustomKey ? '∞ UNLIMITED' : `QUOTA: ${MAX_EDITS - editCount}/${MAX_EDITS}`}
                                    </span>
                                </div>
                                <div className="flex gap-3">
                                    <input 
                                      type="text" 
                                      value={editPrompt}
                                      onChange={e => setEditPrompt(e.target.value)}
                                      placeholder={isGeneratingEdit ? "AI is thinking..." : "Describe visual changes..."}
                                      className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-indigo-500 transition-all font-mono text-sm placeholder:text-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                      disabled={isGeneratingEdit}
                                      onKeyDown={e => e.key === 'Enter' && handleMagicEdit()}
                                      autoFocus
                                    />
                                    <button 
                                      onClick={handleMagicEdit}
                                      disabled={isGeneratingEdit || !editPrompt.trim()}
                                      className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-6 md:px-8 rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20 whitespace-nowrap"
                                    >
                                       {isGeneratingEdit ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Sparkles className="w-5 h-5" />}
                                       <span className="hidden md:inline">{isGeneratingEdit ? 'Remixing...' : 'Generate'}</span>
                                       <span className="md:hidden">{isGeneratingEdit ? '...' : 'Go'}</span>
                                    </button>
                                </div>
                            </>
                        )}
                     </div>
                   ) : (
                     <div className="flex gap-3 justify-end flex-wrap">
                        <button 
                           onClick={() => {
                             setEditedImage(null)
                             setLastUsedPrompt('')
                           }}
                           className="px-6 py-3 rounded-xl border border-white/10 hover:bg-white/5 text-white font-medium transition-colors"
                        >
                          Try Another Edit
                        </button>
                        <button 
                           onClick={() => handleShareToGallery(editedImage, lastUsedPrompt || editPrompt, true)}
                           className="px-6 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold shadow-lg shadow-green-600/20 flex items-center gap-2"
                        >
                          <Globe className="w-4 h-4" />
                          Share to Community
                        </button>
                        <button 
                           onClick={() => {
                             const link = document.createElement('a');
                             link.href = editedImage;
                             link.download = `directors-eye-remix-${Date.now()}.png`;
                             link.click();
                           }}
                           className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-600/20 flex items-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </button>
                     </div>
                   )}
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Notifications / Toasts */}
      <AnimatePresence>
        {copiedSummary && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] bg-indigo-600 text-white px-6 py-3 rounded-full shadow-2xl font-bold flex items-center gap-2 border border-white/20"
          >
            <Check className="w-5 h-5" />
            Summary copied to clipboard!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modern Share to Community Modal */}
      <AnimatePresence>
        {shareModal.open && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
            onClick={() => !isPublishing && setShareModal({ open: false, image: null, prompt: '' })}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-lg bg-gradient-to-b from-zinc-900 to-zinc-950 border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Success State */}
              {publishSuccess ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-12 flex flex-col items-center justify-center text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 10, stiffness: 200, delay: 0.1 }}
                    className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-6"
                  >
                    <CheckCircle className="w-10 h-10 text-green-400" />
                  </motion.div>
                  <h3 className="text-2xl font-bold text-white mb-2">Published!</h3>
                  <p className="text-zinc-400">Your creation is now live in the Community Gallery</p>
                </motion.div>
              ) : (
                <>
                  {/* Header */}
                  <div className="relative p-6 pb-0">
                    <button 
                      onClick={() => setShareModal({ open: false, image: null, prompt: '' })}
                      className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors"
                    >
                      <X className="w-5 h-5 text-zinc-400" />
                    </button>
                    
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                        <Globe className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white">Share to Community</h3>
                        <p className="text-sm text-zinc-500">Let others see your creation</p>
                      </div>
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="p-6">
                    <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black/30 mb-6">
                      <img 
                        src={shareModal.image} 
                        alt="Preview" 
                        className="w-full h-48 object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      
                      {/* Score badge if available */}
                      {result?.score && (
                        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                          <span className="text-sm font-bold text-white">{result.score}</span>
                          <span className="text-xs text-zinc-400">/100</span>
                        </div>
                      )}
                    </div>

                    {/* Prompt Preview */}
                    <div className="bg-white/5 rounded-xl p-4 border border-white/5 mb-6">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-3 h-3 text-indigo-400" />
                        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Prompt</span>
                      </div>
                      <p className="text-sm text-zinc-300 font-mono line-clamp-2">
                        {shareModal.prompt || 'Magic Edit Creation'}
                      </p>
                    </div>

                    {/* Info */}
                    <div className="flex items-start gap-3 p-4 bg-indigo-500/10 rounded-xl border border-indigo-500/20 mb-6">
                      <Users className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm text-indigo-200 font-medium">Visible to everyone</p>
                        <p className="text-xs text-indigo-300/60 mt-1">
                          Your creation will appear in the Community Gallery where others can view, remix, and get inspired.
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShareModal({ open: false, image: null, prompt: '' })}
                        disabled={isPublishing}
                        className="flex-1 px-6 py-4 rounded-xl border border-white/10 hover:bg-white/5 text-white font-medium transition-all disabled:opacity-50"
                      >
                        Keep Private
                      </button>
                      <button
                        onClick={handlePublishToCommunity}
                        disabled={isPublishing}
                        className="flex-1 px-6 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/30 disabled:opacity-50"
                      >
                        {isPublishing ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Publishing...
                          </>
                        ) : (
                          <>
                            <Globe className="w-5 h-5" />
                            Publish Now
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className={cn(
              "fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border",
              toast.type === 'error' 
                ? "bg-red-950 border-red-500/30 text-red-200" 
                : toast.type === 'success'
                ? "bg-green-950 border-green-500/30 text-green-200"
                : "bg-zinc-900 border-white/10 text-white"
            )}
          >
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-400" />}
            {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-green-400" />}
            <span className="font-medium">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default AnalysisPage