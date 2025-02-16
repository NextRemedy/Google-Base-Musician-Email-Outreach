const express = require("express");
const router = express.Router();
const db = require("../db/connect"); // Firestore connection
const authenticateToken = require("../middlewares/authenticateToken"); // Middleware to verify JWT

// Get current Gmail account info (Protected Route)
router.get("/current", authenticateToken, async (req, res) => {
  try {
    const userEmail = req.user.email;
    res.json({ email: userEmail });
  } catch (error) {
    console.error("Error getting current account:", error);
    res.status(500).json({ error: "Failed to get current account information" });
  }
});

// Update Gmail account token (Protected Route)
router.post("/update-token", authenticateToken, async (req, res) => {
  try {
    const { token } = req.body;
    const userEmail = req.user.email; // Use email instead of uid

    if (!token || !userEmail) {
      return res.status(400).json({ error: "Token and user email are required" });
    }

    // Update token in the Firestore database
    const userDoc = db.collection("users").doc(userEmail);
    await userDoc.update({
      googleToken: token,
      lastUpdated: new Date(),
    });

    res.json({ message: "Token updated successfully" });
  } catch (error) {
    console.error("Error updating token:", error);
    res.status(500).json({ error: "Failed to update account token" });
  }
});

// Update Gmail session (No authentication required here)
router.post("/update-session", async (req, res) => {
  try {
    console.log("Received update-session request:", req.body);
    const { email, googleToken } = req.body;

    if (!email || !googleToken) {
      console.log("Missing required fields:", { email: !!email, googleToken: !!googleToken });
      return res.status(400).json({ error: "Email and token are required" });
    }

    // Update session or user data in Firestore
    const userDoc = db.collection("users").doc(email);
    const userSnapshot = await userDoc.get();

    if (!userSnapshot.exists) {
      console.log("Creating new user document for:", email);
      await userDoc.set({
        email: email,
        googleToken: googleToken,
        lastUpdated: new Date(),
      });
    } else {
      console.log("Updating existing user document for:", email);
      await userDoc.update({
        googleToken: googleToken,
        lastUpdated: new Date(),
      });
    }

    console.log("Session updated successfully for:", email);
    res.json({ message: "Session updated successfully" });
  } catch (error) {
    console.error("Error in update-session:", error);
    res.status(500).json({ error: "Failed to update session", details: error.message });
  }
});

// Get Gmail accounts and their authorization status
router.get("/accounts/gmail", authenticateToken, async (req, res) => {
  try {
    console.log("Fetching Gmail accounts");
    const userTokensSnapshot = await db.collection("userTokens").get();
    const accounts = [];

    const now = new Date();

    userTokensSnapshot.forEach((doc) => {
      const data = doc.data();
      const tokenExpiry = data.tokenExpiry ? new Date(data.tokenExpiry) : null;

      // Determine if the account is authorized
      const isAuthorized = !!(
        data.accessToken &&
        tokenExpiry &&
        tokenExpiry > now &&
        data.isAuthorized === true
      );

      accounts.push({
        email: doc.id,
        isAuthorized: isAuthorized,
        tokenExpiry: data.tokenExpiry,
      });
    });

    console.log("Found accounts:", accounts);
    res.json({ accounts });
  } catch (error) {
    console.error("Error getting Gmail accounts:", error);
    res.status(500).json({ error: "Failed to get Gmail accounts" });
  }
});

// Export the router
module.exports = router;
