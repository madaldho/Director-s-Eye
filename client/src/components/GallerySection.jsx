import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Copy, Globe, History, RefreshCw, Lock, Download, X, Eye, Users, CheckCircle, AlertCircle } from 'lucide-react'
import { db } from '../firebase'
import { collection, query, where, orderBy, limit, getDocs, doc, updateDoc, startAfter } from 'firebase/firestore'
import { cn } from '../lib/utils'

const ITEMS_PER_PAGE = 8
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes cache

// Skeleton component for loading state
const SkeletonCard = () => (
  <div className="break-inside-avoid rounded-xl overflow-hidden bg-[var(--bento-card)] border border-[var(--bento-border)]">
    <div className="aspect-[3/4] bg-gradient-to-br from-zinc-800 to-zinc-900 animate-pulse relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skeleton-shimmer" />
    </div>
  </div>
)

// Lazy Image component with loading state
const LazyImage = ({ src, alt, className }) => {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const imgRef = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && imgRef.current) {
          imgRef.current.src = src
        }
      },
      { rootMargin: '100px' }
    )
    
    if (imgRef.current) observer.observe(imgRef.current)
    return () => observer.disconnect()
  }, [src])

  return (
    <div className="relative w-full h-auto min-h-[100px]">
      {!loaded && !error && (
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900 animate-pulse">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skeleton-shimmer" />
        </div>
      )}
      <img 
        ref={imgRef}
        alt={alt}
        className={cn(className, !loaded && "opacity-0")}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 text-zinc-500 text-xs">
          Failed to load
        </div>
      )}
    </div>
  )
}

const GallerySection = ({ onRemix, onLoadHistory }) => {
  const [activeTab, setActiveTab] = useState('community')
  const [gallery, setGallery] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)
  const [shareModal, setShareModal] = useState({ open: false, item: null })
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishSuccess, setPublishSuccess] = useState(false)
  const [toast, setToast] = useState({ show: false, type: '', message: '' })
  const [hasMore, setHasMore] = useState(true)
  const [lastDoc, setLastDoc] = useState(null)
  const navigate = useNavigate()

  // Cache management
  const getCacheKey = (tab) => `gallery_cache_${tab}_${tab === 'history' ? sessionStorage.getItem('session_id') : 'public'}`
  
  const getCache = (tab) => {
    try {
      const cached = localStorage.getItem(getCacheKey(tab))
      if (cached) {
        const { data, timestamp } = JSON.parse(cached)
        if (Date.now() - timestamp < CACHE_DURATION) {
          return data
        }
      }
    } catch (e) {
      console.error('Cache read error:', e)
    }
    return null
  }

  const setCache = (tab, data) => {
    try {
      localStorage.setItem(getCacheKey(tab), JSON.stringify({
        data,
        timestamp: Date.now()
      }))
    } catch (e) {
      console.error('Cache write error:', e)
    }
  }

  // Toast helper
  const showToast = (type, message) => {
    setToast({ show: true, type, message })
    setTimeout(() => setToast({ show: false, type: '', message: '' }), 3000)
  }

  // Initial load with cache
  useEffect(() => {
    const cachedData = getCache(activeTab)
    if (cachedData && cachedData.length > 0) {
      setGallery(cachedData.slice(0, ITEMS_PER_PAGE))
      setHasMore(cachedData.length > ITEMS_PER_PAGE)
      setLoading(false)
      // Background refresh
      fetchData(true)
    } else {
      fetchData()
    }
  }, [activeTab])

  // Listen for gallery updates (real-time sync)
  useEffect(() => {
    const handleGalleryUpdate = () => {
      console.log('Gallery update event received, refreshing...')
      // Clear cache and fetch fresh data
      localStorage.removeItem(getCacheKey(activeTab))
      fetchData()
    }
    window.addEventListener('gallery_updated', handleGalleryUpdate)
    return () => window.removeEventListener('gallery_updated', handleGalleryUpdate)
  }, [activeTab])

  const fetchData = async (isBackgroundRefresh = false) => {
    if (!isBackgroundRefresh) setLoading(true)
    setError(null)
    setLastDoc(null)
    setHasMore(true)
    
    try {
      const galleryRef = collection(db, 'gallery')
      let q;

      if (activeTab === 'community') {
        q = query(galleryRef, where('isPublic', '==', true), orderBy('timestamp', 'desc'), limit(ITEMS_PER_PAGE));
      } else {
        const sessionId = sessionStorage.getItem('session_id') || 'default'
        q = query(galleryRef, where('sessionId', '==', sessionId), orderBy('timestamp', 'desc'), limit(ITEMS_PER_PAGE));
      }

      const querySnapshot = await getDocs(q);
      const items = [];
      let lastVisible = null;
      
      querySnapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() });
        lastVisible = doc;
      });
      
      setGallery(items)
      setLastDoc(lastVisible)
      setHasMore(items.length === ITEMS_PER_PAGE)
      
      // Update cache with fresh data
      setCache(activeTab, items)
      
    } catch (err) {
      console.error('Failed to fetch data', err)
      if (err.message && err.message.includes('index')) {
        setError('Database index is building. Please wait a moment and refresh.')
      } else {
        setError('Failed to load gallery. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const loadMore = async () => {
    if (loadingMore || !hasMore || !lastDoc) return
    
    setLoadingMore(true)
    try {
      const galleryRef = collection(db, 'gallery')
      let q;

      if (activeTab === 'community') {
        q = query(
          galleryRef, 
          where('isPublic', '==', true), 
          orderBy('timestamp', 'desc'), 
          startAfter(lastDoc),
          limit(ITEMS_PER_PAGE)
        );
      } else {
        const sessionId = sessionStorage.getItem('session_id') || 'default'
        q = query(
          galleryRef, 
          where('sessionId', '==', sessionId), 
          orderBy('timestamp', 'desc'), 
          startAfter(lastDoc),
          limit(ITEMS_PER_PAGE)
        );
      }

      const querySnapshot = await getDocs(q);
      const newItems = [];
      let lastVisible = null;
      
      querySnapshot.forEach((doc) => {
        newItems.push({ id: doc.id, ...doc.data() });
        lastVisible = doc;
      });
      
      if (newItems.length > 0) {
        const updatedGallery = [...gallery, ...newItems]
        setGallery(updatedGallery)
        setLastDoc(lastVisible)
        setHasMore(newItems.length === ITEMS_PER_PAGE)
        // Update cache
        setCache(activeTab, updatedGallery)
      } else {
        setHasMore(false)
      }
      
    } catch (err) {
      console.error('Failed to load more', err)
      showToast('error', 'Failed to load more items')
    } finally {
      setLoadingMore(false)
    }
  }

  const handleDownload = (imageData, prompt) => {
    const link = document.createElement('a')
    link.href = imageData
    link.download = `directors-eye-${Date.now()}.png`
    link.click()
  }

  const handleMakePublic = async (item) => {
    setShareModal({ open: true, item: item })
    setSelectedItem(null)
  }

  const handleConfirmPublish = async () => {
    if (!shareModal.item) return
    
    setIsPublishing(true)
    try {
      const docRef = doc(db, 'gallery', shareModal.item.id)
      await updateDoc(docRef, { isPublic: true })
      setPublishSuccess(true)
      
      // Clear both caches since item moved from history to community
      localStorage.removeItem(getCacheKey('community'))
      localStorage.removeItem(getCacheKey('history'))
      
      setTimeout(() => {
        setShareModal({ open: false, item: null })
        setPublishSuccess(false)
        fetchData()
      }, 2000)
    } catch (e) {
      console.error('Failed to make public:', e)
      setShareModal({ open: false, item: null })
      showToast('error', 'Failed to publish. Please try again.')
    } finally {
      setIsPublishing(false)
    }
  }

  const handleViewAnalysis = (item) => {
    if (item.analysisResult && item.image) {
      localStorage.setItem('lastAnalysis', JSON.stringify(item.analysisResult))
      localStorage.setItem('lastImage', item.image)
      navigate('/analysis')
    } else {
      setSelectedItem(item)
    }
  }

  return (
    <section className="mt-24 mb-12" id="gallery-section">
      {/* CSS for skeleton shimmer */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .skeleton-shimmer {
          animation: shimmer 1.5s infinite;
        }
      `}</style>

      <div className="flex flex-col md:flex-row items-center justify-between mb-8 px-4 gap-4">
        <div>
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[var(--bento-accent)] to-[var(--bento-accent-active)]">
            Inspiration Gallery
          </h2>
          <p className="text-[var(--bento-muted)] text-sm mt-1">
            Explore community creations or revisit your own history.
          </p>
        </div>

        <div className="flex items-center gap-4">
           <div className="flex p-1 bg-[var(--bento-card)] border border-[var(--bento-border)] rounded-full">
              <button 
                onClick={() => setActiveTab('community')}
                className={cn(
                  "px-4 py-2 rounded-full text-xs font-medium flex items-center gap-2 transition-all",
                  activeTab === 'community' ? "bg-[var(--bento-accent)] text-white" : "text-[var(--bento-muted)] hover:text-white"
                )}
              >
                <Globe className="w-3 h-3" />
                Community
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={cn(
                  "px-4 py-2 rounded-full text-xs font-medium flex items-center gap-2 transition-all",
                  activeTab === 'history' ? "bg-[var(--bento-accent)] text-white" : "text-[var(--bento-muted)] hover:text-white"
                )}
              >
                <History className="w-3 h-3" />
                My History
              </button>
           </div>
           
            <button 
              onClick={() => {
                localStorage.removeItem(getCacheKey(activeTab))
                fetchData()
              }}
              className="p-2 bg-[var(--bento-card)] border border-[var(--bento-border)] rounded-full hover:bg-[var(--bento-hover)] transition-colors"
              title="Force refresh"
            >
              <RefreshCw className={cn("w-4 h-4 text-[var(--bento-muted)]", loading && "animate-spin")} />
            </button>
        </div>
      </div>

      {loading ? (
        <div className="columns-2 md:columns-3 lg:columns-4 gap-4 px-4 space-y-4">
          {[1,2,3,4,5,6,7,8].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
         <div className="text-center py-12 border border-dashed border-amber-500/30 rounded-xl mx-4 bg-amber-500/5">
            <p className="text-amber-400 text-sm">{error}</p>
            <button 
              onClick={() => fetchData()}
              className="mt-4 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-xs font-medium transition-colors"
            >
              Try Again
            </button>
         </div>
      ) : gallery.length === 0 ? (
         <div className="text-center py-12 border border-dashed border-[var(--bento-border)] rounded-xl mx-4">
            <p className="text-[var(--bento-muted)] text-sm">
               {activeTab === 'community' ? "No public creations yet. Be the first!" : "No history found. Try Magic Edit first!"}
            </p>
         </div>
      ) : (
        <>
          <div className="columns-2 md:columns-3 lg:columns-4 gap-4 px-4 space-y-4">
            {gallery.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                className="relative group break-inside-avoid rounded-xl overflow-hidden bg-[var(--bento-card)] border border-[var(--bento-border)] hover:border-[var(--bento-accent)]/50 transition-all cursor-pointer"
                onClick={() => setSelectedItem(item)}
              >
                <LazyImage 
                  src={item.image} 
                  alt="Creation" 
                  className="w-full h-auto object-cover"
                />
                
                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end">
                  <p className="text-white text-xs line-clamp-2 mb-3 font-mono">
                    {item.prompt}
                  </p>
                  
                  {item.analysisResult?.score && (
                    <div className="mb-3 flex items-center gap-2">
                      <span className="bg-indigo-500/30 text-indigo-300 px-2 py-1 rounded text-xs font-bold">
                        Score: {item.analysisResult.score}/100
                      </span>
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    {item.analysisResult ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleViewAnalysis(item); }}
                        className="flex-1 bg-[var(--bento-accent)] hover:bg-[var(--bento-accent-active)] text-white text-xs py-2 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        View Analysis
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); onRemix(item.prompt); }}
                        className="flex-1 bg-[var(--bento-accent)] hover:bg-[var(--bento-accent-active)] text-white text-xs py-2 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Sparkles className="w-3 h-3" />
                        Remix
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDownload(item.image, item.prompt); }}
                      className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                      title="Download"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                
                {/* Badges */}
                <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                  {item.model && (
                    <div className="px-2 py-0.5 bg-black/50 backdrop-blur-md rounded text-[9px] text-white/80 font-mono border border-white/10">
                      {item.model.includes('pro') ? 'PRO' : 'NANO'}
                    </div>
                  )}
                  {activeTab === 'history' && (
                    <div className={cn(
                      "px-2 py-0.5 backdrop-blur-md rounded text-[9px] font-mono border border-white/10 flex items-center gap-1",
                      item.isPublic ? "bg-green-500/20 text-green-300" : "bg-zinc-500/50 text-zinc-300"
                    )}>
                      {item.isPublic ? <Globe className="w-2 h-2"/> : <Lock className="w-2 h-2"/>}
                      {item.isPublic ? 'PUBLIC' : 'PRIVATE'}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Load More Button */}
          {hasMore && (
            <div className="flex justify-center mt-8 px-4">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-8 py-3 bg-[var(--bento-card)] border border-[var(--bento-border)] hover:border-[var(--bento-accent)]/50 rounded-xl text-white font-medium transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {loadingMore ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    Load More
                  </>
                )}
              </button>
            </div>
          )}
          
          {/* Loading more skeletons */}
          {loadingMore && (
            <div className="columns-2 md:columns-3 lg:columns-4 gap-4 px-4 space-y-4 mt-4">
              {[1,2,3,4].map(i => <SkeletonCard key={`more-${i}`} />)}
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedItem && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
            onClick={() => setSelectedItem(null)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-4xl bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden max-h-[90vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-4 border-b border-white/10 flex justify-between items-center shrink-0">
                <h3 className="text-lg font-bold text-white">Creation Details</h3>
                <button 
                  onClick={() => setSelectedItem(null)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <img 
                      src={selectedItem.image} 
                      alt="Creation" 
                      className="w-full rounded-xl border border-white/10"
                    />
                    
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleDownload(selectedItem.image, selectedItem.prompt)}
                        className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors border border-white/10"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                      {activeTab === 'history' && !selectedItem.isPublic && (
                        <button
                          onClick={() => handleMakePublic(selectedItem)}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
                        >
                          <Globe className="w-4 h-4" />
                          Share to Community
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Prompt</h4>
                      <p className="text-white font-mono text-sm bg-black/30 p-4 rounded-xl border border-white/5">
                        {selectedItem.prompt}
                      </p>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(selectedItem.prompt)
                          showToast('success', 'Prompt copied!')
                        }}
                        className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" /> Copy Prompt
                      </button>
                    </div>

                    {selectedItem.analysisResult && (
                      <div>
                        <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Analysis Score</h4>
                        <div className="bg-black/30 p-4 rounded-xl border border-white/5">
                          <div className="text-center mb-4">
                            <span className={cn(
                              "text-5xl font-bold",
                              selectedItem.analysisResult.score >= 80 ? "text-emerald-400" :
                              selectedItem.analysisResult.score >= 60 ? "text-indigo-400" : "text-amber-400"
                            )}>
                              {selectedItem.analysisResult.score}
                            </span>
                            <span className="text-zinc-500 text-xl">/100</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="bg-white/5 rounded-lg p-2">
                              <div className="text-lg font-bold text-white">{selectedItem.analysisResult.lighting}</div>
                              <div className="text-[10px] text-zinc-500">Lighting</div>
                            </div>
                            <div className="bg-white/5 rounded-lg p-2">
                              <div className="text-lg font-bold text-white">{selectedItem.analysisResult.composition}</div>
                              <div className="text-[10px] text-zinc-500">Composition</div>
                            </div>
                            <div className="bg-white/5 rounded-lg p-2">
                              <div className="text-lg font-bold text-white">{selectedItem.analysisResult.mood}</div>
                              <div className="text-[10px] text-zinc-500">Mood</div>
                            </div>
                          </div>
                          
                          <button
                            onClick={() => handleViewAnalysis(selectedItem)}
                            className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                            Open Full Analysis
                          </button>
                        </div>
                      </div>
                    )}

                    {selectedItem.analysisResult?.critique && (
                      <div>
                        <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Director's Critique</h4>
                        <p className="text-zinc-300 text-sm bg-black/30 p-4 rounded-xl border border-white/5 leading-relaxed">
                          {selectedItem.analysisResult.critique}
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2 flex-wrap">
                      {selectedItem.model && (
                        <span className="px-3 py-1 bg-white/5 rounded-full text-xs text-zinc-400 border border-white/10">
                          Model: {selectedItem.model}
                        </span>
                      )}
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs border border-white/10 flex items-center gap-1",
                        selectedItem.isPublic ? "bg-green-500/10 text-green-400" : "bg-zinc-500/10 text-zinc-400"
                      )}>
                        {selectedItem.isPublic ? <Globe className="w-3 h-3"/> : <Lock className="w-3 h-3"/>}
                        {selectedItem.isPublic ? 'Public' : 'Private'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Share Modal */}
      <AnimatePresence>
        {shareModal.open && shareModal.item && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
            onClick={() => !isPublishing && setShareModal({ open: false, item: null })}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-lg bg-gradient-to-b from-zinc-900 to-zinc-950 border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
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
                  <div className="relative p-6 pb-0">
                    <button 
                      onClick={() => setShareModal({ open: false, item: null })}
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

                  <div className="p-6">
                    <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black/30 mb-6">
                      <img 
                        src={shareModal.item.image} 
                        alt="Preview" 
                        className="w-full h-48 object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      
                      {shareModal.item.analysisResult?.score && (
                        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                          <span className="text-sm font-bold text-white">{shareModal.item.analysisResult.score}</span>
                          <span className="text-xs text-zinc-400">/100</span>
                        </div>
                      )}
                    </div>

                    <div className="bg-white/5 rounded-xl p-4 border border-white/5 mb-6">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-3 h-3 text-indigo-400" />
                        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Prompt</span>
                      </div>
                      <p className="text-sm text-zinc-300 font-mono line-clamp-2">
                        {shareModal.item.prompt || 'Magic Edit Creation'}
                      </p>
                    </div>

                    <div className="flex items-start gap-3 p-4 bg-indigo-500/10 rounded-xl border border-indigo-500/20 mb-6">
                      <Users className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm text-indigo-200 font-medium">Visible to everyone</p>
                        <p className="text-xs text-indigo-300/60 mt-1">
                          Your creation will appear in the Community Gallery where others can view, remix, and get inspired.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => setShareModal({ open: false, item: null })}
                        disabled={isPublishing}
                        className="flex-1 px-6 py-4 rounded-xl border border-white/10 hover:bg-white/5 text-white font-medium transition-all disabled:opacity-50"
                      >
                        Keep Private
                      </button>
                      <button
                        onClick={handleConfirmPublish}
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

      {/* Toast */}
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
    </section>
  )
}

export default GallerySection
