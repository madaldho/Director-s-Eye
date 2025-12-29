# Director's Eye - Troubleshooting Runbook

## Overview
This runbook provides resolution steps for monitoring alerts triggered in the Director's Eye application.

---

## 🔴 High Error Rate (>1%)

**Monitor**: `[High Urgency] High Error Rate (>1%)`

### Symptoms
- Error rate exceeds 1% on `/api/analyze` endpoint
- Users report "Analysis failed" errors

### Root Causes
1. **Gemini API Rate Limit**: Too many requests in short time
2. **Invalid API Key**: `GEMINI_API_KEY` expired or invalid
3. **Network Issues**: Backend cannot reach Gemini API

### Resolution Steps
1. Check Gemini API status: https://status.cloud.google.com/
2. Verify API key in `.env` file
3. Review server logs: `docker logs directors-eye-backend`
4. If rate limited, wait 60 seconds or reduce traffic
5. Restart backend: `npm run server`

---

## 🟡 High Latency (>5s)

**Monitor**: `[Performance] High Latency (>5s)`

### Symptoms
- API response time exceeds 5 seconds
- Users experience slow image analysis

### Root Causes
1. **Large Image Size**: Images >10MB take longer
2. **Gemini API Overload**: High global traffic
3. **Cold Start**: Serverless function warming up

### Resolution Steps
1. Check image sizes being uploaded
2. Review Gemini model status
3. Consider caching frequent analyses
4. Scale backend if using containerized deployment

---

## 🟠 Low Cinematography Score (<50)

**Monitor**: `[Business Logic] Low Cinematography Score (<50)`

### Symptoms
- Average cinematography score drops below 50
- Possible model hallucination or poor input

### Root Causes
1. **Poor Input Quality**: Low-resolution or blank images
2. **Model Hallucination**: AI generating random scores
3. **Prompt Drift**: System prompt needs tuning

### Resolution Steps
1. Review recent image uploads for quality
2. Test with known good images
3. Check AI prompt in `server/index.js`
4. Compare response format with expected schema

---

## 📊 Dashboard Reference
- **Dashboard URL**: [Director's Eye Dashboard](https://app.us5.datadoghq.com/dashboard)
- **Logs**: Filter by `service:directors-eye-backend`
- **APM**: Check `/api/analyze` traces

---

## Contact
- **On-Call Engineer**: @team-lead
- **Slack Channel**: #directors-eye-alerts
