// CRITICAL: Datadog Tracer MUST be initialized first
const tracer = require('dd-trace').init({
  logInjection: true,
  service: 'directors-eye-backend',
  env: 'production',
  version: 'v1.0'
});

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const winston = require('winston');
const { VertexAI } = require('@google-cloud/vertexai');

const app = express();
const PORT = process.env.PORT || 5000;

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
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Initialize Vertex AI
const vertex_ai = new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT || 'hackathon-datadog-2025',
  location: 'us-central1'
});

const model = 'gemini-1.5-flash-002';

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  logger.info('Health check requested');
  res.json({ 
    status: 'healthy', 
    service: 'directors-eye-backend',
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
      traceId: span.context().toTraceId(),
      spanId: span.context().toSpanId()
    });

    let imageData;
    
    // Handle both file upload and base64
    if (req.file) {
      imageData = req.file.buffer.toString('base64');
    } else if (req.body.image) {
      imageData = req.body.image.replace(/^data:image\/[a-z]+;base64,/, '');
    } else {
      throw new Error('No image provided');
    }

    // Demo Mode - Return dummy data
    if (req.body.demoMode === 'true') {
      const dummyResult = {
        score: Math.floor(Math.random() * 40) + 60, // 60-100
        lighting: Math.floor(Math.random() * 3) + 8, // 8-10
        composition: Math.floor(Math.random() * 3) + 7, // 7-10
        mood: Math.floor(Math.random() * 4) + 7, // 7-10
        critique: "This is a demo analysis. The composition shows strong rule of thirds application with excellent natural lighting. The color grading creates a cinematic mood that draws the viewer's attention effectively.",
        prompt: "cinematic photography, professional lighting, rule of thirds composition, warm color grading, shallow depth of field, 85mm lens, golden hour lighting --ar 16:9 --style raw"
      };
      
      // Send custom metric to Datadog
      tracer.dogstatsd.gauge('app.cinematography.score', dummyResult.score, {
        service: 'directors-eye-backend',
        env: 'production'
      });
      
      span.setTag('cinematography.score', dummyResult.score);
      span.setTag('demo.mode', true);
      
      logger.info('Demo analysis completed', { 
        score: dummyResult.score,
        demoMode: true 
      });
      
      span.finish();
      return res.json(dummyResult);
    }

    // Real Gemini Analysis
    const generativeModel = vertex_ai.preview.getGenerativeModel({
      model: model,
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.4,
        topP: 1,
        topK: 32
      }
    });

    const prompt = `Analyze this image for cinematographic quality. Return ONLY a valid JSON object with this exact structure:
{
  "score": <number 0-100>,
  "lighting": <number 0-10>,
  "composition": <number 0-10>, 
  "mood": <number 0-10>,
  "critique": "<detailed analysis string>",
  "prompt": "<Stable Diffusion prompt to recreate this style>"
}`;

    const imagePart = {
      inlineData: {
        data: imageData,
        mimeType: 'image/jpeg'
      }
    };

    const request = {
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          imagePart
        ]
      }]
    };

    const response = await generativeModel.generateContent(request);
    const responseText = response.response.candidates[0].content.parts[0].text;
    
    // Parse JSON response
    const cleanJson = responseText.replace(/```json\n?|\n?```/g, '').trim();
    const result = JSON.parse(cleanJson);

    // Send custom metric to Datadog
    tracer.dogstatsd.gauge('app.cinematography.score', result.score, {
      service: 'directors-eye-backend',
      env: 'production'
    });

    span.setTag('cinematography.score', result.score);
    span.setTag('ai.response.tokens', responseText.length);
    
    const duration = Date.now() - startTime;
    tracer.dogstatsd.histogram('app.ai.processing_time', duration, {
      service: 'directors-eye-backend'
    });

    logger.info('Analysis completed successfully', { 
      score: result.score,
      processingTime: duration,
      traceId: span.context().toTraceId()
    });

    span.finish();
    res.json(result);

  } catch (error) {
    span.setTag('error', true);
    span.setTag('error.type', error.name);
    span.setTag('error.message', error.message);
    
    logger.error('Analysis failed', { 
      error: error.message,
      stack: error.stack,
      traceId: span.context().toTraceId()
    });

    tracer.dogstatsd.increment('app.errors.total', 1, {
      service: 'directors-eye-backend',
      error_type: 'ai_processing_error'
    });

    span.finish();
    res.status(500).json({ 
      error: 'Analysis failed', 
      message: error.message 
    });
  }
});

// Chat with Director Endpoint
app.post('/api/chat', async (req, res) => {
  const span = tracer.startSpan('gemini.chat');
  
  try {
    const { message, imageContext } = req.body;
    
    span.setTag('ai.model', 'gemini-1.5-flash');
    span.setTag('chat.message_length', message.length);
    
    logger.info('Chat request received', { 
      messageLength: message.length,
      hasImageContext: !!imageContext
    });

    const generativeModel = vertex_ai.preview.getGenerativeModel({
      model: model,
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.7,
        topP: 1
      }
    });

    let prompt = `You are a professional cinematographer and director. Answer this question about the image: ${message}`;
    
    const parts = [{ text: prompt }];
    
    if (imageContext) {
      parts.push({
        inlineData: {
          data: imageContext,
          mimeType: 'image/jpeg'
        }
      });
    }

    const request = {
      contents: [{
        role: 'user',
        parts: parts
      }]
    };

    const response = await generativeModel.generateContent(request);
    const reply = response.response.candidates[0].content.parts[0].text;

    logger.info('Chat response generated', { 
      responseLength: reply.length 
    });

    span.finish();
    res.json({ reply });

  } catch (error) {
    span.setTag('error', true);
    span.setTag('error.message', error.message);
    
    logger.error('Chat failed', { 
      error: error.message 
    });

    span.finish();
    res.status(500).json({ 
      error: 'Chat failed', 
      message: error.message 
    });
  }
});

// CRITICAL: Simulate Error Endpoint (Required for Demo)
app.post('/api/simulate-error', (req, res) => {
  const span = tracer.startSpan('system.simulate_error');
  
  logger.error('CRITICAL SYSTEM FAILURE - Simulated for demo', {
    severity: 'critical',
    service: 'directors-eye-backend',
    error_type: 'simulated_failure'
  });

  tracer.dogstatsd.increment('app.errors.total', 1, {
    service: 'directors-eye-backend',
    error_type: 'critical_system_failure'
  });

  span.setTag('error', true);
  span.setTag('error.type', 'simulated_failure');
  span.setTag('demo.incident', true);
  
  span.finish();
  
  res.status(500).json({ 
    error: 'CRITICAL SYSTEM FAILURE',
    message: 'This is a simulated error for Datadog incident management demo',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  logger.info(`Directors Eye Backend running on port ${PORT}`);
  console.log(`🎬 Directors Eye Backend running on port ${PORT}`);
});