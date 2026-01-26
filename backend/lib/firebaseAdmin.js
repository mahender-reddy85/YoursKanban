const admin = require("firebase-admin");

if (!admin.apps.length) {
  try {
    // Load environment variables explicitly
    require('dotenv').config();
    
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is required');
    }

    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    
    console.log('🔧 Initializing Firebase Admin with service account for project:', serviceAccount.project_id);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
    });

    console.log("🔥 Firebase Admin Project:", serviceAccount.project_id);

    // Verify the admin connection
    admin.auth().listUsers(1)
      .then(() => console.log('✅ Firebase Admin connection verified'))
      .catch(err => {
        console.error('❌ Failed to verify Firebase Admin connection:', err.message);
        throw err;
      });

    console.log('✅ Firebase Admin successfully initialized with project:', admin.app().options.projectId);
    
  } catch (error) {
    console.error('❌ Firebase Admin initialization failed:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    
    if (error.message.includes('private key')) {
      console.error('\n⚠️  Common issues with private key:');
      console.error('1. Make sure to include the full key with BEGIN and END PRIVATE KEY lines');
      console.error('2. Ensure newlines are properly escaped (use \\n in .env)');
      console.error('3. Verify the key is correctly copied from Firebase Console');
      console.error('4. Check for any invisible characters or spaces');
      console.error('5. Current private key format:', process.env.FIREBASE_PRIVATE_KEY ? 'Present' : 'Missing');
    }
    
    // Don't exit in production to allow for graceful degradation
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
  }
}

module.exports = admin;
