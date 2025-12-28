const https = require('https');
const path = require('path');
const fs = require('fs');

// Manual .env loading to avoid dependency issues
try {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        if (key && value && !process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
} catch (e) {
  console.log('Note: Could not load .env file manually.');
}

const API_KEY = process.env.DD_API_KEY;

if (!API_KEY) {
  console.error('❌ DD_API_KEY not found.');
  process.exit(1);
}

const SITE = 'api.us5.datadoghq.com'; // User seems to be on US5 based on artifacts

console.log('🚀 Sending VERIFICATION DATA to Datadog...');

function sendMetric(name, value, type = 'gauge', tags = []) {
  const payload = {
    series: [{
      metric: name,
      points: [[Math.floor(Date.now() / 1000), value]],
      type: type,
      host: 'macbook-pro-user',
      tags: [...tags, 'env:production', 'service:directors-eye-backend']
    }]
  };

  const data = JSON.stringify(payload);
  const options = {
    hostname: SITE,
    path: '/api/v1/series',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'DD-API-KEY': API_KEY,
      'Content-Length': data.length
    }
  };

  const req = https.request(options, (res) => {
    // console.log(`Sent ${name}: ${res.statusCode}`);
  });

  req.on('error', (e) => console.error(`Failed to send ${name}:`, e));
  req.write(data);
  req.end();
}

// 1. Simulate HITS (Traffic) - Vital for Error Rate Monitor handling "No Data"
// Send 10 hits
console.log('... Sending Traffic Metrics (Hits)');
for (let i = 0; i < 10; i++) {
  sendMetric('trace.express.request.hits', 1, 'count');
}

// 2. Simulate ERRORS (Low amount, so we don't trigger alert, but show data)
console.log('... Sending Error Metrics (Low/Health)');
sendMetric('trace.express.request.errors', 0, 'count'); // Send 0 to show "No Errors"

// 3. Simulate DURATION (Healthy) - Vital for Latency Monitor
console.log('... Sending Latency Metrics (Normal)');
sendMetric('trace.express.request.duration', 0.5, 'gauge'); // 500ms
sendMetric('trace.express.request.duration', 1.2, 'gauge'); // 1.2s

// 4. Simulate SCORE (Healthy) - Vital for Score Monitor
console.log('... Sending Business Metrics (Score)');
sendMetric('app.cinematography.score', 85, 'gauge');
sendMetric('app.cinematography.score', 92, 'gauge');

// 5. Simulate AI Usage
console.log('... Sending AI Token Metrics');
sendMetric('app.ai.tokens.total', 1500, 'count');

console.log('✅ Data sending initiated. Check Datadog "Monitors" page in ~1 minute.');
console.log('   Go to: https://us5.datadoghq.com/monitors/manage');
