# 🎬 Director's Eye

**Director's Eye** is an intelligent, personality-driven **AI Cinematography Mentor**. It doesn't just analyze photos; it *directs* you. Accessing the wisdom of legendary filmmakers, it provides real-time, high-precision feedback on lighting, composition, and mood.

> *"More than a tool, it's a creative partner with a soul."*

Built with a focus on **Visual Experience** and **System Reliability**, Director's Eye bridges the gap between creative intuition and engineering precision.



## ✨ Key Features

### 🎨 For Creatives (The Vibe)
*   **The Director Persona**: Chat with an AI that has opinions, style, and deep cinematic knowledge.
*   **Premium Aesthetic**: A dark-themed, glassmorphic interface designed for creative immersion with smooth animations.
*   **Magic Edit**: AI-powered image remixing that transforms your photos with text prompts using AI generative capabilities.
*   **Cinematography Scoring**: Get an objective "Quality Score" (1-100) for every image based on professional visual criteria.
*   **Community Gallery**: Share your creations publicly or keep a private history of all analyses.
*   **Custom API Key**: Bring your own Gemini API key for unlimited usage.

### ⚙️ For Engineers (The Tech)
*   **End-to-End Observability**: Full distributed tracing (`dd-trace`) from the React frontend to the Node.js backend and Gemini AI service.
*   **LLM Observability**: Automatic instrumentation of Google GenAI calls with token tracking, cost estimation, and response quality monitoring.
*   **Security Detection**: Real-time prompt injection detection with alerting to Datadog.
*   **Custom Business Metrics**: Real-time tracking of `app.cinematography.score`, `app.ai.tokens.total`, `app.ai.cost.estimated` via Datadog API.
*   **Reliability First**: 6 detection rules for errors, latency, quality degradation, security threats, cost anomalies, and abuse patterns.

## 🛠️ Technologies Used

### Frontend
*   **React (Vite)**: For a blazing fast UI.
*   **Tailwind CSS**: For custom, premium styling.
*   **Datadog RUM**: For real user monitoring and session replay.

### Backend
*   **Node.js & Express**: Serverless-ready backend architecture.
*   **Google Gemini AI**: Gemini for image analysis, for chat.
*   **Firebase Firestore**: For persistent storage of gallery and history.
*   **dd-trace**: For LLM Observability with automatic Google GenAI instrumentation.
*   **Datadog APM**: Distributed tracing and backend performance monitoring.

---

## 📊 Observability Strategy

**Datadog Organization**: `madaldho Backpack`

| Signal Type | Implementation |
|:---|:---|
| **APM Tracing** | `dd-trace` auto-instrumentation + custom spans for AI calls |
| **LLM Observability** | Automatic Google GenAI tracing (dd-trace v5.81+) |
| **Custom Metrics** | Token usage, cost estimation, cinematography scores, latency |
| **Security Signals** | Prompt injection detection with real-time alerting |
| **RUM** | Session tracking, replay, user interactions |
| **Logs** | Winston logs forwarded to Datadog Logs |

### Detection Rules (6 Monitors)
1. **[High Error Rate](./monitor_error_rate.json)** - Triggers when errors exceed 1%
2. **[High Latency](./monitor_latency.json)** - Triggers when response time exceeds 5 seconds
3. **[Low Quality Score](./monitor_quality_score.json)** - Triggers when AI score drops below 50
4. **Token Anomaly** - Detects unusual spikes in token consumption
5. **Prompt Injection** - Security alert for injection attempts
6. **Cost Anomaly** - Alerts when AI spending exceeds threshold

### SLO
- **Name**: Director's Eye - API Response Time SLO
- **Target**: 99% of requests complete successfully
- **Timeframe**: 30 days rolling
- **Config**: [slo_created.json](./slo_created.json)

### Incident Management
Automated incident creation via API when monitors trigger. See [scripts/create-incident.js](./scripts/create-incident.js).

### Exported Configurations
All Datadog configurations exported as JSON:
- `datadog_dashboard.json` - Main LLM observability dashboard
- `monitor_error_rate.json` - Error rate monitor
- `monitor_latency.json` - Latency monitor  
- `monitor_quality_score.json` - Quality score monitor
- `slo_created.json` - SLO definition
- `slo_latency.json` - Latency SLO

**For complete Datadog organization details, see [DATADOG_ORGANIZATION.md](./DATADOG_ORGANIZATION.md)**

---

## 🚀 Getting Started

Follow these instructions to get the project up and running on your local machine for development and testing purposes.

### Prerequisites

Ensure you have the following installed on your machine:
*   **Node.js**: v18.0.0 or higher.
*   **Python**: v3.8 or higher (for traffic generator)
*   **Git**: Latest version.

### 🔑 API Keys Required
You will need API keys from the following services:
1.  **Google AI Studio**: Get your API key [here](https://aistudio.google.com/).
2.  **Datadog**: Create a free account and get your API Key, App Key, and Client Token [here](https://app.datadoghq.com/).
3.  **Firebase** (Optional, for Gallery): Create a project [here](https://console.firebase.google.com/).

### 💻 Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/madaldho/Director-s-Eye.git
    cd Director-s-Eye
    ```

2.  **Install project dependencies (Root, Client, & Server):**
    We have a unified script to install everything at once.
    ```bash
    npm run install-all
    ```
    *Alternatively, you can install manually:*
    ```bash
    npm install         # Root setup
    cd client && npm install # Client dependencies
    cd ../server && npm install # Server dependencies
    cd ..
    ```

3.  **Environment Configuration:**
    Create a `.env` file in the root directory by copying the example.
    ```bash
    cp .env.example .env
    ```
    
    **Update `.env` with your credentials:**
    
    | Variable | Description | Required |
    | :--- | :--- | :--- |
    | `GOOGLE_API_KEY` | Google Gemini API Key | ✅ |
    | `DD_API_KEY` | Datadog API Key | ✅ |
    | `DD_APP_KEY` | Datadog App Key | ✅ |
    | `DD_SITE` | Datadog Site Region (e.g., `us5.datadoghq.com`) | ✅ |
    | `DD_LLMOBS_ENABLED` | Enable LLM Observability (`1`) | ✅ |
    | `DD_LLMOBS_ML_APP` | LLM Obs App Name (`director-eye`) | ✅ |
    | `VITE_DD_CLIENT_TOKEN` | Datadog Client Token (Frontend) | ✅ |
    | `VITE_DD_APPLICATION_ID` | Datadog RUM App ID | ✅ |
    | `VITE_DD_SITE` | Datadog Site for RUM | ✅ |
    | `VITE_FIREBASE_API_KEY` | Firebase Client API Key | ✅ |
    | `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain | ✅ |
    | `VITE_FIREBASE_PROJECT_ID` | Firebase Project ID | ✅ |
    | `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage Bucket | ✅ |
    | `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Messaging Sender ID | ✅ |
    | `VITE_FIREBASE_APP_ID` | Firebase App ID | ✅ |
    | `VITE_FIREBASE_MEASUREMENT_ID` | Firebase Analytics Measurement ID | Optional |
    | `VITE_FIREBASE_DATABASE_URL` | Firebase Realtime Database URL | Optional |

4.  **Firebase Setup (For Gallery Feature):**
    
    **Server-side (Admin SDK):**
    
    Option A - Service Account File (Local Development):
    ```bash
    # 1. Create Firebase project at console.firebase.google.com
    # 2. Enable Firestore Database
    # 3. Download Service Account JSON from Project Settings > Service Accounts
    # 4. Save as server/service-account.json (gitignored)
    ```
    
    Option B - Environment Variables (Production/Vercel):
    ```bash
    FIREBASE_PROJECT_ID=your-project-id
    FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
    FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
    ```
    
    **Deploy Firestore indexes:**
    ```bash
    npx firebase-tools deploy --only firestore:indexes
    ```

5.  **Setup Datadog Monitors:**
    ```bash
    node scripts/auto_create_monitors.js
    node scripts/create-slo.js
    ```

### ▶️ Running the Application

You need to run **both Backend and Frontend** to use the application.

#### Option 1: Quick Start (Single Command)

Run both Client and Server concurrently:

```bash
npm run dev
```

#### Option 2: Manual Startup (Two Terminals)

**Terminal 1 - Start Backend Server:**

```bash
cd server
node index.js
```

You should see:
```
🎬 Directors Eye Backend running on port 4567
🤖 AI Status: Connected
```

**Terminal 2 - Start Frontend:**

```bash
cd client
npm run dev
```

You should see:
```
VITE ready in XXXms
➜ Local: http://localhost:3000/
```

#### Access the Application

*   **Frontend**: Open [http://localhost:3000](http://localhost:3000)
*   **Backend API**: Running on `http://localhost:4567`

> **Note**: Make sure Backend is running FIRST before using the Frontend.

---

### 🚦 Traffic Generator (For Demo & Testing)

To demonstrate the **End-to-End Observability** features (Alerts, Traces, Metrics) without waiting for real users, use the included traffic generators.

#### Option 1: Python Version (Recommended for Datadog Challenge)
```bash
pip install requests
python3 traffic.py
```

#### Option 2: Node.js Version
```bash
node scripts/traffic-generator.js
```

### What it does?
The script will endlessly loop through these scenarios to populate your Datadog Dashboard:
*   ✅ **Standard Analysis**: Sends valid images to be analyzed (Success 200 OK).
*   💬 **Chat Simulation**: Converses with the AI "Director" about lighting and composition.
*   ⚠️ **Latency Spikes**: Simulates slow network conditions to trigger Latency Monitors.
*   ❌ **Errors**: Intentionally triggers 500 Errors to test Error Rate Monitors.


## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
