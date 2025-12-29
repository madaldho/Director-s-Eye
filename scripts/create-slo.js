#!/usr/bin/env node
/**
 * Datadog SLO Creator
 * Creates the Director's Eye SLO via API
 * 
 * Usage: DD_API_KEY=xxx DD_APP_KEY=xxx node create-slo.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const DD_SITE = process.env.DD_SITE || 'us5.datadoghq.com';
const DD_API_KEY = process.env.DD_API_KEY;
const DD_APP_KEY = process.env.DD_APP_KEY;

if (!DD_API_KEY || !DD_APP_KEY) {
    console.error('❌ Missing DD_API_KEY or DD_APP_KEY environment variables');
    process.exit(1);
}

// SLO Definition - Monitor-based for simplicity
const sloData = {
    name: "Director's Eye - API Response Time SLO",
    type: 'monitor',
    description: '99% of API requests complete successfully within expected time',
    monitor_ids: [17316813], // Latency monitor
    thresholds: [
        {
            target: 99.0,
            timeframe: '30d',
            warning: 99.5
        }
    ],
    tags: [
        'service:directors-eye-backend',
        'env:production',
        'team:ai',
        'challenge:datadog-hackathon'
    ]
};

const postData = JSON.stringify(sloData);

const options = {
    hostname: `api.${DD_SITE}`,
    port: 443,
    path: '/api/v1/slo',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'DD-API-KEY': DD_API_KEY,
        'DD-APPLICATION-KEY': DD_APP_KEY,
        'Content-Length': Buffer.byteLength(postData)
    }
};

console.log('📊 Creating Datadog SLO...');
console.log(`   Name: ${sloData.name}`);
console.log(`   Type: ${sloData.type}`);
console.log(`   Target: ${sloData.thresholds[0].target}%`);

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            const response = JSON.parse(body);
            console.log('✅ SLO created successfully!');
            console.log(`   ID: ${response.data[0].id}`);
            
            // Save to file
            const sloPath = path.join(__dirname, '..', 'slo_created.json');
            fs.writeFileSync(sloPath, JSON.stringify(response.data[0], null, 2));
            console.log(`   Saved to: ${sloPath}`);
        } else {
            console.error(`❌ Failed to create SLO: ${res.statusCode}`);
            console.error(body);
        }
    });
});

req.on('error', (e) => {
    console.error(`❌ Request error: ${e.message}`);
});

req.write(postData);
req.end();
