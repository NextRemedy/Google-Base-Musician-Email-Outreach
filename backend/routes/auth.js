const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const db = require("../db/connect"); // Firestore connection
const passport = require("passport");
const { google } = require("googleapis");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const session = require('express-session');

const router = express.Router();
const SECRET_KEY = process.env.SECRET_KEY || "default_secret_key";

// Middleware to authenticate JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;

    // Verify session
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Session expired" });
    }

    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(403).json({ error: "Invalid token" });
  }
};

// Configure Google OAuth
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_CALLBACK_URL) {
  console.error("Missing required Google OAuth environment variables");
}

// Configure session middleware
router.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport and restore authentication state from session
router.use(passport.initialize());
router.use(passport.session());

passport.serializeUser((user, done) => {
  done(null, user.email);
});

passport.deserializeUser(async (email, done) => {
  try {
    const userTokensRef = db.collection("userTokens").doc(email);
    const userTokens = await userTokensRef.get();
    if (!userTokens.exists) {
      return done(null, null);
    }
    done(null, { email, ...userTokens.data() });
  } catch (error) {
    done(error, null);
  }
});

// Passport Google Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: GOOGLE_CALLBACK_URL,
      passReqToCallback: true
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        console.log("Google OAuth callback received");
        
        // Get email from profile
        const email = profile.emails[0].value;
        
        // Create user object with tokens
        const user = {
          googleId: profile.id,
          email: email,
          displayName: profile.displayName,
          accessToken: accessToken,
          refreshToken: refreshToken
        };

        console.log("User profile created:", { 
          email: user.email, 
          hasAccessToken: !!user.accessToken,
          hasRefreshToken: !!user.refreshToken 
        });

        return done(null, user);
      } catch (error) {
        console.error("Error in Google Strategy callback:", error);
        return done(error, null);
      }
    }
  )
);

// Google OAuth routes
router.get("/google", (req, res, next) => {
  const { email, isNewAccount } = req.query;
  if (email) {
    req.session.authEmail = email;
    req.session.isNewAccount = isNewAccount === 'true';
  }
  passport.authenticate("google", {
    scope: [
      'profile', 
      'email',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://mail.google.com/'
    ],
    accessType: 'offline',
    prompt: 'consent'
  })(req, res, next);
});

router.get("/google/callback", 
  passport.authenticate("google", { 
    failureRedirect: "http://localhost:3000/manage-accounts?error=auth_failed",
    session: true
  }),
  async (req, res) => {
    try {
      if (!req.user || !req.user.accessToken) {
        console.error("No user data or access token in callback");
        return res.redirect("http://localhost:3000/manage-accounts?error=no_user_data");
      }

      const email = req.session.authEmail || req.user.email;
      console.log("Authorizing email:", email);
      
      // Store tokens in userTokens collection
      const userTokensRef = db.collection("userTokens").doc(email);
      
      // Get the current timestamp and expiry
      const now = new Date();
      const expiryTime = new Date(now.getTime() + 3600000); // 1 hour from now
      
      const tokenData = {
        accessToken: req.user.accessToken,
        refreshToken: req.user.refreshToken,
        tokenExpiry: expiryTime,
        lastUpdated: now,
        isAuthorized: true,
        email: email,
        scopes: [
          'profile', 
          'email',
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/gmail.compose',
          'https://www.googleapis.com/auth/gmail.modify',
          'https://mail.google.com/'
        ]
      };

      await userTokensRef.set(tokenData, { merge: true });
      
      // Create a JWT token
      const jwtToken = jwt.sign({ email }, SECRET_KEY, { expiresIn: '24h' });

      // Clear the session
      req.session.authEmail = null;
      req.session.isNewAccount = null;

      res.redirect(`http://localhost:3000/dashboard?success=true&token=${jwtToken}`);
    } catch (error) {
      console.error("Error in Google callback:", error);
      res.redirect("http://localhost:3000/manage-accounts?error=auth_failed");
    }
  }
);

// Get Gmail accounts
router.get("/accounts/gmail", authenticateToken, async (req, res) => {
  try {
    console.log("Fetching Gmail accounts");
    const userTokensSnapshot = await db.collection("userTokens").get();
    const accounts = [];
    
    const now = new Date();
    
    userTokensSnapshot.forEach(doc => {
      const data = doc.data();
      const tokenExpiry = data.tokenExpiry ? new Date(data.tokenExpiry) : null;
      
      const isAuthorized = !!(
        data.accessToken && 
        tokenExpiry &&
        tokenExpiry > now &&
        data.isAuthorized === true
      );
      
      accounts.push({
        email: doc.id,
        isAuthorized: isAuthorized,
        tokenExpiry: data.tokenExpiry
      });
    });
    
    console.log("Found accounts:", accounts);
    res.json({ accounts });
  } catch (error) {
    console.error("Error getting Gmail accounts:", error);
    res.status(500).json({ error: "Failed to get Gmail accounts" });
  }
});

// Remove Gmail account
router.delete("/accounts/gmail/:email", authenticateToken, async (req, res) => {
  try {
    const { email } = req.params;
    
    // Remove from userTokens collection
    await db.collection("userTokens").doc(email).delete();
    
    res.json({ message: "Account removed successfully" });
  } catch (error) {
    console.error("Error removing Gmail account:", error);
    res.status(500).json({ error: "Failed to remove Gmail account" });
  }
});

// Token refresh endpoint
router.post("/refresh-token", async (req, res) => {
  try {
    const { email } = req.body;
    const userTokensRef = db.collection("userTokens").doc(email);
    const userTokensSnapshot = await userTokensRef.get();
    
    if (!userTokensSnapshot.exists) {
      return res.status(404).json({ error: "User tokens not found" });
    }

    const userTokens = userTokensSnapshot.data();
    if (!userTokens.refreshToken) {
      return res.status(400).json({ error: "No refresh token available" });
    }

    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_CALLBACK_URL
    );

    oauth2Client.setCredentials({
      refresh_token: userTokens.refreshToken
    });

    const { tokens } = await oauth2Client.refreshAccessToken();
    
    await userTokensRef.update({
      accessToken: tokens.access_token,
      tokenExpiry: new Date(Date.now() + (tokens.expiry_date || 3600000))
    });

    res.json({ accessToken: tokens.access_token });
  } catch (error) {
    console.error("Error refreshing token:", error);
    res.status(500).json({ error: "Failed to refresh token" });
  }
});

// Add this new endpoint to handle session updates
router.post('/update-session', authenticateToken, async (req, res) => {
  try {
    const { email, googleToken } = req.body;
    
    if (!email || !googleToken) {
      return res.status(400).json({ error: 'Email and token are required' });
    }

    // Update the session with new tokens
    req.session.email = email;
    req.session.googleToken = googleToken;
    
    // Save the session
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        resolve();
      });
    });

    res.json({ message: 'Session updated successfully' });
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// Get authorized accounts
router.get("/authorized-accounts", authenticateToken, async (req, res) => {
  try {
    // Get all accounts that have valid tokens
    const userTokensSnapshot = await db.collection("userTokens").get();
    const authorizedAccounts = [];
    
    userTokensSnapshot.forEach(doc => {
      const data = doc.data();
      // Only include accounts with valid tokens
      if (data.accessToken && data.tokenExpiry && new Date(data.tokenExpiry) > new Date()) {
        authorizedAccounts.push(doc.id);
      }
    });
    
    res.json({ accounts: authorizedAccounts });
  } catch (error) {
    console.error("Error getting authorized accounts:", error);
    res.status(500).json({ error: "Failed to get authorized accounts" });
  }
});

// Revoke access for an account
router.delete("/revoke-access/:email", authenticateToken, async (req, res) => {
  try {
    const { email } = req.params;
    
    // Remove tokens for the account
    await db.collection("userTokens").doc(email).delete();
    
    res.json({ message: "Access revoked successfully" });
  } catch (error) {
    console.error("Error revoking access:", error);
    res.status(500).json({ error: "Failed to revoke access" });
  }
});

module.exports = router;
