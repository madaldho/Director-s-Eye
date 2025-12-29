#!/usr/bin/env node
/**
 * Datadog Incident Creator
 * Creates an incident with full context when triggered by a monitor
 * 
 * Usage: DD_API_KEY=xxx DD_APP_KEY=xxx node create-incident.js --title "Error Spike" --severity "SEV-2"
 */

const https = require('https');

const DD_SITE = process.env.DD_SITE || 'us5.datadoghq.com';
const DD_API_KEY = process.env.DD_API_KEY;
const DD_APP_KEY = process.env.DD_APP_KEY;

// Parse CLI args
const args = process.argv.slice(2);
let title = 'Director\'s Eye - Automated Incident';
let severity = 'SEV-3';
let summary = 'Monitor triggered - requires investigation.';

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--title' && args[i + 1]) title = args[i + 1];
    if (args[i] === '--severity' && args[i + 1]) severity = args[i + 1];
    if (args[i] === '--summary' && args[i + 1]) summary = args[i + 1];
}

if (!DD_API_KEY || !DD_APP_KEY) {
    console.error('❌ Missing DD_API_KEY or DD_APP_KEY environment variables');
    process.exit(1);
}

const incidentData = {
    data: {
        type: 'incidents',
        attributes: {
            title: title,
            customer_impact_scope: 'AI Analysis Feature',
            customer_impacted: true,
            customer_impact_start: new Date().toISOString(), // ISO 8601 format
            fields: {
                severity: { type: 'dropdown', value: severity },
                state: { type: 'dropdown', value: 'active' },
                detection_method: { type: 'dropdown', value: 'monitor' },
                summary: { type: 'textbox', value: summary },
                root_cause: { type: 'textbox', value: 'Pending investigation - check runbook' }
            },
            notification_handles: [
                { display_name: 'AI Team', handle: '@team-ai' }
            ]
        }
    }
};

const postData = JSON.stringify(incidentData);

const options = {
    hostname: `api.${DD_SITE}`,
    port: 443,
    path: '/api/v2/incidents',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'DD-API-KEY': DD_API_KEY,
        'DD-APPLICATION-KEY': DD_APP_KEY,
        'Content-Length': Buffer.byteLength(postData)
    }
};

console.log('🚨 Creating Datadog Incident...');
console.log(`   Title: ${title}`);
console.log(`   Severity: ${severity}`);

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            const response = JSON.parse(body);
            console.log('✅ Incident created successfully!');
            console.log(`   ID: ${response.data.id}`);
            console.log(`   URL: https://app.${DD_SITE}/incidents/${response.data.id}`);
        } else {
            console.error(`❌ Failed to create incident: ${res.statusCode}`);
            console.error(body);
        }
    });
});

req.on('error', (e) => {
    console.error(`❌ Request error: ${e.message}`);
});

req.write(postData);
req.end();
