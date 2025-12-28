const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

// Configuration
const API_URL = 'http://localhost:4567/api';
const INTERVAL_MS = 2000; // Request every 2 seconds
const ERROR_RATE = 0.2; // 20% chance of error simulation

console.log('🎬 Director\'s Eye - Traffic Generator');
console.log(`Target: ${API_URL}`);
console.log(`Interval: ${INTERVAL_MS}ms`);
console.log(`Error Rate: ${ERROR_RATE * 100}%`);
console.log('----------------------------------------');

// Helper to create a dummy image for upload
const createDummyImage = () => {
    const buffer = Buffer.alloc(1024); // 1KB dummy buffer
    return buffer;
}

const simulateTraffic = async () => {
    const isError = Math.random() < ERROR_RATE;
    
    try {
        if (isError) {
            console.log('🔴 Simulating Error...');
            // Trigger 500 error endpoint
            await axios.post(`${API_URL}/simulate-error`);
        } else {
            console.log('🟢 Simulating Normal Analysis...');
            // Upload dummy image
            const form = new FormData();
            form.append('image', createDummyImage(), { filename: 'test-image.jpg', contentType: 'image/jpeg' });
            form.append('demoMode', 'true');

            await axios.post(`${API_URL}/analyze`, form, {
                headers: { ...form.getHeaders() }
            });

            // 30% Chance to also trigger "Magic Edit"
            if (Math.random() < 0.3) {
                console.log('✨ Simulating Magic Edit...');
                const dummyImageBase64 = createDummyImage().toString('base64');
                await axios.post(`${API_URL}/edit-image`, {
                    image: `data:image/jpeg;base64,${dummyImageBase64}`,
                    prompt: "Make it more cinematic"
                });
            }
        }
    } catch (error) {
        // Expected errors are fine
        if (error.response) {
            console.log(`   Response: ${error.response.status} ${error.response.statusText}`);
        } else {
            console.log(`   Error: ${error.message}`);
            if (error.code) console.log(`   Code: ${error.code}`);
        }
    }
};

// Run loop
setInterval(simulateTraffic, INTERVAL_MS);

// Also run immediate health check
axios.get(`${API_URL}/health`)
    .then(res => console.log(`✅ Health Check: ${res.status}`))
    .catch(err => console.error(`❌ Health Check Failed: ${err.message}`));
