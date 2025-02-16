const admin = require("firebase-admin");
const serviceAccount = require("../config/serviceAccountKey.json"); // Path to the JSON file

try {
  console.log("Initializing Firebase Admin...");
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("Firebase Admin initialized successfully");
  }

  const db = admin.firestore();
  
  // Test the connection
  db.collection("test").get()
    .then(() => console.log("✅ Firestore connection successful"))
    .catch(error => console.error("❌ Firestore connection error:", error));

  module.exports = db;
} catch (error) {
  console.error("Failed to initialize Firebase:", error);
  throw error;
}
