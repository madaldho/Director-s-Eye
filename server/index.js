require('dotenv').config(); // Load env vars FIRST to ensure DD_SITE is available
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

// Winston Logger Setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'app.log' })
  ]
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
      tracer.dogstatsd.gauge('app.cinematography.score', dummyResult.score, { service: 'directors-eye-backend', env: 'production' });
      tracer.dogstatsd.gauge('app.cinematography.lighting', dummyResult.lighting, { service: 'directors-eye-backend', env: 'production' });
      tracer.dogstatsd.gauge('app.cinematography.composition', dummyResult.composition, { service: 'directors-eye-backend', env: 'production' });
      tracer.dogstatsd.gauge('app.cinematography.mood', dummyResult.mood, { service: 'directors-eye-backend', env: 'production' });
      
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
  
      const responseText = result.response.text();
      const cleanJson = responseText.replace(/```json\n?|\n?```/g, '').trim();
      const analysisResult = JSON.parse(cleanJson);
  
      // Send all metrics to Datadog
      tracer.dogstatsd.gauge('app.cinematography.score', analysisResult.score, { service: 'directors-eye-backend', env: 'production' });
      tracer.dogstatsd.gauge('app.cinematography.lighting', analysisResult.lighting, { service: 'directors-eye-backend', env: 'production' });
      tracer.dogstatsd.gauge('app.cinematography.composition', analysisResult.composition, { service: 'directors-eye-backend', env: 'production' });
      tracer.dogstatsd.gauge('app.cinematography.mood', analysisResult.mood, { service: 'directors-eye-backend', env: 'production' });
      
      const duration = Date.now() - startTime;
      tracer.dogstatsd.histogram('app.ai.processing_time', duration, { service: 'directors-eye-backend' });
  
      span.setTag('cinematography.score', analysisResult.score);
      span.setTag('ai.processing_time_ms', duration);
  
      logger.info('AI analysis completed', { score: analysisResult.score, duration });
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
      tracer.dogstatsd.increment('app.errors.ai_fallback', 1, { service: 'directors-eye-backend' });
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
    const { message, imageContext } = req.body;
    span.setTag('chat.message_length', message.length);
    
    logger.info('Chat request', { messageLength: message.length });

    if (!model) {
      // Demo response
      const demoReplies = [
        "The lighting in this image creates excellent depth. Consider using a reflector to fill shadows for an even more cinematic look.",
        "Great composition! The rule of thirds is well applied. To enhance further, try leading lines to guide the viewer's eye.",
        "The mood is captivating. For similar results, shoot during golden hour with a wide aperture for that dreamy bokeh effect.",
        "This has strong visual hierarchy. The color grading adds to the cinematic feel - warm tones work beautifully here."
      ];
      span.finish();
      return res.json({ reply: demoReplies[Math.floor(Math.random() * demoReplies.length)] });
    }

    const parts = [`You are a professional cinematographer assistant. 
    INSTRUCTION: Detect the language of the user's message. 
    - If the user speaks Indonesian, reply in INDONESIAN.
    - If the user speaks English or another language, reply in that language.
    - Keep answers concise, professional, and helpful.
    
    User Message: ${message}`];
    if (imageContext) {
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: imageContext } });
    }

    const result = await model.generateContent(parts);
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

  tracer.dogstatsd.increment('app.errors.total', 1, {
    service: 'directors-eye-backend',
    error_type: 'critical_system_failure'
  });

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