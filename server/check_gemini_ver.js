const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: '../.env' }); // Load from parent root

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

if (!apiKey) {
    console.error("❌ NO API KEY FOUND");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
  console.log('🤖 Checking Gemini Model Versions...');
  
  const candidates = [
      'gemini-3.0-flash',        // What user wants
      'gemini-2.0-flash',        // What I used
      'gemini-2.0-flash-exp',    // Experimental
      'gemini-1.5-flash',        // Stable
      'gemini-1.5-pro'
  ];

  for (const modelName of candidates) {
      process.stdout.write(`   👉 Checking ${modelName}... `);
      try {
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent("Test.");
          console.log(`✅ AVAILABLE`);
      } catch (e) {
          const msg = e.message || 'Unknown Error';
          if (msg.includes('404') || msg.includes('not found')) {
              console.log(`❌ NOT FOUND`);
          } else {
              console.log(`⚠️  ERROR: ${msg.substring(0, 50)}...`);
          }
      }
  }
}

listModels();
