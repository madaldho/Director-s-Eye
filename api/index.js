// Vercel Serverless API Handler
// This wraps the Express app for Vercel's serverless environment

const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Import Express app
const app = require('../server/index');

// Export for Vercel
module.exports = app;
