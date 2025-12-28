require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testApi() {
  const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  console.log('Testing with API KEY:', API_KEY ? 'Present (Hidden)' : 'Missing');

  if (!API_KEY) {
    console.error('❌ No API Key found in env');
    return;
  }

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    // Use the model to list models (hacky but SDK dependent) or just try a different known model name
    // Actually, the SDK doesn't expose listModels directly on the main class easily in some versions,
    // but typically it's specific. Let's try 'gemini-pro' as a fallback test first, 
    // AND try to use the model.
    
    console.log('🔄 Retrying with "gemini-pro"...');
    const modelPro = genAI.getGenerativeModel({ model: 'gemini-pro' });
    try {
        const resultPro = await modelPro.generateContent('Hello');
        const responsePro = await resultPro.response;
        console.log('✅ "gemini-pro" worked:', responsePro.text());
    } catch(e) {
        console.error('❌ "gemini-pro" failed:', e.message);
    }

    console.log('🔄 Retrying with "gemini-1.0-pro"...');
    const model10 = genAI.getGenerativeModel({ model: 'gemini-1.0-pro' });
    try {
        const result10 = await model10.generateContent('Hello');
        const response10 = await result10.response;
        console.log('✅ "gemini-1.0-pro" worked:', response10.text());
    } catch(e) {
        console.error('❌ "gemini-1.0-pro" failed:', e.message);
    }

  } catch (error) {
    console.error('❌ API Test Failed:', error.message);
    if (error.response) {
      console.error('Error Details:', JSON.stringify(error.response, null, 2));
    }
  }
}

testApi();
