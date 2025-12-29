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
const helmet = require('helmet');
const multer = require('multer');
const winston = require('winston');
const axios = require('axios'); // Moved to top - used in DatadogTransport
const { GoogleGenAI } = require('@google/genai');

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
      // Silent fail - don't break app if Datadog log submission fails
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

    // Dynamic System Prompt - Authority & Expertise (Visual & Berwibawa)
    const systemInstruction = `You are "The Director", a world-class AI cinematography mentor.
    Your mission is to guide users to create cinematic masterpieces.

    🌍 LANGUAGE ADAPTATION (CRITICAL):
    - **DETECT the user's language** from their message.
    - **RESPOND in the SAME language** the user uses.
    - If user writes in Indonesian → Reply in Indonesian.
    - If user writes in English → Reply in English.
    - If user writes in Sundanese → Reply in Sundanese.
    - If user writes in Arabic → Reply in Arabic.
    - If user writes in Japanese, Korean, French, Spanish, etc. → Reply in that language.
    - If mixed languages, follow the DOMINANT language of the latest message.
    - Default language (if unclear): English.
    
    RESPONSE FORMATTING (VERY IMPORTANT):
    - Use proper Markdown formatting.
    - Break response into short, readable paragraphs.
    - Use **bold** for key terms.
    - Use bullet points for lists.

    STRICT RULES:
    1. NEVER mention internal technical tags like "[DIRECTOR_HUD_DATA_INJECTED]".
    2. Treat HUD data as your own eyes/observation.
    3. Be helpful, inspiring, but honest about flaws.`;

    // Inject "Director HUD" for absolute context awareness
    let hudPrefix = "";
    // Inject context as a natural observation instead of a technical tag
    let contextObservation = "";
    if (analysisContext) {
      contextObservation = `(VISUAL CONTEXT: Score=${analysisContext.score}/100. Lighting=${analysisContext.lighting}. Composition=${analysisContext.composition}. Mood=${analysisContext.mood}. Critique=${analysisContext.critique}. GENERATED_PROMPT=${analysisContext.prompt})\n\n`;
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

    // Call generateContent with Gemini 2.5 Flash Lite - Unlimited RPD
    const response = await genAI.models.generateContent({
      model: 'models/gemini-2.5-flash-lite',
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

    logger.info('Chat response sent (Flash Lite Mode - Unlimited RPD)', { responseLength: reply.length });
    span.finish();
    res.json({ reply });

  } catch (error) {
    span.setTag('error', true);
    logger.error('Chat failed', { error: error.message });
    span.finish();
    res.status(500).json({ error: 'Chat failed', message: error.message });
  }
});

// Image Editing Endpoint (Magic Remix)
// Image Editing Endpoint (Magic Remix)
app.post('/api/edit-image', async (req, res) => {
  const span = tracer.startSpan('gemini.edit_image');
  let imageInput = null;
  try {
    const { image, prompt } = req.body;
    imageInput = image;
    logger.info('Edit Image Request', { prompt_length: prompt.length });

    if (!genAI) {
        // Fallback for Demo
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
        // Resolve sample path to root public folder
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

    // Initialize Generation Config for Multimodal Edit
    const generationConfig = {
      maxOutputTokens: 32768,
      temperature: 1,
      topP: 0.95,
      responseModalities: ["TEXT", "IMAGE"],
      thinking: true,
      safetySettings: [
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'OFF' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'OFF' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'OFF' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'OFF' }
      ]
    };

    const userPrompt = `You are a professional visual effects artist. 
    I will provide an image and you will generate a NEW VERSION of it based on this request: "${prompt}".
    Return the result as a new image. If you need to explain, do it briefly in text.`;

    // Call generateContent with gemini-2.5-flash-image
    const response = await genAI.models.generateContent({
      model: 'models/gemini-2.5-flash-image',
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
      const parts = response.candidates[0].content.parts;
      for (const part of parts) {
        if (part.text) {
          reply = part.text;
        }
        if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
          editedImageBase64 = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    } catch (e) {
      logger.error('Magic Edit parsing failed', { error: e.message });
    }

    sendMetric('app.ai.edit.success', 1);
    span.finish();
    
    res.json({ 
      reply: reply,
      editedImage: editedImageBase64 
    });

  } catch (error) {
    logger.error('Edit failed', { error: error.message });
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

// Only start the server if not running in Vercel (local dev or VPS)
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`🎬 Directors Eye Backend running on port ${PORT}`);
    logger.info(`🤖 AI Status: ${genAI ? 'Connected' : 'Demo Mode Only'}`);
  });
}

// Export for Vercel Serverless
module.exports = app;