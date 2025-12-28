const { GoogleGenAI } = require('@google/genai');
const dotenv = require('dotenv');
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

async function testResponse() {
    const genAI = new GoogleGenAI({ apiKey });
    try {
        console.log("Testing text generation...");
        const response = await genAI.models.generateContent({
            model: 'gemini-2.5-flash-lite',
            contents: [{ role: 'user', parts: [{ text: 'Say hello' }] }]
        });
        console.log("Text Response Structure:", JSON.stringify(response, null, 2));
        
        // Check if .text() helper exists (like in @google/generative-ai)
        if (typeof response.text === 'function') {
            console.log("Helper .text() exists: ", response.text());
        } else if (response.text) {
             console.log("Property .text exists: ", response.text);
        } else {
             console.log("No simple .text property or method.");
        }
        
    } catch (error) {
        console.error("Test Error:", error.message);
    }
}

testResponse();
