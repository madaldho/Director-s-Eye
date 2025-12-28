const https = require('https');
const fs = require('fs');
const path = require('path');

// Try to load .env manually
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
  console.log('Note: Could not load .env file directly.');
}

const API_KEY = process.env.DD_API_KEY;
const APP_KEY = process.env.DD_APP_KEY || process.env.DD_APPLICATION_KEY;

if (!API_KEY || !APP_KEY) {
  console.error('❌ Error: DD_API_KEY and DD_APP_KEY are REQUIRED.');
  process.exit(1);
}

// Dashboard Definition
const dashboardPayload = {
  "title": "Director's Eye - AI Observability (GenAI + APM)",
  "description": "Auto-generated Dashboard for Hackathon. Monitors Gemini AI Performance, Tokens, Costs, and User Experience.",
  "widgets": [
    {
      "definition": {
        "type": "group",
        "layout_type": "ordered",
        "title": "🤖 AI Performance & Cost (Winner Metrics)",
        "widgets": [
          {
            "definition": {
              "type": "timeseries",
              "requests": [
                {
                  "q": "sum:app.ai.tokens.total{env:production}.as_count()",
                  "display_type": "bars",
                  "style": { "palette": "purple", "line_type": "solid", "line_width": "normal" }
                }
              ],
              "title": "Token Usage (Total)"
            }
          },
          {
            "definition": {
              "type": "timeseries",
              "requests": [
                {
                  "q": "cumsum(sum:app.ai.cost.estimated{env:production})",
                  "display_type": "line",
                  "style": { "palette": "green", "line_type": "solid", "line_width": "thick" }
                }
              ],
              "title": "Estimated AI Cost (USD)"
            }
          },
          {
             "definition": {
                "type": "query_value",
                "requests": [
                   {
                      "q": "sum:app.ai.edit.success{env:production}.as_count()",
                      "aggregator": "sum"
                   }
                ],
                "title": "Magic Edits Performed"
             }
          }
        ]
      },
      "layout": { "x": 0, "y": 0, "width": 12, "height": 4 }
    },
    {
      "definition": {
        "type": "group",
        "layout_type": "ordered",
        "title": "🛡️ Security & Quality Signals",
        "widgets": [
          {
            "definition": {
              "type": "query_value",
              "requests": [
                {
                  "q": "avg:app.cinematography.score{env:production}",
                  "aggregator": "avg",
                  "conditional_formats": [
                    { "comparator": "<", "value": 50, "palette": "red_on_white" },
                    { "comparator": ">=", "value": 80, "palette": "green_on_white" }
                  ]
                }
              ],
              "title": "Avg Cinematography Score"
            }
          },
          {
             "definition": {
                "type": "log_stream",
                "query": "service:directors-eye-backend status:error OR status:warn",
                "columns": ["date", "message", "service"],
                "show_date_column": true,
                "show_message_column": true,
                "sort": { "column": "date", "order": "desc" },
                "title": "Backend Error Logs"
             }
          }
        ]
      },
      "layout": { "x": 0, "y": 4, "width": 12, "height": 4 }
    }
  ],
  "template_variables": [
    { "name": "env", "prefix": "env", "default": "production" }
  ],
  "layout_type": "ordered"
};

function createDashboard() {
    const data = JSON.stringify(dashboardPayload);
    const ddSite = process.env.DD_SITE || 'datadoghq.com'; // Default if not found, but we really need the correct one
    
    // Simple heuristic or hardcode if we know. For now rely on env/default.
    // The previous script detected 'us5.datadoghq.com', so let's try to respect that if set in env, otherwise us5 default.
    const apiHost = 'api.' + (process.env.DD_SITE || 'us5.datadoghq.com'); 

    const options = {
      hostname: apiHost,
      path: '/api/v1/dashboard',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'DD-API-KEY': API_KEY,
        'DD-APPLICATION-KEY': APP_KEY
      }
    };

    console.log(`🚀 Creating Dashboard on ${apiHost}...`);

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const json = JSON.parse(responseBody);
          console.log(`✅ Dashboard Created Successfully!`);
          console.log(`🔗 Link: https://${process.env.DD_SITE || 'us5.datadoghq.com'}/dashboard/${json.id}`);
        } else {
          console.error(`❌ Failed: ${res.statusCode} ${res.statusMessage}`);
          console.error(responseBody);
        }
      });
    });

    req.on('error', (e) => console.error(`❌ Request Error: ${e.message}`));
    req.write(data);
    req.end();
}

createDashboard();
