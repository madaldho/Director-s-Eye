const { GoogleGenAI } = require('@google/genai');
const dotenv = require('dotenv');
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

async function listModels() {
    const genAI = new GoogleGenAI({ apiKey });
    try {
        const response = await genAI.models.list();
        console.log("Available Models:", JSON.stringify(response, null, 2));
    } catch (error) {
        console.error("Error listing models:", error.message);
    }
}

listModels();
