const axios = require('axios');

async function testChatMemory() {
  console.log('🧪 Testing Chat Memory...');
  
  const history = [];
  const apiUrl = 'http://localhost:4567/api/chat';

  // 1. First Message: State my name
  console.log('\n1️⃣ User: "Hi, my name is Antigravity."');
  try {
    const res1 = await axios.post(apiUrl, {
      message: "Hi, my name is Antigravity.",
      history: [] // Empty history initially
    });
    console.log(`🤖 AI: "${res1.data.reply}"`);
    
    // Update history
    history.push({ role: 'user', parts: [{ text: "Hi, my name is Antigravity." }] });
    history.push({ role: 'model', parts: [{ text: res1.data.reply }] });

  } catch (e) {
    console.error('❌ Error Step 1:', e.message);
    process.exit(1);
  }

  // 2. Second Message: Ask for my name
  console.log('\n2️⃣ User: "What is my name?" (Testing Memory)');
  try {
    const res2 = await axios.post(apiUrl, {
      message: "What is my name?",
      history: history // Sending history!
    });
    console.log(`🤖 AI: "${res2.data.reply}"`);
    
    if (res2.data.reply.includes('Antigravity')) {
      console.log('✅ MEMORY WORKING: AI remembered the name.');
    } else {
      console.error('❌ MEMORY FAILED: AI did not mention the name.');
    }

  } catch (e) {
    console.error('❌ Error Step 2:', e.message);
  }
}

testChatMemory();
