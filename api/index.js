// Vercel Serverless Function - API Entry Point
// This file acts as the entry point for all /api/* routes on Vercel

// Import the Express app from server
const app = require('../server/index');

// Export for Vercel serverless
module.exports = app;
