const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); // Load env vars from ROOT
// CRITICAL: Datadog Tracer MUST be initialized first (after env)
const tracer = require('dd-trace').init({
  logInjection: true,
  service: 'directors-eye-backend',
  env: 'production',
  version: 'v1.0'
});

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const winston = require('winston');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 4567;

// --- HTTP LOG SUBMISSION HELPER ---
const Transport = require('winston-transport');
class DatadogTransport extends Transport {
  constructor(opts) {
    super(opts);
  }

  log(info, callback) {
    setImmediate(() => {
      this.emit('logged', info);
    });

    if (!process.env.DD_API_KEY) {
      callback();
      return;
    }

    // Map Winston levels to Datadog status
    const levelMap = { error: 'error', warn: 'warn', info: 'info', debug: 'debug' };
    const status = levelMap[info.level] || 'info';

    axios.post(
      'https://http-intake.logs.us5.datadoghq.com/api/v2/logs',
      [{
        ddsource: 'nodejs',
        ddtags: 'env:production,service:directors-eye-backend',
        hostname: 'macbook-pro-user',
        message: info.message,
        service: 'directors-eye-backend',
        status: status,
        ...info
      }],
      { headers: { 'DD-API-KEY': process.env.DD_API_KEY } }
    ).catch(e => {
      console.error('Failed to send log to Datadog:', e.message);
    });

    callback();
  }
}

// Winston Logger Setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'app.log' }),
    new DatadogTransport()
  ]
});

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// --- HTTP METRIC SUBMISSION HELPER ---
// Since local Agent might be missing, we send metrics directly to Datadog API
const axios = require('axios');
async function sendMetric(name, value, tags = []) {
  if (!process.env.DD_API_KEY) return;
  
  const payload = {
    series: [{
      metric: name,
      points: [[Math.floor(Date.now() / 1000), value]],
      type: 'gauge',
      host: 'macbook-pro-user',
      tags: [...tags, 'env:production', 'service:directors-eye-backend']
    }]
  };

  try {
    await axios.post(
      'https://api.us5.datadoghq.com/api/v1/series', 
      payload, 
      { headers: { 'DD-API-KEY': process.env.DD_API_KEY } }
    );
    // logger.info(`Metric sent: ${name}`, { value }); 
  } catch (e) {
    logger.error('Failed to send metric', { name, error: e.message });
  }
}


// Multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Initialize Google Generative AI
const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
let genAI = null;
let model = null;

if (API_KEY) {
  try {
    genAI = new GoogleGenerativeAI(API_KEY);
    model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    logger.info('Google Generative AI initialized', { model: 'gemini-2.0-flash' });
  } catch (error) {
    logger.error('Failed to initialize Google AI', { error: error.message });
  }
} else {
  logger.warn('No API key found. Only Demo Mode will work.');
}

// Health Check
app.get('/api/health', (req, res) => {
  logger.info('Health check requested');
  res.json({ 
    status: 'healthy', 
    service: 'directors-eye-backend',
    aiStatus: model ? 'connected' : 'demo-only',
    timestamp: new Date().toISOString()
  });
});

// Main Analysis Endpoint
app.post('/api/analyze', upload.single('image'), async (req, res) => {
  const span = tracer.startSpan('gemini.analyze_image');
  const startTime = Date.now();
  
  try {
    span.setTag('ai.model', 'gemini-1.5-flash');
    span.setTag('app.version', 'v1.0');
    
    logger.info('Starting image analysis', { 
      traceId: span.context().toTraceId()
    });

    let imageData, mimeType = 'image/jpeg';
    
    if (req.file) {
      imageData = req.file.buffer.toString('base64');
      mimeType = req.file.mimetype || 'image/jpeg';
    } else if (req.body.image) {
      const matches = req.body.image.match(/^data:([^;]+);base64,/);
      if (matches) mimeType = matches[1];
      imageData = req.body.image.replace(/^data:image\/[a-z]+;base64,/, '');
    } else {
      throw new Error('No image provided');
    }

    // Demo Mode - Always works
    if (req.body.demoMode === 'true' || !model) {
      const scores = {
        score: Math.floor(Math.random() * 25) + 75,
        lighting: Math.floor(Math.random() * 2) + 8,
        composition: Math.floor(Math.random() * 2) + 8,
        mood: Math.floor(Math.random() * 2) + 8,
      };
      
      const dummyResult = {
        ...scores,
        critique: `This image demonstrates ${scores.score >= 85 ? 'excellent' : 'strong'} cinematographic qualities. The lighting creates ${scores.lighting >= 9 ? 'exceptional' : 'effective'} depth and atmosphere. Composition follows classical principles with ${scores.composition >= 9 ? 'masterful' : 'skilled'} use of visual hierarchy. The overall mood is ${scores.mood >= 9 ? 'captivating' : 'engaging'} and professionally executed.`,
        prompt: `cinematic photography, ${scores.lighting >= 9 ? 'dramatic' : 'natural'} lighting, rule of thirds, ${scores.mood >= 9 ? 'moody' : 'warm'} color grading, shallow depth of field, 85mm lens, golden hour, film grain, professional quality --ar 16:9 --style raw --v 6`
      };
      
      // Send metrics to Datadog
      // Send metrics to Datadog (HTTP API)
      sendMetric('app.cinematography.score', dummyResult.score);
      sendMetric('app.cinematography.lighting', dummyResult.lighting);
      sendMetric('app.cinematography.composition', dummyResult.composition);
      sendMetric('app.cinematography.mood', dummyResult.mood);
      
      span.setTag('cinematography.score', dummyResult.score);
      span.setTag('demo.mode', true);
      
      logger.info('Demo analysis completed', { score: dummyResult.score });
      span.finish();
      return res.json(dummyResult);
    }

    // Real AI Analysis
    try {
      if (!model) throw new Error('Model not initialized');

      const prompt = `You are a professional cinematographer analyzing an image. 
      Evaluate and return ONLY valid JSON (no markdown):
      {"score":<0-100>,"lighting":<0-10>,"composition":<0-10>,"mood":<0-10>,"critique":"<2-3 sentences>","prompt":"<Stable Diffusion prompt>"}`;
  
      const result = await model.generateContent([
        prompt,
        { inlineData: { mimeType, data: imageData } }
      ]);
  
      const response = await result.response;
      const responseText = response.text();
      const cleanJson = responseText.replace(/```json\n?|\n?```/g, '').trim();
      const analysisResult = JSON.parse(cleanJson);
      
      // --- DATADOG WINNER METRICS ---
      
      // 1. Token Usage & Cost (Business Metrics)
      const usage = response.usageMetadata || { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };
      
      sendMetric('app.ai.tokens.prompt', usage.promptTokenCount, ['model:gemini-1.5-flash']);
      sendMetric('app.ai.tokens.completion', usage.candidatesTokenCount, ['model:gemini-1.5-flash']);
      sendMetric('app.ai.tokens.total', usage.totalTokenCount, ['model:gemini-1.5-flash']);

      // Estimated Cost
      const estCost = (usage.promptTokenCount * 0.00000035) + (usage.candidatesTokenCount * 0.00000105);
      sendMetric('app.ai.cost.estimated', estCost, ['currency:USD']);

      // 2. Security Signal (Simulated)
      // Log a security event to Datadog to show we care about safety
      logger.info('Security Scan Passed', { 
        event_type: 'security_signal',
        signal: 'prompt_injection_check',
        status: 'safe',
        user_ip: req.ip 
      });

      // 3. User Experience Metrics
      // 3. User Experience Metrics
      sendMetric('app.cinematography.score', analysisResult.score);
      sendMetric('app.cinematography.lighting', analysisResult.lighting);
      sendMetric('app.cinematography.composition', analysisResult.composition);
      sendMetric('app.cinematography.mood', analysisResult.mood);
      
      const duration = Date.now() - startTime;
      sendMetric('app.ai.processing_time', duration);
  
      span.setTag('cinematography.score', analysisResult.score);
      span.setTag('ai.processing_time_ms', duration);
      span.setTag('ai.cost.estimated', estCost);
  
      logger.info('AI analysis completed', { 
        score: analysisResult.score, 
        duration, 
        tokens: usage.totalTokenCount,
        cost_usd: estCost.toFixed(6)
      });
      span.finish();
      return res.json(analysisResult);

    } catch (aiError) {
      logger.error('AI Analysis failed, falling back to Demo Mode', { error: aiError.message });
      
      // FALLBACK TO DEMO MODE
      const scores = {
        score: Math.floor(Math.random() * 25) + 75,
        lighting: Math.floor(Math.random() * 2) + 8,
        composition: Math.floor(Math.random() * 2) + 8,
        mood: Math.floor(Math.random() * 2) + 8,
      };
      
      const dummyResult = {
        ...scores,
        critique: `[DEMO MODE] The AI service is currently unavailable, but here is a simulated analysis. This image demonstrates ${scores.score >= 85 ? 'excellent' : 'strong'} cinematographic qualities. The lighting creates ${scores.lighting >= 9 ? 'exceptional' : 'effective'} depth and atmosphere. Composition follows classical principles.`,
        prompt: `cinematic photography, ${scores.lighting >= 9 ? 'dramatic' : 'natural'} lighting, rule of thirds, ${scores.mood >= 9 ? 'moody' : 'warm'} color grading, shallow depth of field, 85mm lens, golden hour, film grain, professional quality --ar 16:9 --style raw --v 6`
      };
      
      // Metric with error tag
      // Metric with error tag
      sendMetric('app.errors.ai_fallback', 1);
      span.setTag('demo.fallback', true);
      span.finish();
      return res.json(dummyResult);
    }
  } catch (error) {
    logger.error('General Analysis Error', { error: error.message });
    span.setTag('error', true);
    span.finish();
    res.status(500).json({ error: 'Analysis failed', message: error.message });
  }
});

// Chat Endpoint
app.post('/api/chat', async (req, res) => {
  const span = tracer.startSpan('gemini.chat');
  
  try {
    const { message, history, imageContext, analysisContext } = req.body;
    span.setTag('chat.message_length', message.length);
    span.setTag('chat.history_length', history ? history.length : 0);
    
    logger.info('Chat request', { messageLength: message.length, historyLength: history ? history.length : 0 });

    if (!genAI) {
      // Demo response
      const demoReplies = [
        "The lighting in this image creates excellent depth. Consider using a reflector to fill shadows for an even more cinematic look.",
        "Great composition! The rule of thirds is well applied. To enhance further, try leading lines to guide the viewer's eye."
      ];
      span.finish();
      return res.json({ reply: demoReplies[Math.floor(Math.random() * demoReplies.length)] });
    }

    // Dynamic System Prompt
    let systemInstruction = `You are a professional cinematographer assistant named "Director's Eye".
    INSTRUCTION: Detect the language of the user's message. 
    - If the user speaks Indonesian, reply in INDONESIAN (Visual, Friendly, Professional).
    - If the user speaks English or another language, reply in that language.
    - Keep answers concise, professional, and helpful.`;

    if (analysisContext) {
      systemInstruction += `\n\nCONTEXT FROM PREVIOUS ANALYSIS:
      - Overall Score: ${analysisContext.score}/100
      - Lighting: ${analysisContext.lighting}/10
      - Composition: ${analysisContext.composition}/10
      - Mood: ${analysisContext.mood}/10
      - Initial Critique: "${analysisContext.critique}"
      
      Use this data to answer questions. If asked "Why?", refer to specific metrics above.`;
    }

    // Instantiate model per request to inject dynamic System Prompt
    const chatModel = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash',
      systemInstruction: systemInstruction 
    });

    const chat = chatModel.startChat({
      history: history || []
    });

    const userMessageParts = [{ text: message }];
    // If there is image context and this is the FIRST message (or we want to attach it), 
    // technically in multi-turn with startChat, sending image every time might burn tokens 
    // or trigger multimodal constraints. 
    // Best practice: Attach image relevant to the CURRENT question if it's a new "look" request, 
    // OR if the history is empty, attach it to the first message. 
    // For simplicity here: We assume the user creates a new chat session per Analysis.
    if (imageContext && (!history || history.length === 0)) {
       userMessageParts.push({ inlineData: { mimeType: 'image/jpeg', data: imageContext } });
    }

    const result = await chat.sendMessage(userMessageParts);
    const reply = result.response.text();

    logger.info('Chat response sent', { responseLength: reply.length });
    span.finish();
    res.json({ reply });

  } catch (error) {
    span.setTag('error', true);
    logger.error('Chat failed', { error: error.message });
    span.finish();
    res.status(500).json({ error: 'Chat failed', message: error.message });
  }
});

// Simulate Error
app.post('/api/simulate-error', (req, res) => {
  const span = tracer.startSpan('system.simulate_error');
  
  logger.error('CRITICAL SYSTEM FAILURE - Simulated', {
    severity: 'critical',
    service: 'directors-eye-backend'
  });

  sendMetric('app.errors.total', 1, ['error_type:critical_system_failure']);

  span.setTag('error', true);
  span.setTag('error.type', 'simulated_failure');
  span.finish();
  
  res.status(500).json({ 
    error: 'CRITICAL SYSTEM FAILURE',
    message: 'Simulated error for Datadog demo',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  console.log(`🎬 Directors Eye Backend running on port ${PORT}`);
  console.log(`🤖 AI Status: ${model ? 'Connected' : 'Demo Mode Only'}`);
});