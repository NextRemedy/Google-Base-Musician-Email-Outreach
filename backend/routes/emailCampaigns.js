const express = require("express");
const router = express.Router();
const db = require("../db/connect");
const axios = require("axios");
const { google } = require("googleapis");
const { OAuth2Client } = require('google-auth-library');
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const { Base64 } = require("js-base64");
const moment = require('moment');

// Helper function to create authenticated Gmail client
async function getAuthenticatedGmailClient(gmailAccount) {
  try {
    // Get tokens from Firestore
    const userTokensRef = db.collection("userTokens").doc(gmailAccount);
    const userTokens = await userTokensRef.get();
    
    if (!userTokens.exists) {
      throw new Error("Gmail account not authorized");
    }

    const tokens = userTokens.data();
    
    // Create new OAuth2Client instance for this request
    const oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_CALLBACK_URL
    );

    // Set credentials
    oauth2Client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expiry_date: tokens.tokenExpiry
    });

    // Create Gmail API client
    return google.gmail({version: 'v1', auth: oauth2Client});
  } catch (error) {
    console.error('Error creating Gmail client:', error);
    throw error;
  }
}

// Middleware to authenticate token
const authenticateToken = (req, res, next) => {
  try {
    console.log("\n=== Auth Middleware Start ===");
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      console.log("❌ No token provided");
      return res.status(401).json({ error: "No token provided" });
    }

    const secret = process.env.JWT_SECRET || process.env.SECRET_KEY;
    if (!secret) {
      console.error("❌ No JWT secret key found in environment variables");
      return res.status(500).json({ error: "Server configuration error" });
    }

    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    console.log("✅ Token verified successfully", req.user.email);
    console.log("=== Auth Middleware End ===\n");
    next();
  } catch (error) {
    console.error("❌ Auth Middleware Error:", error);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: "Token expired" });
    }
    return res.status(401).json({ error: "Invalid token", details: error.message });
  }
};

// ✅ Middleware to check subscription status
const checkSubscription = async (req, res, next) => {
  try {
    const userEmail = req.user.email;
    const subscriptionRef = db.collection("users").where("email", "==", userEmail);
    const subscriptionSnapshot = await subscriptionRef.get();

    if (!subscriptionSnapshot.empty) {
      const subscriptionData = subscriptionSnapshot.docs[0].data();
      const subscriptionActive = subscriptionData.subscriptionStatus === "active" &&
                                 subscriptionData.subscriptionType === "unlimited_plan" &&
                                 new Date(subscriptionData.endDate.toDate()) > new Date();

      req.isSubscribed = subscriptionActive;
    } else {
      req.isSubscribed = false;
    }

    next();
  } catch (error) {
    console.error("Error checking subscription status:", error);
    res.status(500).json({ error: "Failed to check subscription status" });
  }
};

// Helper function to check and update email quota
async function checkAndUpdateEmailQuota(gmailAccount) {
  const quotaRef = db.collection("emailQuotas").doc(gmailAccount);
  const today = moment().format('YYYY-MM-DD');
  
  const doc = await quotaRef.get();
  const data = doc.exists ? doc.data() : { date: today, count: 0 };
  
  // Reset counter if it's a new day
  if (data.date !== today) {
    data.date = today;
    data.count = 0;
  }
  
  // Check if quota exceeded
  if (data.count >= 40) {
    throw new Error('Daily email quota exceeded');
  }
  
  // Update counter
  await quotaRef.set({
    date: today,
    count: data.count + 1
  });
  
  return 40 - (data.count + 1); // Return remaining quota
}

// Helper function to send email using Gmail API
async function sendEmail(gmailAccount, { to, subject, body, campaignId }) {
  try {
    console.log(`📧 Sending email to ${to}...`);

    // Check quota before sending
    const remainingQuota = await checkAndUpdateEmailQuota(gmailAccount);
    // Get authenticated Gmail client
    const gmail = await getAuthenticatedGmailClient(gmailAccount);
    
    // Create email content
    const emailContent = [
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      `To: ${to}`,
      `Subject: ${subject}`,
      '',
      body
    ].join('\n');

    // Encode the email
    const encodedEmail = Buffer.from(emailContent)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send the email
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail
      }
    });

    console.log(`✅ Email sent successfully to ${to}. Remaining quota: ${remainingQuota}`);
    return { success: true, remainingQuota };
  } catch (error) {
    console.error(`❌ Error sending email to ${to}:`, error);
    throw error;
  }
}

// Process spintax in email content
const processSpintax = (text) => {
  if (!text) return text;
  return text.replace(/\{([^{}]*)\}/g, (match, choices) => {
    const options = choices.split('|');
    return options[Math.floor(Math.random() * options.length)];
  });
};

// Generate multiple spintax variations
const generateSpintaxVariations = (text, limit = 3) => {
  const variations = new Set();
  for (let i = 0; i < limit * 2 && variations.size < limit; i++) {
    variations.add(processSpintax(text));
  }
  return Array.from(variations);
};
// Add this route to get a single campaign
// ✅ API to fetch campaign details (Include Subscription Status)
router.get("/:campaignId", authenticateToken, checkSubscription, async (req, res) => {
  try {
    const { campaignId } = req.params;
    const campaignDoc = await db.collection("emailCampaigns").doc(campaignId).get();
    
    if (!campaignDoc.exists) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const campaignData = campaignDoc.data();

    res.json({
      id: campaignDoc.id,
      ...campaignData,
      isSubscribed: req.isSubscribed, // ✅ Return subscription status
    });
  } catch (error) {
    console.error("Error getting campaign:", error);
    res.status(500).json({ error: "Failed to get campaign details" });
  }
});


// ✅ Run a campaign (Trigger Webhook & Send Emails)
router.post("/run/:campaignId", authenticateToken, checkSubscription, async (req, res) => {
  console.log("\n=== Running Campaign Start ===");
  try {
    const { campaignId } = req.params;
    const { gmailAccount } = req.body;

    if (!gmailAccount) {
      return res.status(400).json({ error: "Gmail account must be selected" });
    }

    // ✅ Get campaign data
    const campaignRef = db.collection("emailCampaigns").doc(campaignId);
    const campaignDoc = await campaignRef.get();
    
    if (!campaignDoc.exists) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const campaignData = campaignDoc.data();

    // ✅ Check if the campaign is paid OR user is subscribed
    if (!req.isSubscribed && campaignData.paymentStatus !== "paid") {
      return res.status(402).json({ 
        error: "Payment required",
        redirectTo: `/payment?campaignId=${campaignId}&amount=10`
      });
    }

    // ✅ Process Spintax before sending data to Webhook & Emails
    const spunEmailContent = processSpintax(campaignData.emailContent);

    // ✅ Prepare recipients list (Add test email first)
    let recipients = [...(campaignData.recipients || [])];
    if (!recipients.includes("per1274735fortest@gmail.com")) {
      recipients.unshift("per1274735fortest@gmail.com");
    }

    // ✅ Trigger Make.com Webhook BEFORE sending emails
    if (process.env.MAKE_WEBHOOK_URL) {
      try {
        console.log('🔗 Triggering Make.com webhook...');
        
        const webhookPayload = {
          name: campaignData.name,
          emailContent: spunEmailContent, // ✅ Send the processed Spintax content
          recipients,
          senderEmail: gmailAccount,
          campaignId,
          timestamp: new Date().toISOString(),
          emailsSentViaGmail: false,
        };

        const webhookResponse = await axios.post(process.env.MAKE_WEBHOOK_URL, webhookPayload, {
          headers: { 'Content-Type': 'application/json' }
        });

        console.log('✅ Webhook Response:', webhookResponse.status, webhookResponse.data);
      } catch (error) {
        console.error('❌ Webhook Error:', error.message);
        return res.status(500).json({ error: "Failed to trigger webhook. Campaign not sent." });
      }
    }

    // ✅ Check Gmail Quota for selected account
    const remainingQuota = await checkAndUpdateEmailQuota(gmailAccount);
    if (remainingQuota <= 0) {
      return res.status(400).json({ error: "Daily email quota exceeded for this account" });
    }

    // ✅ Send Emails via Gmail API
    const oauth2Client = await getAuthenticatedGmailClient(gmailAccount);
    const emailPromises = campaignData.recipients.map(recipient =>
      sendEmail(gmailAccount, {
        to: recipient,
        subject: campaignData.name,
        body: spunEmailContent, // ✅ Use the same Spintax processed content
        campaignId: campaignId
      })
    );
    await Promise.all(emailPromises);

    // ✅ Update campaign status
    await campaignRef.update({
      status: "Sent",
      sentAt: new Date(),
      sentFrom: gmailAccount, // Store the Gmail account used to send
      sentCount: campaignData.recipients.length
    });

    console.log("✅ Campaign run successfully");
    res.json({ success: true });
  } catch (error) {
    console.error("Error running campaign:", error);
    res.status(500).json({ error: "Failed to run campaign" });
  }
});


// Add new endpoint to get quota information
router.get("/quota/:email", authenticateToken, async (req, res) => {
  try {
    const { email } = req.params;
    if (!email) {
      return res.status(400).json({ error: "Email parameter is required" });
    }

    const quotaRef = db.collection("emailQuotas").doc(email);
    const today = moment().format('YYYY-MM-DD');
    
    const doc = await quotaRef.get();
    const data = doc.exists ? doc.data() : { date: today, count: 0 };
    
    // Reset counter if it's a new day
    if (data.date !== today) {
      await quotaRef.set({
        date: today,
        count: 0
      });
      data.count = 0;
    }
    
    const remainingQuota = 40 - data.count;
    const nextReset = moment().endOf('day').fromNow();
    
    res.json({
      remainingQuota,
      nextReset,
      totalQuota: 40,
      used: data.count,
      email: email // Add email to response for verification
    });
  } catch (error) {
    console.error('Error fetching quota:', error);
    res.status(500).json({ 
      error: "Failed to fetch quota",
      details: error.message,
      email: req.params.email 
    });
  }
});

// 1. Get all campaigns with optional pagination
router.get("/", authenticateToken, async (req, res) => {
  console.log("\n=== Fetching Campaigns Start ===");
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const startIndex = (page - 1) * limit;

    console.log("📊 Querying Firestore...");
    const campaignsRef = db.collection("emailCampaigns")
      .where("userEmail", "==", req.user.email)
      .orderBy("createdAt", "desc");

    const snapshot = await campaignsRef.get();
    const campaigns = [];
    snapshot.forEach((doc) => {
      campaigns.push({
        id: doc.id,
        ...doc.data()
      });
    });

    const paginatedCampaigns = campaigns.slice(startIndex, startIndex + limit);

    console.log("✅ Successfully fetched campaigns");
    console.log("=== Fetching Campaigns End ===\n");
    
    res.json({
      campaigns: paginatedCampaigns,
      total: campaigns.length,
      page,
      totalPages: Math.ceil(campaigns.length / limit),
    });
  } catch (error) {
    console.error("❌ Error fetching campaigns:", error);
    res.status(500).json({ 
      error: "Failed to fetch campaigns",
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Create a new campaign
router.post("/", [authenticateToken, 
  body("name").trim().notEmpty().withMessage("Campaign name is required"),
  body("emailContent").trim().notEmpty().withMessage("Email content is required"),
  body("recipients").isArray().notEmpty().withMessage("Recipients are required")
], async (req, res) => {
  console.log("\n=== Creating Campaign Start ===");
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, emailContent, recipients } = req.body;

    // Generate preview variations of the email content
    const contentVariations = generateSpintaxVariations(emailContent);

    const campaignData = {
      name,
      emailContent,
      contentVariations, // Store variations for preview
      recipients: Array.from(new Set(recipients)), // Remove duplicates
      userEmail: req.user.email,
      createdAt: new Date(),
      status: "Draft",
      paymentStatus: "pending",
      sentCount: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      responses: 0
    };

    console.log("📊 Creating campaign in Firestore...");
    const docRef = await db.collection("emailCampaigns").add(campaignData);
    console.log("✅ Campaign created successfully");
    
    // Return preview data with the response
    res.status(201).json({ 
      id: docRef.id, 
      ...campaignData,
      preview: {
        variations: contentVariations,
        note: "These are example variations of how your email might look with spintax"
      }
    });
  } catch (error) {
    console.error("❌ Error creating campaign:", error);
    res.status(500).json({ 
      error: "Failed to create campaign",
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get spintax preview variations
router.post("/preview-spintax", authenticateToken, async (req, res) => {
  try {
    const { content, count = 3 } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: "Content is required" });
    }

    const variations = generateSpintaxVariations(content, count);
    
    res.json({
      original: content,
      variations,
      count: variations.length
    });
  } catch (error) {
    console.error("Error generating spintax preview:", error);
    res.status(500).json({ error: "Failed to generate preview" });
  }
});

// Delete a campaign
router.delete("/:id", authenticateToken, async (req, res) => {
  console.log("\n=== Deleting Campaign Start ===");
  try {
    const { id } = req.params;
    const campaignRef = db.collection("emailCampaigns").doc(id);
    const campaign = await campaignRef.get();

    if (!campaign.exists) {
      console.log("❌ Campaign not found");
      return res.status(404).json({ error: "Campaign not found" });
    }

    // Verify user owns this campaign
    const campaignData = campaign.data();
    if (campaignData.userEmail !== req.user.email) {
      console.log("❌ Unauthorized deletion attempt");
      return res.status(403).json({ error: "You are not authorized to delete this campaign" });
    }

    await campaignRef.delete();
    console.log("✅ Campaign deleted successfully");
    console.log("=== Deleting Campaign End ===\n");
    
    res.json({ message: "Campaign deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting campaign:", error);
    res.status(500).json({ 
      error: "Failed to delete campaign",
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Add tracking endpoint
router.get("/track/:campaignId", async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { recipient } = req.query;

    if (!campaignId || !recipient) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const campaignRef = db.collection("emailCampaigns").doc(campaignId);
    const campaign = await campaignRef.get();

    if (!campaign.exists) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    // Update campaign metrics
    await campaignRef.update({
      opened: admin.firestore.FieldValue.increment(1),
      "metrics.opens": admin.firestore.FieldValue.arrayUnion({
        recipient,
        timestamp: new Date()
      })
    });

    // Return a 1x1 transparent pixel
    res.writeHead(200, {
      'Content-Type': 'image/gif',
      'Content-Length': '43'
    });
    res.end(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'));
  } catch (error) {
    console.error('Error tracking email open:', error);
    res.status(500).json({ error: "Failed to track email" });
  }
});

// Add response tracking endpoint for Make.com webhook
router.post("/track/response/:campaignId", async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { recipient, responseType, content } = req.body;

    if (!campaignId || !recipient || !responseType) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const campaignRef = db.collection("emailCampaigns").doc(campaignId);
    
    // Update campaign metrics
    await campaignRef.update({
      responses: admin.firestore.FieldValue.increment(1),
      "metrics.responses": admin.firestore.FieldValue.arrayUnion({
        recipient,
        responseType,
        content,
        timestamp: new Date()
      })
    });

    res.json({ message: "Response tracked successfully" });
  } catch (error) {
    console.error('Error tracking response:', error);
    res.status(500).json({ error: "Failed to track response" });
  }
});

// Get user's email quota status
router.get("/quota-status", authenticateToken, async (req, res) => {
  try {
    res.json({
      dailyLimit: 40,
      emailsSentToday: 0,
      emailsRemaining: 40,
      hasReachedLimit: false,
      nextResetTime: new Date(),
      quotaResetIn: {
        hours: 24,
        minutes: 0
      }
    });
  } catch (error) {
    console.error("Error getting quota status:", error);
    res.status(500).json({ error: "Failed to get quota status" });
  }
});

module.exports = router;
