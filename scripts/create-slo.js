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

// Try to load .env from root
try {
  const envPath = path.resolve(__dirname, '../.env');
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key.trim()] = value.trim();
    }
  });
} catch (e) {
  console.log('Note: Could not load .env file directly, relying on environment variables.');
}

const DD_SITE = process.env.DD_SITE || 'us5.datadoghq.com';
const DD_API_KEY = process.env.DD_API_KEY;
const DD_APP_KEY = process.env.DD_APP_KEY;

if (!DD_API_KEY || !DD_APP_KEY) {
    console.error('❌ Missing DD_API_KEY or DD_APP_KEY environment variables');
    process.exit(1);
}

const rootDir = path.resolve(__dirname, '..');

// Find all slo_*.json files
let sloFiles = [];
try {
    const files = fs.readdirSync(rootDir);
    sloFiles = files.filter(file => file.startsWith('slo_') && file.endsWith('.json') && file !== 'slo_created.json');
} catch (err) {
    console.error('❌ Error finding SLO files:', err);
    process.exit(1);
}

if (sloFiles.length === 0) {
    console.log('⚠️ No slo_*.json files found (excluding slo_created.json).');
    process.exit(0);
}

const createSlo = (sloData, filename) => {
    return new Promise((resolve, reject) => {
        // Remove ID if present to avoid conflicts (creating new)
        const { id, creator, created_at, modified_at, ...cleanSlo } = sloData;
        const postData = JSON.stringify(cleanSlo);

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

        console.log(`📊 Creating SLO from ${filename}...`);
        console.log(`   Name: ${cleanSlo.name}`);
        console.log(`   Type: ${cleanSlo.type}`);

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    const response = JSON.parse(body);
                    console.log(`✅ SLO created successfully from ${filename}!`);
                    console.log(`   ID: ${response.data ? response.data[0].id : 'Unknown'}`);
                    resolve(response.data ? response.data[0] : null);
                } else {
                    console.error(`❌ Failed to create SLO from ${filename}: ${res.statusCode}`);
                    console.error(body);
                    resolve(null);
                }
            });
        });

        req.on('error', (e) => {
            console.error(`❌ Request error for ${filename}: ${e.message}`);
            resolve(null);
        });

        req.write(postData);
        req.end();
    });
};

(async () => {
    for (const file of sloFiles) {
        try {
            const raw = fs.readFileSync(path.join(rootDir, file), 'utf8');
            const data = JSON.parse(raw);
            await createSlo(data, file);
        } catch (e) {
            console.error(`❌ Error processing ${file}: ${e.message}`);
        }
    }
    console.log('🏁 SLO setup script finished.');
})();

// Commenting out legacy single-run logic
/* 
const sloData = { ... };
console.log('📊 Creating Datadog SLO...');
*/


// (Legacy single-file logic removed)
