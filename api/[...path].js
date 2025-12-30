// Vercel Serverless Catch-All Handler
// This file handles ALL /api/* routes by forwarding to Express app

const app = require('../server/index');

module.exports = app;
