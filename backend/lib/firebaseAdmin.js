const admin = require("firebase-admin");

// Helper function to safely format private key
const formatPrivateKey = (key) => {
  if (!key) return null;
  // Handle both escaped and unescaped newlines
  return key.replace(/\\n/g, '\n').replace(/\n/g, '\n');
};

if (!admin.apps.length) {
  try {
    // Load environment variables explicitly
    require('dotenv').config();
    
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY);

    console.log('🔧 Initializing Firebase Admin with:', {
      projectId: projectId ? '✅ Set' : '❌ Missing',
      clientEmail: clientEmail ? '✅ Set' : '❌ Missing',
      privateKey: privateKey ? '✅ Set' : '❌ Missing',
      privateKeyPreview: privateKey ? `...${privateKey.substring(privateKey.length - 20)}` : 'N/A'
    });

    if (!projectId || !clientEmail || !privateKey) {
      const missing = [];
      if (!projectId) missing.push('FIREBASE_PROJECT_ID');
      if (!clientEmail) missing.push('FIREBASE_CLIENT_EMAIL');
      if (!privateKey) missing.push('FIREBASE_PRIVATE_KEY');
      
      throw new Error(`Missing required Firebase Admin environment variables: ${missing.join(', ')}`);
    }

    // Initialize Firebase Admin
    const firebaseConfig = {
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey
      }),
      databaseURL: `https://${projectId}.firebaseio.com`
    };

    admin.initializeApp(firebaseConfig);

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
