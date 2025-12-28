import React from 'react'
import ReactDOM from 'react-dom/client'
import { datadogRum } from '@datadog/browser-rum'
import App from './App.jsx'
import './index.css'

// Initialize Datadog RUM
datadogRum.init({
  applicationId: import.meta.env.VITE_DD_APPLICATION_ID || 'dummy-app-id',
  clientToken: import.meta.env.VITE_DD_CLIENT_TOKEN || 'dummy-client-token',
  site: 'us5.datadoghq.com',
  service: 'directors-eye-frontend',
  env: 'production',
  version: '1.0.0',
  sessionSampleRate: 100,
  sessionReplaySampleRate: 20,
  trackUserInteractions: true,
  trackResources: true,
  trackLongTasks: true,
  defaultPrivacyLevel: 'mask-user-input'
});

// Track initial page view
datadogRum.startView('home');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)