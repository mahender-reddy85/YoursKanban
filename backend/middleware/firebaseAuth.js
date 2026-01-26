const admin = require("../config/firebase");
const { pool } = require("../lib/db");

module.exports = async function firebaseAuth(req, res, next) {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = header.split("Bearer ")[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const firebaseUid = decodedToken.uid;
    const email = decodedToken.email;

    if (!firebaseUid || !email) {
      return res.status(401).json({ message: "Invalid token: Missing required user information" });
    }

    // Step 1: Check if user already exists
    const existingUser = await pool.query(
      `SELECT * FROM users WHERE firebase_uid = $1 OR email = $2`,
      [firebaseUid, email]
    );

    let user;

    if (existingUser.rows.length === 0) {
      console.log("Creating new user for Firebase UID:", firebaseUid);
      
      const newUser = await pool.query(
        `INSERT INTO users (firebase_uid, email)
         VALUES ($1, $2)
         RETURNING *`,
        [firebaseUid, email]
      );
      
      user = newUser.rows[0];
    } else {
      user = existingUser.rows[0];
      
      // Update firebase_uid if user exists by email but doesn't have firebase_uid
      if (!user.firebase_uid) {
        console.log("Updating existing user with Firebase UID:", firebaseUid);
        const updatedUser = await pool.query(
          `UPDATE users 
           SET firebase_uid = $1 
           WHERE id = $2 
           RETURNING *`,
          [firebaseUid, user.id]
        );
        user = updatedUser.rows[0];
      }
    }

    // Attach user to request object
    req.user = {
      id: user.id,
      uid: user.firebase_uid,
      email: user.email
    };

    next();

  } catch (error) {
    console.error("Auth error:", error.message);
    console.error(error.stack);
    return res.status(401).json({ 
      message: "Authentication failed",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
