const admin = require("../config/firebase");

module.exports = async function firebaseAuth(req, res, next) {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = header.split("Bearer ")[1];
    const decodedToken = await admin.auth().verifyIdToken(token);

    // Set user object with only the necessary fields
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email
    };

    next();

  } catch (error) {
    console.error("Auth error:", error.message);
    return res.status(401).json({ message: "Invalid token" });
  }
};
