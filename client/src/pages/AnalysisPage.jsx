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
  Info
} from 'lucide-react'
import axios from 'axios'
import { cn } from '../lib/utils'

const AnalysisPage = ({ result, image, onTelemetryLog }) => {
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [isChatting, setIsChatting] = useState(false)

  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const messagesEndRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!result || !image) {
      navigate('/')
      return
    }
    datadogRum.startView('analysis')
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

    setChatMessages(prev => [...prev, { type: 'user', content: userMessage }])
    
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

      setChatMessages(prev => [...prev, { type: 'assistant', content: response.data.reply }])
    } catch (error) {
      setChatMessages(prev => [...prev, { type: 'error', content: 'Connection lost. Try again.' }])
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
             <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2 text-indigo-300">
                   <Sparkles className="w-4 h-4" />
                   <span className="text-sm font-semibold uppercase tracking-wider">Generated Prompt</span>
                </div>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(result.prompt);
                    setCopiedPrompt(true);
                    setTimeout(() => setCopiedPrompt(false), 2000);
                  }}
                  className="text-xs flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
                >
                  {copiedPrompt ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                  {copiedPrompt ? "COPIED" : "COPY PROMPT"}
                </button>
             </div>
             <p className="font-mono text-sm text-zinc-300 leading-relaxed opacity-80 select-all">
                {result.prompt}
             </p>
          </motion.div>
        </div>

        {/* RIGHT: HUD Panel */}
        <div className="lg:col-span-4 flex flex-col gap-6 h-full">
          
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
                    key={i} 
                    className={cn("flex", msg.type === 'user' ? 'justify-end' : 'justify-start')}
                  >
                     <div className={cn(
                       "max-w-[85%] rounded-2xl p-3 text-sm shadow-sm",
                       msg.type === 'user' 
                         ? "bg-indigo-600 text-white rounded-tr-sm" 
                         : "bg-zinc-800 text-zinc-200 border border-white/5 rounded-tl-sm"
                     )}>
                        {msg.content}
                     </div>
                  </motion.div>
                ))}
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
                           const text = `I got a ${result.score}/100 on Director's Eye! 🎬\nAI Cinematography Analysis powered by Gemini & Datadog.\n\n#DirectorsEye #Hackathon2025`;
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
                            setIsSharing(false);
                            alert("Summary copied to clipboard!");
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
      </AnimatePresence>
    </div>
  )
}

export default AnalysisPage