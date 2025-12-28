
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config({ path: '../.env' });

async function discover() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const modelName = 'gemini-2.5-flash-lite';
    
    console.log(`Testing model: ${modelName}`);

    const hosts = [
        { name: 'AI Studio', host: 'generativelanguage.googleapis.com' },
        { name: 'Vertex AI', host: 'aiplatform.googleapis.com' }
    ];

    for (const h of hosts) {
        console.log(`\n--- Testing via ${h.name} (${h.host}) ---`);
        try {
            // In @google/genai, passing apiKey usually checks ADC if host isn't specific
            // Let's try to configure it strictly.
            // Documentation indicates we might need to specify the full URL or use specific flags.
            const client = new GoogleGenAI({
                apiKey: apiKey,
                baseUrl: `https://${h.host}`
            });

            const res = await client.models.generateContent({
                model: modelName,
                contents: [{ role: 'user', parts: [{ text: 'say hi' }] }]
            });
            console.log(`✅ SUCCESS: Model is reachable via ${h.name}`);
        } catch (e) {
            console.log(`❌ FAILED on ${h.name}: ${e.message}`);
        }
    }
}

discover();
