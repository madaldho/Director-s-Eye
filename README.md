# Director's Eye 🎬

AI-powered cinematography analysis application built for the **Google Cloud x Datadog Hackathon**. Analyze your photos with Google Vertex AI (Gemini Pro Vision) and monitor everything with comprehensive Datadog observability.

## 🚀 Features

- **AI-Powered Analysis**: Uses Google Vertex AI Gemini 1.5 Flash for cinematography scoring
- **Real-time Telemetry**: Complete Datadog integration (RUM, APM, Logs, Custom Metrics)
- **Interactive Chat**: Ask follow-up questions about your images
- **Demo Mode**: Works without API keys for smooth presentations
- **Cinematic UI**: Dark mode with glassmorphism design
- **Live Telemetry Console**: Visual feedback of all Datadog data being sent

## 🛠 Tech Stack

**Frontend:**
- React 18 + Vite
- Tailwind CSS + Framer Motion
- Datadog Browser RUM
- Recharts for data visualization

**Backend:**
- Node.js + Express
- Google Vertex AI SDK
- Datadog APM (dd-trace)
- Winston logging

## 📋 Prerequisites

1. **Google Cloud Project** with Vertex AI API enabled
2. **Datadog Account** with RUM application configured
3. **Node.js 18+** and npm

## 🔧 Setup Instructions

### 1. Clone and Install

```bash
git clone https://github.com/madaldho/Director-s-Eye.git
cd Director-s-Eye
npm run install-all
```

### 2. Google Cloud Setup

1. Create a new project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable the **Vertex AI API**
3. Create a Service Account with **Vertex AI User** role
4. Download the JSON key file and save as `credentials.json` in the root directory

### 3. Datadog Configuration

1. Create a new RUM application in [Datadog](https://app.datadoghq.com/rum/list)
2. Get your **Application ID** and **Client Token**
3. Get your **API Key** from Datadog settings

### 4. Environment Variables

```bash
cp .env.example .env
```

Fill in your credentials:

```env
# Datadog
DD_API_KEY=your_datadog_api_key
VITE_DD_APPLICATION_ID=your_rum_application_id
VITE_DD_CLIENT_TOKEN=your_rum_client_token

# Google Cloud
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=./credentials.json
```

### 5. Run the Application

```bash
# Development mode (runs both frontend and backend)
npm run dev

# Or run separately:
npm run server  # Backend on :5000
npm run client  # Frontend on :3000
```

## 📊 Datadog Monitoring Setup

### Import These Monitors

Copy and paste these JSON configurations in Datadog → Monitors → New Monitor → JSON:

**1. High AI Latency Monitor:**
```json
{
  "name": "[Director's Eye] High AI Latency Warning",
  "type": "query alert",
  "query": "avg(last_5m):avg:trace.express.request.duration{service:directors-eye-backend} > 8",
  "message": "Warning: AI Processing is taking too long (>8s).\nCheck Vertex AI Quota or Network Latency.\n\n@webhook-incident-management",
  "tags": ["env:production", "team:ai-hackathon"],
  "options": {
    "thresholds": {
      "critical": 8,
      "warning": 5
    }
  }
}
```

**2. Low Quality Content Monitor:**
```json
{
  "name": "[Director's Eye] Low Quality Content Flood",
  "type": "query alert", 
  "query": "avg(last_5m):avg:app.cinematography.score{service:directors-eye-backend} < 40",
  "message": "Alert: Average cinematic score dropped below 40.\nPossible spam attack or camera malfunction.",
  "tags": ["service:directors-eye", "severity:medium"],
  "options": {
    "thresholds": {
      "critical": 40
    }
  }
}
```

**3. Critical System Failure Monitor:**
```json
{
  "name": "[Director's Eye] CRITICAL SYSTEM FAILURE",
  "type": "log alert",
  "query": "logs(\"service:directors-eye-backend status:error\").index(\"*\").rollup(\"count\").last(\"1m\") > 2",
  "message": "CRITICAL EXCEPTION DETECTED.\nSystem is failing to process images.\n\nTRIGGERING INCIDENT RESPONSE...",
  "tags": ["env:production", "severity:critical"],
  "options": {
    "thresholds": {
      "critical": 2
    }
  }
}
```

## 🎯 Key Endpoints

- `GET /api/health` - Health check
- `POST /api/analyze` - Main image analysis
- `POST /api/chat` - Chat with AI about images  
- `POST /api/simulate-error` - Trigger error for demo

## 🎬 Demo Features

- **Demo Mode Toggle**: Works without API keys using dummy data
- **Simulate Error Button**: Triggers Datadog incident for demo
- **Live Telemetry Console**: Shows real-time Datadog data transmission
- **Interactive Chat**: Ask AI follow-up questions about images

## 📈 Observability Features

**Custom Metrics:**
- `app.cinematography.score` - Image quality scores
- `app.ai.processing_time` - AI response times
- `app.errors.total` - Error counts by type

**Distributed Tracing:**
- Every AI request wrapped in Datadog spans
- Custom tags: `ai.model`, `cinematography.score`, `app.version`

**Real User Monitoring:**
- Page views and user actions tracked
- Performance metrics and error tracking
- Session replay for debugging

## 🏆 Hackathon Highlights

1. **Complete Observability Stack**: RUM + APM + Logs + Custom Metrics
2. **AI Integration**: Real Vertex AI analysis with fallback demo mode
3. **Visual Telemetry**: Live console showing Datadog data flow
4. **Incident Simulation**: Built-in error triggering for demos
5. **Production Ready**: Proper error handling and monitoring

## 🚀 Deployment

The application is designed to work on any platform supporting Node.js. For production:

1. Set `NODE_ENV=production`
2. Configure proper Datadog tags
3. Ensure Google Cloud credentials are properly mounted
4. Set up proper CORS for your domain

## 📝 License

MIT License - Built for Google Cloud x Datadog Hackathon 2025