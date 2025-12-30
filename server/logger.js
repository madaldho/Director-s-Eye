const winston = require('winston');
const axios = require('axios');
const Transport = require('winston-transport');

// --- HTTP LOG SUBMISSION HELPER ---
class DatadogTransport extends Transport {
  constructor(opts) {
    super(opts);
  }

  log(info, callback) {
    setImmediate(() => {
      this.emit('logged', info);
    });

    if (!process.env.DD_API_KEY) {
      callback();
      return;
    }

    // Map Winston levels to Datadog status
    const levelMap = { error: 'error', warn: 'warn', info: 'info', debug: 'debug' };
    const status = levelMap[info.level] || 'info';

    axios.post(
      'https://http-intake.logs.us5.datadoghq.com/api/v2/logs',
      [{
        ddsource: 'nodejs',
        ddtags: 'env:production,service:directors-eye-backend',
        hostname: 'macbook-pro-user',
        message: info.message,
        service: 'directors-eye-backend',
        status: status,
        ...info
      }],
      { headers: { 'DD-API-KEY': process.env.DD_API_KEY } }
    ).catch(e => {
      // Silent fail - don't break app if Datadog log submission fails
    });

    callback();
  }
}

// Winston Logger Setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'app.log' }),
    new DatadogTransport()
  ]
});

module.exports = logger;
