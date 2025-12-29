# 🎬 Director's Eye

**Director's Eye** is an intelligent, personality-driven **AI Cinematography Mentor**. It doesn't just analyze photos; it *directs* you. Accessing the wisdom of legendary filmmakers, it provides real-time, high-precision feedback on lighting, composition, and mood.

> *"More than a tool, it's a creative partner with a soul."*

Built with a focus on **Visual Experience** and **System Reliability**, Director's Eye bridges the gap between creative intuition and engineering precision.


## ✨ Key Features

### 🎨 For Creatives (The Vibe)
*   **The Director Persona**: Chat with an AI that has opinions, style, and deep cinematic knowledge. 
*   **Premium Aesthetic**: A dark-themed, glassmorphic interface designed for creative immersion with smooth animations.
*   **Instant Insight**: Magic Edit suggestions that visualize potential improvements instantly using Generative AI.
*   **Cinematography Scoring**: Get an objective "Quality Score" for every image based on professional visual criteria.

### ⚙️ For Engineers (The Tech)
*   **End-to-End Observability**: Full distributed tracing (`dd-trace`) from the React frontend to the Node.js backend and Gemini AI service.
*   **LLM Monitoring**: Tracks Token Usage, Cost, and Hallucinations for every AI inference.
*   **Custom Business Metrics**: Real-time tracking of `app.quality_score` and user engagement via DogStatsD.
*   **Reliability First**: Alerting pipelines for high error rates and latency spikes.

## 🛠️ Technologies Used

### Frontend
*   **React (Vite)**: For a blazing fast UI.
*   **Tailwind CSS**: For custom, premium styling.
*   **Framer Motion**: For fluid UI transitions.
*   **Datadog RUM**: For real user monitoring and session replay.

### Backend
*   **Node.js & Express**: Serverless-ready backend architecture.
*   **Google Gemini **: Multimodal AI for sub-second image analysis.
*   **Datadog APM**: Distributed tracing and backend performance monitoring.

---

### Observability Strategy
| Signal Type | Implementation |
|:---|:---|
| **APM Tracing** | `dd-trace` auto-instrumentation + custom spans for AI calls |
| **Custom Metrics** | Token usage, cost estimation, cinematography scores |
| **RUM** | Session tracking, replay, user interactions |
| **Browser Logs** | Error forwarding to Datadog Logs |

### Detection Rules (3 Monitors)
1. **[High Error Rate](./monitor_error_rate.json)** - Triggers when errors exceed 1%
2. **[High Latency](./monitor_latency.json)** - Triggers when response time exceeds 5 seconds
3. **[Low Quality Score](./monitor_quality_score.json)** - Triggers when AI score drops below 50

### SLO
- **Name**: Director's Eye - API Response Time SLO
- **Target**: 99% of requests complete successfully
- **Timeframe**: 30 days rolling
- **Config**: [slo_created.json](./slo_created.json)

### Incident Management
Automated incident creation via API when monitors trigger. See [scripts/create-incident.js](./scripts/create-incident.js).


### Exported Configurations
All Datadog configurations exported as JSON:
- `datadog_dashboard.json` - Main observability dashboard
- `monitor_error_rate.json` - Error rate monitor
- `monitor_latency.json` - Latency monitor  
- `monitor_quality_score.json` - Quality score monitor
- `slo_created.json` - SLO definition

---

## 🚀 Getting Started

Follow these instructions to get the project up and running on your local machine for development and testing purposes.

### Prerequisites

Ensure you have the following installed on your machine:
*   **Node.js**: v18.0.0 or higher.
*   **Python**: v3.8 or higher 
*   **Git**: Latest version. 

### 🔑  API Keys Required
You will need API keys from the following services:
1.  **Google AI Studio**: Get your API key [here](https://aistudio.google.com/).
2.  **Datadog**: Create a free account and get your API Key and Client Token [here](https://app.datadoghq.com/).

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
    
    | Variable | Description | Example Value |
    | :--- | :--- | :--- |
    | `GEMINI_API_KEY` | Your Google Gemini API Key | `AIzaSy...` |
    | `DD_API_KEY` | Datadog API Key (Backend) | `e1a7...` |
    | `DD_SITE` | Datadog Site Region | `us5.datadoghq.com` |
    | `VITE_DD_CLIENT_TOKEN` | Datadog Client Token (Frontend) | `pub2f...` |
    | `VITE_DD_APPLICATION_ID` | Datadog RUM App ID | `b3c4...` |

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

## 🚦 Traffic Generator (For Demo & Testing)

To demonstrate the **End-to-End Observability** features (Alerts, Traces, Metrics) without waiting for real users, use the included Python traffic generator.

### 1. Setup Python Environment
```bash
# Ensure you are in the root directory
pip install requests
```

### 2. Run the Generator
```bash
python3 traffic.py
```

### 3. What it does?
The script will endlessly loop through these scenarios to populate your Datadog Dashboard:
*   ✅ **Standard Analysis**: Sends valid images to be analyzed (Success 200 OK).
*   💬 **Chat Simulation**: Converses with the AI "Director" about lighting and composition.
*   ⚠️ **Latency Spikes**: Simulates slow network conditions to trigger Latency Monitors.
*   ❌ **Errors**: Intentionally triggers 500 Errors to test Error Rate Monitors.


## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
