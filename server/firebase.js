const admin = require('firebase-admin');
const path = require('path');
const logger = require('./logger');

let db = null;

try {
  // Method 1: Try environment variables first (for Vercel/serverless)
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    const serviceAccount = {
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL
    };
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    
    db = admin.firestore();
    logger.info('Firebase Admin initialized from environment variables');
  } else {
    // Method 2: Try service account file (for local dev)
    const serviceAccountPath = path.join(__dirname, 'service-account.json');
    
    if (require('fs').existsSync(serviceAccountPath)) {
      const serviceAccount = require(serviceAccountPath);
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });

      db = admin.firestore();
      logger.info('Firebase Admin initialized from service-account.json');
    } else {
      logger.warn('Firebase credentials not found. Gallery features will use in-memory fallback.');
    }
  }
} catch (error) {
  logger.error('Failed to initialize Firebase Admin', { error: error.message });
}

module.exports = { db };
