require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function listModels() {
  const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!API_KEY) {
    console.log('No API KEY found');
    return;
  }
  
  const genAI = new GoogleGenerativeAI(API_KEY);
  
  try {
    // Note: older versions of the SDK might not expose the model list easily via the main class,
    // but let's try accessing the model directly or just testing a known 'safe' model like 'gemini-pro' 
    // again with a slightly different config if needed. 
    // However, the best way to debug "404 model not found" is to try the most standard ones.
    
    // We will try to fetch a specific model to confirm access.
    // There is no public listModels() on the client instance in the simplified SDK reference 
    // without hitting the REST API directly, but we can try to use a specific model to see if it works.
    
    // Testing newer models appropriate for late 2025
    const candidates = [
        'gemini-2.0-flash',
        'gemini-2.0-flash-exp',
        'gemini-1.5-flash-002',
        'gemini-1.5-pro-002',
        'gemini-1.5-flash-8b',
        'gemini-pro-1.5' // sometimes aliased
    ];

    console.log('Testing specific models...');

    for (const modelName of candidates) {
        process.stdout.write(`Checking ${modelName}... `);
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Test");
            const response = await result.response;
            console.log(`✅ Success!`);
            break; // Stop at first working one
        } catch (e) {
            console.log(`❌ Failed: ${e.message}`); // Full error
        }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

listModels();
