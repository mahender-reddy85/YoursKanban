const admin = require("firebase-admin");

if (!admin.apps.length) {
  try {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\\\n/g, '\n'),
    };

    if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
      console.error('❌ Missing required Firebase Admin environment variables');
      console.error('Please check if FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are properly set');
      process.exit(1);
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      }),
      databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
    });

    console.log('✅ Firebase Admin initialized with project:', admin.app().options.projectId);
  } catch (error) {
    console.error('❌ Firebase Admin initialization failed:');
    console.error(error.message);
    
    if (error.message.includes('private key')) {
      console.error('\n⚠️  Common issues with private key:');
      console.error('1. Make sure to include the full key with BEGIN and END PRIVATE KEY lines');
      console.error('2. Ensure newlines are properly escaped (use \\n in .env)');
      console.error('3. Verify the key is not corrupted or missing any characters');
    }
    
    process.exit(1);
  }
}

module.exports = admin;
