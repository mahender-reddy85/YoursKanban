import admin from "firebase-admin";

if (!admin.apps.length) {
  try {
    console.log('Initializing Firebase Admin...');
    
    // Debug: Check if FIREBASE_SERVICE_ACCOUNT exists
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not set');
    }
    
    console.log('FIREBASE_SERVICE_ACCOUNT found, parsing...');
    
    let serviceAccount;
    try {
      serviceAccount = typeof process.env.FIREBASE_SERVICE_ACCOUNT === 'string' 
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
        : process.env.FIREBASE_SERVICE_ACCOUNT;
      
      console.log('Service account parsed successfully. Project ID:', serviceAccount.project_id);
    } catch (parseError) {
      console.error('Error parsing FIREBASE_SERVICE_ACCOUNT:', parseError);
      console.error('FIREBASE_SERVICE_ACCOUNT value:', 
        process.env.FIREBASE_SERVICE_ACCOUNT 
          ? `${process.env.FIREBASE_SERVICE_ACCOUNT.substring(0, 50)}...` 
          : 'undefined');
      throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT format. Must be valid JSON.');
    }

    // Initialize Firebase Admin
    const config = {
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
    };
    
    console.log('Initializing Firebase Admin with config:', {
      projectId: serviceAccount.project_id,
      databaseURL: config.databaseURL
    });
    
    admin.initializeApp(config);
    
    console.log('Firebase Admin initialized successfully for project:', serviceAccount.project_id);
    console.log('Firebase Admin app name:', admin.app().name);
    
    // Test token verification with a dummy token to ensure everything is working
    try {
      await admin.appCheck().createToken('test');
      console.log('Firebase Admin token verification test passed');
    } catch (testError) {
      console.warn('Firebase Admin token verification test failed (this might be expected):', testError.message);
    }
    
  } catch (error) {
    console.error('❌ Error initializing Firebase Admin:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      serviceAccountAvailable: !!process.env.FIREBASE_SERVICE_ACCOUNT,
      serviceAccountType: typeof process.env.FIREBASE_SERVICE_ACCOUNT,
      serviceAccountPreview: process.env.FIREBASE_SERVICE_ACCOUNT 
        ? `${process.env.FIREBASE_SERVICE_ACCOUNT.substring(0, 100)}...` 
        : 'undefined'
    });
    throw new Error(`Failed to initialize Firebase Admin: ${error.message}`);
  }
} else {
  console.log('Firebase Admin already initialized, reusing existing instance');
}

export default admin;
