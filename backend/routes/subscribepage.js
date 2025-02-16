const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const bodyParser = require("body-parser");
const db = require("../db/connect"); // Firestore connection

router.use(bodyParser.json());

// Get subscription status
router.get("/status", async (req, res) => {
  try {
    // Get user email from token
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const tokenPayload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const email = tokenPayload.email;

    if (!email) {
      return res.status(400).json({ error: 'No email found in token' });
    }

    // Check user's subscription status in Firestore
    const userRef = db.collection("users").where("email", "==", email);
    const userSnapshot = await userRef.get();

    if (userSnapshot.empty) {
      return res.json({ isSubscribed: false });
    }

    const userData = userSnapshot.docs[0].data();
    const isSubscribed = userData.subscriptionStatus === "active" && 
                        userData.subscriptionType === "unlimited_plan" &&
                        new Date(userData.endDate.toDate()) > new Date();

    res.json({ isSubscribed });
  } catch (error) {
    console.error('Error checking subscription status:', error);
    res.status(500).json({ error: 'Failed to check subscription status' });
  }
});

// Create a subscription payment
router.post("/", async (req, res) => {
  const { name, email, cardDetails } = req.body;

  try {
    if (!name || !email) {
      return res.status(400).json({
        error: "Missing required fields: name or email",
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: 8000, // £80 in pence
      currency: "gbp",
      payment_method_types: ["card"],
      receipt_email: email,
      metadata: {
        customer_name: name,
        customer_email: email,
        subscription_type: "unlimited_plan"
      },
    });

    console.log("Subscription Payment Intent created:", paymentIntent.id);
    res.status(200).json({ 
      clientSecret: paymentIntent.client_secret,
      success: true 
    });
  } catch (error) {
    console.error("Error creating Subscription Payment:", error.message || error);
    res.status(500).json({ error: "Failed to create Subscription Payment." });
  }
});

// Update user subscription status
router.post("/confirm", async (req, res) => {
  const { email } = req.body;
  try {
    // Update user's subscription status in Firestore
    const userRef = db.collection("users").where("email", "==", email);
    const userSnapshot = await userRef.get();

    if (userSnapshot.empty) {
      // Create new user with subscription
      await db.collection("users").add({
        email,
        subscriptionStatus: "active",
        subscriptionType: "unlimited_plan",
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      });
    } else {
      // Update existing user
      const userDoc = userSnapshot.docs[0];
      await userDoc.ref.update({
        subscriptionStatus: "active",
        subscriptionType: "unlimited_plan",
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });
    }

    res.status(200).json({ 
      success: true,
      message: "Subscription status updated successfully" 
    });
  } catch (error) {
    console.error("Error updating subscription status:", error);
    res.status(500).json({ error: "Failed to update subscription status" });
  }
});

module.exports = router;