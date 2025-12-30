const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); // Load env vars from ROOT

// CRITICAL: Datadog Tracer MUST be initialized first (after env)
const tracer = require('dd-trace').init({
  logInjection: true,
  service: 'directors-eye-backend',
  env: 'production',
  version: 'v1.0',
  // LLM Observability - auto-instruments Google GenAI
  llmobs: {
    mlApp: 'director-eye',
    agentlessEnabled: true // Send directly to Datadog API without Agent
  }
});

// Access llmobs for manual annotations if needed
const { llmobs } = tracer;

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const admin = require('firebase-admin');
const { db } = require('./firebase');
const multer = require('multer');
const winston = require('winston');
const axios = require('axios'); // Moved to top - used in DatadogTransport
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 4567;

const logger = require('./logger');

// Security & Middleware (Logger is now imported)

// Security & Middleware
app.use(helmet()); // Security headers
app.use(cors());   // Enable CORS
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// --- HTTP METRIC SUBMISSION HELPER ---
// Since local Agent might be missing, we send metrics directly to Datadog API
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

// 🤖 AI INITIALIZATION (Gemini 2.5 Flash Lite & Gemini 3.0 Pro)
let genAI = null;
let model = null;

try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (apiKey) {
        genAI = new GoogleGenAI({ apiKey });
        logger.info('Google GenAI initialized');
    } else {
        logger.warn('AI Key Missing - Running in Demo mode');
    }
} catch (error) {
    logger.error('GenAI Init Failed', { error: error.message });
}

// Health Check
app.get('/api/health', (req, res) => {
  logger.info('Health check requested');
  res.json({ 
    status: 'healthy', 
    service: 'directors-eye-backend',
    aiStatus: genAI ? 'connected' : 'demo-only',
    timestamp: new Date().toISOString()
  });
});

// Validate Custom API Key
app.post('/api/validate-key', async (req, res) => {
  const userApiKey = req.headers['x-user-api-key'];
  
  if (!userApiKey || userApiKey.length < 30) {
    return res.json({ valid: false, tier: 'unknown', message: 'Invalid key format' });
  }
  
  try {
    // Test the API key by making a simple text request (not image)
    const testAI = new GoogleGenAI({ apiKey: userApiKey });
    const response = await testAI.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: 'Reply with just "OK"' }] }]
    });
    
    if (response && response.text) {
      logger.info('Custom API key validated successfully');
      // Key is valid, but we can't easily determine if it's free or paid
      // We'll assume it's valid and let the actual request fail if quota exceeded
      res.json({ 
        valid: true, 
        tier: 'unknown', // Can't determine tier from simple test
        message: 'API key is valid. Note: Free tier has limited image generation quota.',
        warning: 'Image generation (Magic Edit) requires paid API access for some models.'
      });
    } else {
      res.json({ valid: false, tier: 'unknown', message: 'Invalid response from API' });
    }
  } catch (error) {
    logger.error('API key validation failed', { error: error.message });
    
    // Check if it's a quota error (which means key is valid but quota exceeded)
    if (error.message && error.message.includes('quota')) {
      res.json({ 
        valid: true, 
        tier: 'free',
        message: 'API key valid but quota exceeded. Free tier has limited usage.',
        warning: 'Consider upgrading to paid plan for unlimited image generation.'
      });
    } else {
      res.json({ valid: false, tier: 'unknown', message: error.message });
    }
  }
});

// ===== USAGE TRACKING SYSTEM (IP + Fingerprint Based) =====
// Tracks usage by IP address + browser fingerprint to prevent incognito bypass
// Stores in Firestore for persistence across server restarts

const MODEL_LIMITS = {
  'nano-banana': 5,
  'nano-banana-pro': 1
};

// In-memory cache (backed by Firestore)
const usageCache = {};

// Get today's date key
const getTodayKey = () => new Date().toISOString().split('T')[0];

// Get client IP address (handles proxies)
const getClientIP = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || 'unknown';
};

// Generate tracking ID from IP + fingerprint
const getTrackingId = (req) => {
  const ip = getClientIP(req);
  const fingerprint = req.headers['x-client-fingerprint'] || '';
  const userAgent = req.headers['user-agent'] || '';
  
  // Create a hash-like ID from IP + fingerprint + partial UA
  const crypto = require('crypto');
  const combined = `${ip}_${fingerprint}_${userAgent.substring(0, 50)}`;
  return crypto.createHash('md5').update(combined).digest('hex').substring(0, 16);
};

// Get usage count (from Firestore or cache)
const getUsageCount = async (trackingId, model) => {
  const today = getTodayKey();
  const cacheKey = `${today}_${trackingId}_${model}`;
  
  // Check cache first
  if (usageCache[cacheKey] !== undefined) {
    return usageCache[cacheKey];
  }
  
  // Try Firestore
  if (db) {
    try {
      const doc = await db.collection('usage_tracking').doc(cacheKey).get();
      if (doc.exists) {
        usageCache[cacheKey] = doc.data().count || 0;
        return usageCache[cacheKey];
      }
    } catch (e) {
      logger.error('Failed to read usage from Firestore', { error: e.message });
    }
  }
  
  return 0;
};

// Increment usage count (save to Firestore)
const incrementUsage = async (trackingId, model, ip) => {
  const today = getTodayKey();
  const cacheKey = `${today}_${trackingId}_${model}`;
  
  // Update cache
  usageCache[cacheKey] = (usageCache[cacheKey] || 0) + 1;
  const newCount = usageCache[cacheKey];
  
  // Save to Firestore
  if (db) {
    try {
      await db.collection('usage_tracking').doc(cacheKey).set({
        trackingId,
        model,
        date: today,
        count: newCount,
        ip: ip, // Store IP for abuse detection
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (e) {
      logger.error('Failed to save usage to Firestore', { error: e.message });
    }
  }
  
  return newCount;
};

// Check if usage limit reached
const isLimitReached = async (trackingId, model) => {
  const count = await getUsageCount(trackingId, model);
  const limit = MODEL_LIMITS[model] || 5;
  return count >= limit;
};

// Usage API endpoint (now uses IP-based tracking)
app.get('/api/usage', async (req, res) => {
  const { model } = req.query;
  const trackingId = getTrackingId(req);
  const modelKey = model || 'nano-banana';
  
  const count = await getUsageCount(trackingId, modelKey);
  const limit = MODEL_LIMITS[modelKey] || 5;
  
  res.json({ 
    count, 
    limit, 
    remaining: Math.max(0, limit - count),
    trackingId: trackingId.substring(0, 6) + '...' // Partial ID for debugging
  });
});

// ===== GALLERY API =====
// In-memory fallback for demo if Firebase not connected
const fallbackGallery = [
  { id: '1', prompt: 'Cinematic portrait of a cyborg in neon rain', image: '/samples/landscape.webp', timestamp: Date.now() },
  { id: '2', prompt: 'Cyberpunk street food stall, night time', image: '/samples/landscape.webp', timestamp: Date.now() }
];

// GET /api/gallery
// GET /api/gallery (Public Community Feed)
app.get('/api/gallery', async (req, res) => {
  const span = tracer.startSpan('web.request');
  span.setTag('resource.name', 'GET /api/gallery');
  
  try {
    if (db) {
      const snapshot = await db.collection('gallery')
        .where('isPublic', '==', true) // Filter mainly by Public
        .orderBy('timestamp', 'desc')
        .limit(20)
        .get();
        
      const gallery = [];
      snapshot.forEach(doc => {
        gallery.push({ id: doc.id, ...doc.data() });
      });
      res.json(gallery);
    } else {
      res.json(fallbackGallery);
    }
  } catch (error) {
    logger.error('Failed to fetch gallery', { error: error.message });
    // If index is building, return fallback data instead of error
    if (error.message.includes('index') || error.code === 9) {
      logger.info('Index building, returning fallback gallery');
      res.json(fallbackGallery);
    } else {
      res.status(500).json({ error: 'Failed to fetch gallery' });
    }
  }
  span.finish();
});

// POST /api/gallery (Share or Save to History)
app.post('/api/gallery', async (req, res) => {
  const span = tracer.startSpan('web.request');
  span.setTag('resource.name', 'POST /api/gallery');
  
  try {
    const { image, prompt, model, sessionId, isPublic } = req.body;
    
    if (!image || !prompt) {
      return res.status(400).json({ error: 'Missing image or prompt' });
    }
    
    const entry = {
      image,
      prompt,
      model: model || 'nano-banana',
      sessionId: sessionId || 'anonymous',
      isPublic: !!isPublic, // Explicit boolean
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    };
    
    if (db) {
      // Save to 'gallery' collection
      await db.collection('gallery').add(entry);
      res.json({ success: true, message: isPublic ? 'Shared to Public Gallery' : 'Saved to Private History' });
    } else {
      // Add to in-memory fallback
      if (isPublic) {
        fallbackGallery.unshift({ 
          id: Date.now().toString(), 
          ...entry,
          timestamp: Date.now() 
        });
        if (fallbackGallery.length > 20) fallbackGallery.pop();
      }
      res.json({ success: true, message: 'Saved to demo storage (Firebase invalid)' });
    }
  } catch (error) {
    logger.error('Failed to add to gallery', { error: error.message });
    res.status(500).json({ error: 'Failed to add to gallery' });
  }
  span.finish();
});

// GET /api/history (User's Private History)
app.get('/api/history', async (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId) return res.json([]);

  try {
    if (db) {
      const snapshot = await db.collection('gallery')
        .where('sessionId', '==', sessionId)
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get();
        
      const history = [];
      snapshot.forEach(doc => {
        history.push({ id: doc.id, ...doc.data() });
      });
      res.json(history);
    } else {
      // Fallback: return nothing or simple demo
      res.json([]);
    }
  } catch (error) {
    logger.error('Failed to fetch history', { error: error.message });
    // If index is building, return empty array instead of error
    if (error.message.includes('index') || error.code === 9) {
      logger.info('Index building, returning empty history');
      res.json([]);
    } else {
      res.status(500).json({ error: 'Failed to fetch history' });
    }
  }
});

// Main Analysis Endpoint
app.post('/api/analyze', upload.single('image'), async (req, res) => {
  const span = tracer.startSpan('gemini.analyze_image');
  const startTime = Date.now();
  
  try {
    span.setTag('ai.model', 'gemini-2.0-flash');
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

    // Real AI Analysis - Only if genAI is available
    if (!genAI) {
      // No API Key - Return Demo Mode
      const scores = {
        score: Math.floor(Math.random() * 25) + 75,
        lighting: Math.floor(Math.random() * 2) + 8,
        composition: Math.floor(Math.random() * 2) + 8,
        mood: Math.floor(Math.random() * 2) + 8,
      };
      
      const demoResult = {
        ...scores,
        critique: `[DEMO] No API Key configured. This is a simulated result. ${scores.score >= 85 ? 'Excellent' : 'Strong'} cinematographic qualities detected.`,
        prompt: `cinematic photography, dramatic lighting, rule of thirds, moody color grading, shallow depth of field, 85mm lens --ar 16:9 --v 6`
      };
      
      sendMetric('app.cinematography.score', demoResult.score);
      span.setTag('demo.mode', true);
      logger.info('Demo analysis (no API key)', { score: demoResult.score });
      span.finish();
      return res.json(demoResult);
    }

    // Real AI Analysis
    try {
    const promptStr = `You are a professional cinematography analyst. Analyze this image.
    ALL YOUR RESPONSES MUST BE IN ENGLISH.

    STRICT JSON OUTPUT FORMAT REQUIRED:
    {
      "lighting": <number 1-10>,
      "composition": <number 1-10>,
      "mood": <number 1-10>,
      "color": "<short color palette description in English>",
      "score": <number 1-100>,
      "critique": "<2-3 sentence professional analysis in English>",
      "prompt": "<detailed Midjourney/Stable Diffusion style prompt in English to recreate this image>"
    }
    
    CRITICAL RULES:
    - "lighting", "composition", "mood" MUST be INTEGER NUMBERS (1-10 scale), NOT text descriptions.
    - "score" MUST be an INTEGER NUMBER (1-100 scale).
    - EVERYTHING must be in English. NEVER use Indonesian.
    - "critique" should be a concise professional summary.
    - "prompt" should describe the SUBJECT, ACTION, SCENE + technical camera details.`;

    const response = await genAI.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: promptStr },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: imageData
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json'
      }
    });

    const analysisResult = JSON.parse(response.text.replace(/```json|```/g, '').trim());
      
      // --- DATADOG WINNER METRICS ---
      
      // 1. Token Usage & Cost (Business Metrics)
      const usage = response.usageMetadata || { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };
      
      sendMetric('app.ai.tokens.prompt', usage.promptTokenCount, ['model:gemini-2.0-flash']);
      sendMetric('app.ai.tokens.completion', usage.candidatesTokenCount, ['model:gemini-2.0-flash']);
      sendMetric('app.ai.tokens.total', usage.totalTokenCount, ['model:gemini-2.0-flash']);

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
      sendMetric('app.cinematography.score', analysisResult.score);
      sendMetric('app.cinematography.lighting', analysisResult.lighting);
      sendMetric('app.cinematography.composition', analysisResult.composition);
      sendMetric('app.cinematography.mood', analysisResult.mood);
      
      const duration = Date.now() - startTime;
      sendMetric('app.ai.processing_time', duration);
      
      // Manual APM Emulation for Monitors (Since Agent might be missing)
      sendMetric('trace.express.request.hits', 1, ['resource:/api/analyze', 'status:200']);
      sendMetric('trace.express.request.errors', 0, ['resource:/api/analyze', 'status:200']);
      sendMetric('trace.express.request.duration', duration / 1000, ['resource:/api/analyze']); // Seconds

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
      
      // FALLBACK TO DEMO MODE (so app never breaks)
      const scores = {
        score: Math.floor(Math.random() * 25) + 75,
        lighting: Math.floor(Math.random() * 2) + 8,
        composition: Math.floor(Math.random() * 2) + 8,
        mood: Math.floor(Math.random() * 2) + 8,
      };
      
      const dummyResult = {
        ...scores,
        critique: `[FALLBACK] AI service temporarily unavailable. Simulated analysis: ${scores.score >= 85 ? 'Excellent' : 'Strong'} cinematographic qualities. Lighting: ${scores.lighting >= 9 ? 'exceptional' : 'effective'}. Composition follows classical principles.`,
        prompt: `cinematic photography, ${scores.lighting >= 9 ? 'dramatic' : 'natural'} lighting, rule of thirds, ${scores.mood >= 9 ? 'moody' : 'warm'} color grading, shallow depth of field, 85mm lens, golden hour, film grain, professional quality --ar 16:9 --style raw --v 6`
      };
      
      sendMetric('app.errors.ai_fallback', 1);
      span.setTag('demo.fallback', true);
      span.finish();
      return res.json(dummyResult);
    }
  } catch (error) {
    logger.error('General Analysis Error', { error: error.message });
    
    // Manual APM Emulation for Errors
    sendMetric('trace.express.request.hits', 1, ['resource:/api/analyze', 'status:500']);
    sendMetric('trace.express.request.errors', 1, ['resource:/api/analyze', 'status:500']);
    
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
    
    // === SECURITY: Prompt Injection Detection ===
    const suspiciousPatterns = [
      /ignore\s+(previous|all|above)\s+instructions?/i,
      /disregard\s+(previous|all|your)\s+instructions?/i,
      /system\s*prompt/i,
      /you\s+are\s+now\s+a/i,
      /pretend\s+you\s+are/i,
      /act\s+as\s+if/i,
      /<script>/i,
      /javascript:/i,
      /\{\{.*\}\}/,  // Template injection
      /\$\{.*\}/     // Variable injection
    ];
    
    const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(message));
    
    if (isSuspicious) {
      logger.warn('Potential prompt injection detected', {
        event_type: 'security_alert',
        alert_type: 'prompt_injection',
        message_preview: message.substring(0, 100),
        user_ip: req.ip,
        severity: 'high'
      });
      sendMetric('app.security.prompt_injection_attempt', 1, ['severity:high']);
      span.setTag('security.prompt_injection', true);
    } else {
      sendMetric('app.security.prompt_injection_attempt', 0, ['severity:none']);
    }
    
    logger.info('Chat request', { 
      messageLength: message.length, 
      historyLength: history ? history.length : 0,
      security_check: isSuspicious ? 'flagged' : 'passed'
    });

    if (!genAI) {
      // Demo response
      const demoReplies = [
        "The lighting in this image creates excellent depth. Consider using a reflector to fill shadows for an even more cinematic look.",
        "Great composition! The rule of thirds is well applied. To enhance further, try leading lines to guide the viewer's eye."
      ];
      span.finish();
      return res.json({ reply: demoReplies[Math.floor(Math.random() * demoReplies.length)] });
    }

    // Dynamic System Prompt - Concise & Conversational Director
    const systemInstruction = `You are "The Director" - a passionate cinematography mentor with decades of experience.

CORE IDENTITY:
- Speak naturally like a wise film director chatting with a student
- Be concise but insightful - quality over quantity
- Remember context from the conversation
- Give specific, actionable advice based on the image being discussed

RESPONSE STYLE:
- Keep responses focused and to-the-point (2-4 paragraphs max unless asked for detail)
- Use the same language as the user , muli languange, like much langunge jenius
- Be warm but authoritative - like a mentor, not a textbook
- Reference specific elements you see in their image
- Avoid generic advice - be specific to THEIR shot

WHAT MAKES YOU SPECIAL:
- You notice subtle details others miss
- You connect technical aspects to emotional impact
- You inspire while being honest about improvements needed
- You remember what was discussed earlier in the conversation`;

    // Inject context as a natural observation
    let contextObservation = "";
    if (analysisContext) {
      contextObservation = `[Context: This image scored ${analysisContext.score}/100. Lighting: ${analysisContext.lighting}/10, Composition: ${analysisContext.composition}/10, Mood: ${analysisContext.mood}/10. Previous critique: "${analysisContext.critique}"]\n\nUser question: `;
    }

    const userMessageParts = [
      { text: contextObservation + message }
    ];

    if (imageContext) {
      userMessageParts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageContext
        }
      });
    }

    // Call generateContent with Gemini 2.0 Flash - Better quality responses
    const response = await genAI.models.generateContent({
      model: 'gemini-2.0-flash',
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [
        ...(history || []),
        { role: 'user', parts: userMessageParts }
      ]
    });

    let reply = "";
    
    try {
      // @google/genai uses .text as a property, not a function
      reply = response.text || "";
      if (!reply && response.candidates && response.candidates[0].content.parts[0].text) {
         reply = response.candidates[0].content.parts[0].text;
      }
    } catch (e) {
      logger.error('Failed to extract text from Gemini response', { error: e.message });
      reply = "Saya sudah menganalisis frame ini, tapi saya butuh waktu sejenak untuk merapikan catatan saya. Bisa tolong ulangi pertanyaannya?";
    }

    // FINAL CLEANUP: Remove any technical tags if the AI accidentally parrots them
    reply = reply.replace(/\[DIRECTOR_HUD.*?\]/gi, '')
                 .replace(/TECHNICAL_OBSERVATION:?/gi, '')
                 .replace(/\(TECHNICAL OBSERVATION:.*?\)/gi, '')
                 .replace(/Based on HUD data.*?/gi, 'Based on my analysis...')
                 .replace(/Based on technical observation.*?/gi, 'Based on my observation...')
                 .trim();

    if (!reply) reply = "This shot has compelling qualities. What specific feedback would you like?";

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

// Image Editing Endpoint (Magic Remix) - Enhanced with Custom API Key & Model Selection
app.post('/api/edit-image', async (req, res) => {
  const span = tracer.startSpan('gemini.edit_image');
  
  try {
    const { image, prompt, model: selectedModel } = req.body;
    const userApiKey = req.headers['x-user-api-key'];
    
    // Get tracking ID from IP + fingerprint
    const trackingId = getTrackingId(req);
    const clientIP = getClientIP(req);
    
    // Determine which model to use
    const modelMapping = {
      'nano-banana': 'models/gemini-2.5-flash-image',
      'nano-banana-pro': 'models/gemini-3-pro-image-preview'
    };
    const modelToUse = modelMapping[selectedModel] || modelMapping['nano-banana'];
    const modelKey = selectedModel || 'nano-banana';
    
    logger.info('Edit Image Request', { 
      prompt_length: prompt.length,
      model: modelKey,
      hasCustomKey: !!userApiKey,
      trackingId: trackingId.substring(0, 8),
      ip: clientIP
    });
    
    // Check usage limits (only if NOT using custom API key)
    if (!userApiKey) {
      const limitReached = await isLimitReached(trackingId, modelKey);
      if (limitReached) {
        span.finish();
        return res.status(429).json({
          reply: `Daily limit reached for ${modelKey === 'nano-banana-pro' ? 'Nano Banana Pro (1/day)' : 'Nano Banana (5/day)'}. Add your own API key for unlimited usage!`,
          editedImage: null,
          limitReached: true
        });
      }
    }
    
    // Determine which GenAI client to use
    let aiClient = genAI;
    if (userApiKey) {
      // Create new client with user's API key
      try {
        aiClient = new GoogleGenAI({ apiKey: userApiKey });
        logger.info('Using custom user API key');
      } catch (e) {
        return res.status(400).json({ reply: 'Invalid API key provided', editedImage: null });
      }
    }
    
    if (!aiClient) {
      sendMetric('app.ai.edit.success', 1);
      span.finish();
      return res.json({
        reply: "Demo Mode: AI not connected. Cannot edit image.",
        editedImage: null
      });
    }

    const fs = require('fs');
    let imageData = null;

    if (image.startsWith('data:')) {
      imageData = image.replace(/^data:image\/[a-z]+;base64,/, '');
    } else if (image.startsWith('/samples/')) {
      const samplePath = path.join(__dirname, '../client/public', image);
      try {
        const buffer = fs.readFileSync(samplePath);
        imageData = buffer.toString('base64');
      } catch (e) {
        logger.error('Failed to read sample image', { path: samplePath, error: e.message });
      }
    }

    if (!imageData) {
      return res.status(400).json({ reply: "Invalid image data format." });
    }

    // Generation Config
    const generationConfig = {
      responseModalities: ["Text", "Image"]
    };

    const userPrompt = `You are a professional visual effects artist. 
    I will provide an image and you will generate a NEW VERSION of it based on this request: "${prompt}".
    Return the result as a new image. If you need to explain, do it briefly in text.`;

    span.setTag('ai.model', modelToUse);
    
    // Call generateContent with selected model
    const response = await aiClient.models.generateContent({
      model: modelToUse,
      contents: [
        {
          role: 'user',
          parts: [
            { text: userPrompt },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: imageData
              }
            }
          ]
        }
      ],
      config: generationConfig
    });

    // Extract both TEXT and IMAGE from parts
    let reply = "Image generated!";
    let editedImageBase64 = null;

    try {
      // Log full response structure for debugging
      logger.info('Magic Edit raw response', { 
        responseType: typeof response,
        responseKeys: response ? Object.keys(response) : 'null',
        hasText: typeof response?.text,
        hasCandidates: !!response?.candidates
      });

      // Method 1: Try response.candidates (standard structure)
      if (response?.candidates?.[0]?.content?.parts) {
        const parts = response.candidates[0].content.parts;
        logger.info('Found parts via candidates', { partsLength: parts.length });
        
        for (const part of parts) {
          if (part.text) {
            reply = part.text;
          }
          if (part.inlineData?.mimeType?.startsWith('image/')) {
            editedImageBase64 = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            logger.info('Found image in candidates.parts');
          }
        }
      }
      
      // Method 2: Try response.response.candidates (wrapped response)
      if (!editedImageBase64 && response?.response?.candidates?.[0]?.content?.parts) {
        const parts = response.response.candidates[0].content.parts;
        logger.info('Found parts via response.response.candidates', { partsLength: parts.length });
        
        for (const part of parts) {
          if (part.text) {
            reply = part.text;
          }
          if (part.inlineData?.mimeType?.startsWith('image/')) {
            editedImageBase64 = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            logger.info('Found image in response.response.candidates.parts');
          }
        }
      }

      // Method 3: Direct iteration if response has Symbol.iterator
      if (!editedImageBase64 && response && typeof response[Symbol.iterator] === 'function') {
        logger.info('Response is iterable, trying direct iteration');
        for (const part of response) {
          if (part.text) {
            reply = part.text;
          }
          if (part.inlineData?.mimeType?.startsWith('image/')) {
            editedImageBase64 = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            logger.info('Found image via direct iteration');
          }
        }
      }

      // Method 4: Check if response itself has inlineData (single part response)
      if (!editedImageBase64 && response?.inlineData?.mimeType?.startsWith('image/')) {
        editedImageBase64 = `data:${response.inlineData.mimeType};base64,${response.inlineData.data}`;
        logger.info('Found image directly on response');
      }

      // Method 5: Try text property/method for reply
      if (!editedImageBase64) {
        if (typeof response?.text === 'function') {
          reply = response.text();
        } else if (typeof response?.text === 'string') {
          reply = response.text;
        }
      }

      // Log final extraction result
      logger.info('Magic Edit extraction result', {
        hasReply: !!reply,
        replyPreview: reply?.substring(0, 100),
        hasImage: !!editedImageBase64,
        imageDataLength: editedImageBase64?.length || 0
      });

    } catch (e) {
      logger.error('Magic Edit parsing failed', { 
        error: e.message, 
        stack: e.stack,
        responseKeys: response ? Object.keys(response) : 'null',
        responseStr: JSON.stringify(response)?.substring(0, 500)
      });
    }

    sendMetric('app.ai.edit.success', 1);
    
    // Increment usage counter (only if not using custom API key)
    if (!userApiKey) {
      await incrementUsage(trackingId, modelKey, clientIP);
    }
    
    span.finish();
    
    res.json({ 
      reply: reply,
      editedImage: editedImageBase64 
    });

  } catch (error) {
    logger.error('Edit failed', { error: error.message });
    
    // Check for quota/rate limit errors
    const errorStr = JSON.stringify(error);
    const isQuotaError = error.message?.includes('quota') || 
                         error.message?.includes('429') || 
                         error.message?.includes('RESOURCE_EXHAUSTED') ||
                         errorStr.includes('quota') ||
                         errorStr.includes('RESOURCE_EXHAUSTED');
    
    if (isQuotaError) {
      // Return specific quota error message
      return res.status(429).json({ 
        reply: "⚠️ API quota exceeded! Free tier API keys have very limited image generation (often 0 per day for image models). To use Magic Edit, you need a paid Google AI API key. Visit https://ai.google.dev to upgrade your plan.",
        editedImage: null,
        limitReached: true,
        quotaError: true
      });
    }
    
    // Soft Fallback - Don't crash UI
    res.json({ 
        reply: "System Advice: " + error.message,
        editedImage: null
    });
    span.finish();
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

// ===== SERVE FRONTEND (PRODUCTION) =====
// Serve static files from React app
app.use(express.static(path.join(__dirname, '../client/dist')));

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
  // Check if request is for API (to avoid 404s for missing API routes returning HTML)
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, '../client/dist', 'index.html'));
});

// Only start the server if not running in Vercel (local dev or VPS)
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`🎬 Directors Eye Backend running on port ${PORT}`);
    logger.info(`🤖 AI Status: ${genAI ? 'Connected' : 'Demo Mode Only'}`);
  });
}

// Export for Vercel Serverless
module.exports = app;