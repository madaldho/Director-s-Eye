# 🎬 Director's Eye (AI Datadog)

**Director's Eye** is an intelligent cinematography analysis application that combines the power of Generative AI (Google Gemini) with advanced observability (Datadog). This application is designed to win the "AI Accelerate Hackathon" by delivering a premium user experience and high system reliability.

## 🌟 Key Features

- **AI Vision Analysis**: Uses Google Gemini 1.5 Flash to deeply analyze lighting, composition, and mood of photos.
- **Real-time Observability**: Full Datadog integration (APM, RUM, Logs, Metrics) to monitor application performance end-to-end.
- **Premium Interface**: Modern design with dark theme, glassmorphism, and smooth animations, fully internationalized in English.
- **Smart Demo Mode**: Automatic fallback system ensuring the app runs smoothly even when API quotas are exhausted or network issues occur.
- **AI Director Chat**: Interactive feature to discuss technical photography aspects with the AI.

## 🛠️ Technology Stack

- **Frontend**: React, Vite, Tailwind CSS, Framer Motion, Datadog RUM.
- **Backend**: Node.js, Express, Google Generative AI SDK, Datadog Tracer (dd-trace), Winston Logger.
- **Observability**: Datadog APM, Custom Metrics (DogStatsD), Log Management.

## 🚀 How to Run

### Requirements
- Node.js version 18+
- Datadog Account (API Key & App Key)
- Google Cloud Account (Gemini API Key)

### 1. Install Dependencies
Run the following commands in the project root:

```bash
# Install root dependencies (for scripts)
npm install

# Install backend
cd server
npm install

# Install frontend
cd ../client
npm install
```

### 2. Environment Configuration
Ensure `.env` in the project root is correctly filled:
```env
# Datadog
DD_API_KEY=...
DD_SITE=datadoghq.com
DD_SERVICE=directors-eye-backend
DD_ENV=production

# Google AI
GOOGLE_API_KEY=... (or GEMINI_API_KEY)

# Server
PORT=3000
```
And in `client/.env`:
```env
VITE_DD_APPLICATION_ID=...
VITE_DD_CLIENT_TOKEN=...
```

### 3. Run Application
Open two separate terminals:

**Terminal 1 (Backend):**
```bash
cd server
node index.js
```

**Terminal 2 (Frontend):**
```bash
cd client
npm run dev
```
Access the application at `http://localhost:5173`.

## 🚦 Traffic Generator (For Datadog Validation)
Per hackathon requirements, we include a script to generate artificial traffic to test Datadog dashboards and alerts.

```bash
node scripts/traffic-generator.js
```
This script will simulate success and error requests periodically to trigger metrics and trace graphs in Datadog.

## 🏆 Competition Compliance (Validation Rules)
1.  **Google Vertex AI/Gemini**: App uses official SDK.
2.  **Datadog Observability**:
    - **Tracing**: Implemented via `dd-trace` in `server/index.js`.
    - **Metrics**: Custom metrics (`app.cinematography.score`, etc) sent via `dogstatsd`.
    - **Logs**: Winston logger integrated with trace ID injection.
    - **RUM**: User interaction tracking in `HomePage.jsx` and `AnalysisPage.jsx`.

---
*Developed by Muhamad Ali Ridho for Datadog AI Accelerator Hackathon.*