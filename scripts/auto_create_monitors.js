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

const API_KEY = process.env.DD_API_KEY;
const APP_KEY = process.env.DD_APP_KEY || process.env.DD_APPLICATION_KEY; // Sometimes called differently

if (!API_KEY) {
  console.error('❌ Error: DD_API_KEY not found in environment variables.');
  process.exit(1);
}

// If APP_KEY is needed for Monitors, usually API Key + Application Key are required.
// However, the hackathon instructions might only provide API Key in some contexts, but usually App Key is needed for write access.
// Let's check the env file for APP_KEY or similar.

console.log('🚀 Starting Datadog Monitor Creation...');
console.log('DEBUG INFO:');
console.log(`- DD_SITE: ${process.env.DD_SITE}`);
console.log(`- API_KEY: ${API_KEY ? API_KEY.substring(0,5) + '...' : 'UNDEFINED'}`);
console.log(`- APP_KEY: ${APP_KEY ? APP_KEY.substring(0,5) + '...' : 'UNDEFINED'}`);

// Validate Keys and Detect Region
function findCorrectSite() {
    const sites = [
        'datadoghq.com',
        'us5.datadoghq.com',
        'us3.datadoghq.com',
        'datadoghq.eu',
        'ap1.datadoghq.com'
    ];

    return new Promise(async (resolve) => {
        for (const site of sites) {
            const isValid = await checkSite(site);
            if (isValid) {
                console.log(`✅ FOUND CORRECT SITE: ${site}`);
                resolve(site);
                return;
            }
        }
        resolve(null);
    });
}

function checkSite(site) {
    return new Promise((resolve) => {
        const headers = { 'DD-API-KEY': API_KEY };
        const options = {
            hostname: 'api.' + site,
            path: '/api/v1/validate',
            method: 'GET',
            headers: headers
        };
        const req = https.request(options, (res) => {
            console.log(`... Checking ${site} -> Status: ${res.statusCode}`);
            resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.end();
    });
}


const monitors = [
  {
    "name": "[High Urgency] High Error Rate (>1%)",
    "type": "query alert",
    "query": "sum(last_5m):sum:trace.express.request.errors{service:directors-eye-backend}.as_count() / sum:trace.express.request.hits{service:directors-eye-backend}.as_count() > 0.01",
    "message": "{{#is_alert}}\n⚠️ **CRITICAL: High Error Rate Detected!**\n\n**Action Required:**\n1. Check logs for 500 errors.\n2. Verify Gemini API Connectivity.\n3. **Declare Incident** if sustained > 5 mins.\n\n@pagerduty-engineering\n@slack-alerts\n{{/is_alert}}",
    "tags": ["env:production", "service:directors-eye-backend", "team:ai"],
    "options": {
      "thresholds": {
        "critical": 0.01,
        "warning": 0.005
      }
    }
  },
  {
    "name": "[Performance] High Latency (>5s)",
    "type": "query alert",
    "query": "avg(last_5m):avg:trace.express.request.duration{service:directors-eye-backend} > 5",
    "message": "{{#is_alert}}\n🐢 **PERFORMANCE DEGRADATION**\n\n**Impact:** User experience severely affected.\n**Action:** Investigate Trace ID in APM.\n\n@slack-alerts\n{{/is_alert}}",
    "tags": ["env:production", "service:directors-eye-backend", "performance"],
    "options": {
      "thresholds": {
        "critical": 5,
        "warning": 3
      }
    }
  },
  {
    "name": "[Business Logic] Low Cinematography Score (<50)",
    "type": "metric alert",
    "query": "avg(last_5m):avg:app.cinematography.score{service:directors-eye-backend} < 50",
    "message": "{{#is_alert}}\n📉 **QUALITY ALERT: Model Hallucination Risk**\n\n**Action:**\n1. Review recent inputs in Dashboard.\n2. Check for adversarial images.\n\n@team-lead\n{{/is_alert}}",
    "tags": ["env:production", "service:directors-eye-backend", "quality"],
    "options": {
      "thresholds": {
        "critical": 50,
        "warning": 60
      }
    }
  }
];

function createMonitor(monitor) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(monitor);
    
    // We need Application Key for creating monitors
    // Adding headers
    const headers = {
      'Content-Type': 'application/json',
      'DD-API-KEY': API_KEY,
    };
    
    // If we have APP_KEY, use it. Without it, some endpoints might fail, but let's try.
    if (process.env.DD_APP_KEY) {
        headers['DD-APPLICATION-KEY'] = process.env.DD_APP_KEY;
    }

    // Construct API Hostname
    // If DD_SITE is us5.datadoghq.com, API is api.us5.datadoghq.com
    const ddSite = process.env.DD_SITE || 'datadoghq.com';
    const apiHost = 'api.' + ddSite;

    const options = {
      hostname: apiHost,
      path: '/api/v1/monitor',
      method: 'POST',
      headers: headers
    };

    const req = https.request(options, (res) => {
      let responseBody = '';

      res.on('data', (chunk) => {
        responseBody += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`✅ Created Monitor: ${monitor.name}`);
          resolve(JSON.parse(responseBody));
        } else {
          console.error(`❌ Failed to create ${monitor.name}: ${res.statusCode} ${res.statusMessage}`);
          console.error('Response:', responseBody);
          resolve(null); // Resolve null to continue
        }
      });
    });

    req.on('error', (e) => {
      console.error(`❌ Request Error for ${monitor.name}: ${e.message}`);
      resolve(null);
    });

    req.write(data);
    req.end();
  });
}

(async () => {
    // Check for App Key warning
    if (!process.env.DD_APP_KEY) {
        console.warn("⚠️  WARNING: DD_APP_KEY not found. Monitor creation usually requires an Application Key in addition to the API Key.");
        console.warn("If this fails, please add DD_APP_KEY=... to your .env file.");
    }

    const detectedSite = await findCorrectSite();
    
    if (!detectedSite) {
        console.error('❌ API Key Verification Failed on ALL regions.');
        console.error('   Please double check your DD_API_KEY in the .env file.');
        process.exit(1);
    }
    
    // Set the correct site for creation function to use
    process.env.DD_SITE = detectedSite;

    for (const monitor of monitors) {
        await createMonitor(monitor);
    }
    console.log('🏁 Monitor setup script finished.');
})();
