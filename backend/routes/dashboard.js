const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const db = require("../db/connect");

// Middleware to authenticate token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.user = user;
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    return res.status(403).json({ error: "Invalid token" });
  }
};

// Dashboard summary route (protected)
router.get("/", authenticateToken, async (req, res) => {
  try {
    if (!req.user || !req.user.email) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Get campaigns for the current user
    const campaignsSnapshot = await db.collection("emailCampaigns")
      .where("userEmail", "==", req.user.email)
      .get();

    const campaigns = [];
    campaignsSnapshot.forEach(doc => {
      campaigns.push({ id: doc.id, ...doc.data() });
    });

    // Calculate metrics
    const totalCampaigns = campaigns.length;
    const totalEmailsSent = campaigns.reduce((total, campaign) => total + (campaign.sentCount || 0), 0);
    const totalResponses = campaigns.reduce((total, campaign) => total + (campaign.responseCount || 0), 0);
    const totalNewLeads = campaigns.reduce((total, campaign) => total + (campaign.leadCount || 0), 0);
    const averageEngagementRate = totalEmailsSent > 0 ? ((totalResponses / totalEmailsSent) * 100).toFixed(1) : 0;

    res.json({
      totalCampaigns,
      totalEmailsSent,
      averageEngagementRate,
      totalNewLeads
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

module.exports = router;
