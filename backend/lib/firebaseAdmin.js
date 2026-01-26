// This file is maintained for backward compatibility
// Please use require('../config/firebase') instead

const admin = require('../config/firebase');

// Log to help with migration
console.log('Firebase Admin initialized with project:', admin.app().options.projectId);

module.exports = admin;
