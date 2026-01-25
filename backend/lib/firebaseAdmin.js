const admin = require("firebase-admin");

// Initialize Firebase Admin with service account
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
});

module.exports = admin;
