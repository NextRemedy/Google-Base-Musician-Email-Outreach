const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const session = require("express-session");
const passport = require("passport");
require("dotenv").config();
const jwt = require('jsonwebtoken');
const axios = require('axios');
const helmet = require('helmet');

const db = require("./db/connect"); // Firestore connection
const authRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profile");
const paymentRoutes = require("./routes/paymentPage");
const emailCampaignsRouter = require("./routes/emailCampaigns");
const venuesRouter = require("./routes/venues");
const dashboardRoutes = require("./routes/dashboard");
const citiesRoutes = require("./routes/cities");
const accountsRoutes = require("./routes/accounts");
const subscribeRoutes = require("./routes/subscribepage");

const app = express();

// Middleware
app.use(bodyParser.json());

// CORS configuration - more permissive for development
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "unsafe-none" }
}));

// JWT Secret check
if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is not set in environment variables!");
  process.exit(1);
}

// Only in development, disable CSP
if (process.env.NODE_ENV !== 'production') {
  app.use(helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      connectSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  }));
}

// Session middleware for Passport
app.use(
  session({
    secret: process.env.SESSION_SECRET || "default_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Authentication middleware
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

// Middleware to check subscription status
const checkSubscription = async (req, res, next) => {
  try {
    const userEmail = req.user.email;
    const subscriptionRef = db.collection("users").where("email", "==", userEmail);
    const subscriptionSnapshot = await subscriptionRef.get();

    if (!subscriptionSnapshot.empty) {
      const subscriptionData = subscriptionSnapshot.docs[0].data();
      if (subscriptionData.subscriptionStatus === "active" && 
          subscriptionData.subscriptionType === "unlimited_plan" &&
          new Date(subscriptionData.endDate.toDate()) > new Date()) {
        req.isSubscribed = true;
      } else {
        req.isSubscribed = false;
      }
    } else {
      req.isSubscribed = false;
    }

    next();
  } catch (error) {
    console.error("Error checking subscription status:", error);
    res.status(500).json({ error: "Failed to check subscription status" });
  }
};
// Run a campaign
app.post("/api/email-campaigns/:id/run", authenticateToken, checkSubscription, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Running campaign with ID: ${id}`);
    console.log(`User is subscribed: ${req.isSubscribed}`);

    const campaignRef = db.collection("emailCampaigns").doc(id);
    const campaignDoc = await campaignRef.get();

    if (!campaignDoc.exists) {
      return res.status(404).json({ error: "Campaign not found." });
    }

    const campaign = campaignDoc.data();
    if (req.isSubscribed) {
      // User is subscribed to the Unlimited Plan, skip payment
      await campaignRef.update({ paymentStatus: "paid" });
    } else if (campaign.paymentStatus !== "paid") {
      return res.status(400).json({ error: "Campaign must be paid before running." });
    }

    const webhookURL = process.env.MAKE_WEBHOOK_URL;

    await axios.post(webhookURL, {
      name: campaign.name,
      emailContent: campaign.emailContent,
      recipients: campaign.recipients,
    });

    await campaignRef.update({ status: "Sent" });

    res.json({ message: "Campaign executed successfully." });
  } catch (error) {
    console.error("Error running campaign:", error.message);
    res.status(500).json({ error: "Failed to run campaign." });
  }
});


// Routes
app.use("/api/auth", authRoutes);
app.use("/api/profile", authenticateToken, profileRoutes);
app.use("/api/payment", authenticateToken, paymentRoutes);
app.use("/api/email-campaigns", authenticateToken, emailCampaignsRouter);
app.use("/api/venues", authenticateToken, venuesRouter);
app.use("/api/dashboard", authenticateToken, dashboardRoutes);
app.use("/api/cities", authenticateToken, citiesRoutes);
app.use("/api/accounts", authenticateToken, accountsRoutes);
app.use("/api/users", authenticateToken, authRoutes);
app.use("/api/subscribe", authenticateToken, subscribeRoutes);

// Add /api/users/me endpoint
app.get("/api/users/me", authenticateToken, async (req, res) => {
  try {
    const userDoc = await db.collection("users").doc(req.user.email).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }
    const userData = userDoc.data();
    res.json(userData);
  } catch (error) {
    console.error("Error fetching user data:", error);
    res.status(500).json({ error: "Failed to fetch user data" });
  }
});

// Tasks mock data
let tasks = [
  {
    id: 1,
    title: "Follow up with venue managers",
    status: "In Progress",
    dueDate: "2025-02-01",
    completed: false,
  },
  {
    id: 2,
    title: "Draft email for album release",
    status: "Pending",
    dueDate: "2025-02-05",
    completed: true,
  },
];

// Add missing route for updating payment status
app.put("/api/email-campaigns/:id/mark-paid", async (req, res) => {
  const { id } = req.params;

  try {
    const campaignRef = db.collection("emailCampaigns").doc(id);
    const campaignDoc = await campaignRef.get();

    if (!campaignDoc.exists) {
      return res.status(404).json({ error: "Campaign not found." });
    }

    // Update payment status to "Paid"
    await campaignRef.update({ paymentStatus: "paid" });

    res.status(200).json({ message: "Payment status updated to Paid." });
  } catch (error) {
    console.error("Error updating payment status:", error.message);
    res.status(500).json({ error: "Failed to update payment status." });
  }
});

// Fetch campaigns
app.get("/api/email-campaigns", async (req, res) => {
  try {
    const snapshot = await db.collection("emailCampaigns").get();
    const campaigns = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json({ campaigns });
  } catch (error) {
    console.error("Failed to fetch campaigns:", error.message);
    res.status(500).json({ error: "Failed to fetch campaigns." });
  }
});

// Create a new campaign
app.post("/api/email-campaigns", async (req, res) => {
  try {
    const { name, emailContent, recipients } = req.body;

    if (!name || !emailContent || !recipients) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const newCampaign = {
      name,
      emailContent,
      recipients,
      status: "Draft",
      paymentStatus: "unpaid",
      engagementRate: null,
      createdAt: new Date(),
    };

    const campaignRef = await db.collection("emailCampaigns").add(newCampaign);
    res.status(201).json({ campaign: { id: campaignRef.id, ...newCampaign } });
  } catch (error) {
    console.error("Failed to create campaign:", error.message);
    res.status(500).json({ error: "Failed to create campaign." });
  }
});

// Delete a campaign
app.delete("/api/email-campaigns/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const campaignRef = db.collection("emailCampaigns").doc(id);

    await campaignRef.delete();
    res.json({ message: "Campaign deleted successfully." });
  } catch (error) {
    console.error("Failed to delete campaign:", error.message);
    res.status(500).json({ error: "Failed to delete campaign." });
  }
});

// Tasks routes
app.get("/api/tasks", (req, res) => {
  try {
    res.json({ tasks });
  } catch (error) {
    console.error("Tasks error:", error.message);
    res.status(500).json({ error: "Failed to fetch tasks." });
  }
});

app.post("/api/tasks", (req, res) => {
  try {
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ error: "Task title is required." });
    }

    const newTask = {
      id: tasks.length + 1,
      title,
      status: "In Progress",
      dueDate: "2025-02-01",
      completed: false,
    };

    tasks.push(newTask);
    res.status(201).json({ task: newTask });
  } catch (error) {
    console.error("Create task error:", error.message);
    res.status(500).json({ error: "Failed to create task." });
  }
});

// Analytics route
app.get("/api/analytics", (req, res) => {
  try {
    res.json({
      emailMetrics: { sent: 450, opened: 380, clicked: 220, responded: 85 },
      campaignPerformance: {
        bestPerforming: "Summer Tour Promotion",
        averageResponse: "28%",
        totalLeads: 45,
      },
    });
  } catch (error) {
    console.error("Analytics error:", error.message);
    res.status(500).json({ error: "Failed to fetch analytics data." });
  }
});

// Settings route
app.get("/api/settings", (req, res) => {
  try {
    res.json({
      settings: { emailNotifications: true, darkMode: false, language: "English" },
    });
  } catch (error) {
    console.error("Settings error:", error.message);
    res.status(500).json({ error: "Failed to fetch settings." });
  }
});

// Root route
app.get("/", (req, res) => {
  res.send("Backend is running.");
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!', message: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;