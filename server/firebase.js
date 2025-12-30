const admin = require('firebase-admin');
const path = require('path');
const logger = require('./logger');

let db = null;

try {
  // Check if service account file exists
  const serviceAccountPath = path.join(__dirname, 'service-account.json');
  
  if (require('fs').existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    db = admin.firestore();
    logger.info('Firebase Admin initialized successfully');
  } else {
    logger.warn('Firebase service-account.json not found. Gallery features will use in-memory fallback.');
  }
} catch (error) {
  logger.error('Failed to initialize Firebase Admin', { error: error.message });
}

module.exports = { db };
