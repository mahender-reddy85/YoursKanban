import admin from "firebase-admin";

// Check if Firebase Admin is already initialized
if (!admin.apps.length) {
  console.log('Initializing Firebase Admin...');
  
  // Verify all required environment variables are set
  const requiredVars = [
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY',
    'DATABASE_URL'
  ];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
  
  console.log('All required environment variables found');
  console.log('DATABASE_URL exists?', !!process.env.DATABASE_URL);
  
  try {
    // Initialize Firebase Admin with individual environment variables
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      }),
      databaseURL: process.env.DATABASE_URL
    });
    
    console.log('Firebase Admin initialized successfully');
    console.log('Project ID:', process.env.FIREBASE_PROJECT_ID);
    
    // Test authentication
    try {
      const auth = admin.auth();
      const users = await auth.listUsers(1);
      console.log('Firebase Admin authentication test successful');
    } catch (authError) {
      console.error('Firebase Admin authentication test failed:', authError);
      throw authError;
    }
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
    throw new Error(`Failed to initialize Firebase Admin: ${error.message}`);
  }
} else {
  console.log('Firebase Admin already initialized, reusing existing instance');
}

export default admin;
