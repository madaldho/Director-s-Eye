const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);

async function listModels() {
  try {
    const models = await genAI.getGenerativeModel({ model: "gemini-1.5-flash" }).getGenerativeModelResponse; 
    // Actually the SDK logic is different, let's just use the list endpoint if possible, 
    // or try to instantiate the requested model.
    
    console.log('Checking model availability...');
    
    const candidates = [
        'gemini-2.0-flash-exp', 
        'gemini-2.0-flash', 
        'gemini-1.5-flash',
        'gemini-3.0-flash'
    ];

    for (const modelName of candidates) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Hello");
            console.log(`✅ ${modelName}: AVAILABLE`);
        } catch (e) {
            console.log(`❌ ${modelName}: UNAVAILABLE (${e.message.split(' ')[0]})`);
        }
    }

  } catch (error) {
    console.error("Error:", error);
  }
}

listModels();
