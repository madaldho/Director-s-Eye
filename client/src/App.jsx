import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { datadogRum } from '@datadog/browser-rum'
import Navbar from './components/Navbar'
import TelemetryConsole from './components/TelemetryConsole'
import BackToTop from './components/BackToTop'
import ScrollToTop from './components/ScrollToTop'
import HomePage from './pages/HomePage'
import AnalysisPage from './pages/AnalysisPage'

function App() {
  // Disable browser's default scroll restoration
  useEffect(() => {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
  }, []);

  // Initialize sessionId on app start (before any component needs it)
  useEffect(() => {
    if (!sessionStorage.getItem('session_id')) {
      const id = Math.random().toString(36).substring(2, 10).toUpperCase();
      sessionStorage.setItem('session_id', id);
      console.log('Session ID initialized:', id);
    }
  }, []);

  // Initialize from LocalStorage to persist state updates/refresh
  const [analysisResult, setAnalysisResult] = useState(() => {
    const saved = localStorage.getItem('lastAnalysis');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [uploadedImage, setUploadedImage] = useState(() => {
    return localStorage.getItem('lastImage') || null;
  });

  const [telemetryLogs, setTelemetryLogs] = useState([])

  const addTelemetryLog = (log) => {
    const timestamp = new Date().toLocaleTimeString()
    const newLog = { ...log, timestamp, id: Date.now() }
    setTelemetryLogs(prev => [...prev.slice(-9), newLog]) // Keep last 10 logs
  }

  const handleAnalysisComplete = (result, imageData) => {
    setAnalysisResult(result)
    setUploadedImage(imageData)
    
    // Save to LocalStorage
    localStorage.setItem('lastAnalysis', JSON.stringify(result));
    localStorage.setItem('lastImage', imageData);
    
    // Track RUM action
    datadogRum.addAction('image_analyzed', {
      score: result.score,
      lighting: result.lighting,
      composition: result.composition
    })
    
    // Add telemetry logs
    addTelemetryLog({
      type: 'success',
      message: `Analysis complete - Score: ${result.score}/100`
    })
    
    addTelemetryLog({
      type: 'metric',
      message: `Sending metric: cinematography.score=${result.score}`
    })
  }

  return (
    <Router>
      <div className="min-h-screen bg-dark-950 text-white">
        <ScrollToTop />
        <Navbar onTelemetryLog={addTelemetryLog} />
        
        <main className="pb-32"> {/* Space for telemetry console */}
          <Routes>
            <Route 
              path="/" 
              element={
                <HomePage 
                  onAnalysisComplete={handleAnalysisComplete}
                  onTelemetryLog={addTelemetryLog}
                />
              } 
            />
            <Route 
              path="/analysis" 
              element={
                <AnalysisPage 
                  result={analysisResult}
                  image={uploadedImage}
                  onTelemetryLog={addTelemetryLog}
                />
              } 
            />
          </Routes>
        </main>
        
        <BackToTop />
        <TelemetryConsole logs={telemetryLogs} />
      </div>
    </Router>
  )
}

export default App