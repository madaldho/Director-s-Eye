
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function test() {
  const key = process.argv[2];
  console.log("Testing Key:", key ? key.substring(0, 8) + "..." : "NONE");
  
  if (!key) {
      console.error("No key provided");
      return;
  }

  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    console.log("Model initialized. Sending test prompt...");
    const result = await model.generateContent("Hello");
    console.log("Success! Response:", result.response.text());
  } catch (e) {
    console.error("FAILED:", e.message);
    if (e.response) {
        console.error("Error Details:", JSON.stringify(e.response, null, 2));
    }
  }
}

test();
