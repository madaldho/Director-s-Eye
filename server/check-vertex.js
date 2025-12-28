const { VertexAI } = require('@google-cloud/vertexai');
require('dotenv').config();

// Load credentials from the root/server directory if needed, 
// but typically GOOGLE_APPLICATION_CREDENTIALS env var handles it.
// server/.env has GOOGLE_APPLICATION_CREDENTIALS=./credentials.json
// We need to make sure that path is correct relative to where we run the script.

async function testVertex() {
  console.log('🧪 Testing Vertex AI Integration...');
  
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'hackathon-datadog-2025';
  const location = 'us-central1'; // Common location
  
  console.log(`📌 Project: ${projectId}, Location: ${location}`);
  console.log(`🔑 Credentials Env: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);

  try {
    const vertex_ai = new VertexAI({project: projectId, location: location});
    const model = 'gemini-1.5-flash-001'; // Vertex model names are slightly different sometimes
    
    const generativeModel = vertex_ai.preview.getGenerativeModel({
      model: model,
      generationConfig: {
        'maxOutputTokens': 2048,
        'temperature': 0.9,
        'topP': 1
      },
      safetySettings: [],
    });

    const prompt = 'Hello, answer with "Vertex AI is working!"';
    
    console.log(`📤 Sending prompt to ${model}...`);
    const result = await generativeModel.generateContent(prompt);
    
    const response = result.response;
    console.log('✅ Response:', JSON.stringify(response, null, 2));

  } catch (err) {
    console.error('❌ Vertex AI Failed:', err.message);
    if (err.stack) console.error(err.stack);
  }
}

testVertex();
