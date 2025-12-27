import React, { useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { datadogRum } from '@datadog/browser-rum'
import Navbar from './components/Navbar'
import TelemetryConsole from './components/TelemetryConsole'
import HomePage from './pages/HomePage'
import AnalysisPage from './pages/AnalysisPage'

function App() {
  const [analysisResult, setAnalysisResult] = useState(null)
  const [uploadedImage, setUploadedImage] = useState(null)
  const [telemetryLogs, setTelemetryLogs] = useState([])

  const addTelemetryLog = (log) => {
    const timestamp = new Date().toLocaleTimeString()
    const newLog = { ...log, timestamp, id: Date.now() }
    setTelemetryLogs(prev => [...prev.slice(-9), newLog]) // Keep last 10 logs
  }

  const handleAnalysisComplete = (result, imageData) => {
    setAnalysisResult(result)
    setUploadedImage(imageData)
    
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
        
        <TelemetryConsole logs={telemetryLogs} />
      </div>
    </Router>
  )
}

export default App