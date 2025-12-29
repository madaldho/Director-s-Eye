const { GoogleGenAI } = require('@google/genai');
require('dotenv').config({ path: '../.env' });

async function test() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const genAI = new GoogleGenAI({ apiKey });
  
  console.log('genAI keys:', Object.keys(genAI));
  if (genAI.models) {
    console.log('genAI.models keys:', Object.keys(genAI.models));
  }
}

test();
