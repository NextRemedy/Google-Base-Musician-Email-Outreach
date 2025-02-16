const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const bodyParser = require("body-parser");
const db = require("../db/connect"); // Firestore connection

// Middleware to parse raw body for Stripe Webhook
router.use(bodyParser.json());

// 1. Create a Payment Intent
router.post("/", async (req, res) => {
  const { amount, name, email, campaignId } = req.body;

  try {
    if (!amount || !name || !email || !campaignId) {
      console.error("Missing required fields:", { amount, name, email, campaignId });
      return res.status(400).json({
        error: "Missing required fields: amount, name, email, or campaignId.",
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert amount to cents
      currency: "gbp",
      payment_method_types: ["card"],
      receipt_email: email,
      metadata: {
        customer_name: name,
        customer_email: email,
        campaignId,
      },
    });

    console.log("Payment Intent created:", paymentIntent.id);
    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error("Error creating Payment Intent:", error.message || error);
    res.status(500).json({ error: "Failed to create Payment Intent." });
  }
});

// 2. Update campaign payment status
router.post("/confirm/:campaignId", async (req, res) => {
  const { campaignId } = req.params;
  try {
    const campaignRef = db.collection("emailCampaigns").doc(campaignId);
    const campaignDoc = await campaignRef.get();

    if (!campaignDoc.exists) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    await campaignRef.update({ paymentStatus: "paid" });
    console.log(`Campaign ${campaignId} payment status updated to Paid.`);
    res.status(200).json({ message: "Payment status updated successfully" });
  } catch (error) {
    console.error("Error updating payment status:", error);
    res.status(500).json({ error: "Failed to update payment status" });
  }
});

// 3. Stripe Webhook to Handle Events
router.post("/webhook", bodyParser.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      const campaignId = paymentIntent.metadata.campaignId;

      if (!campaignId) {
        console.error("Campaign ID missing in payment metadata.");
        return res.status(400).json({ error: "Campaign ID missing in payment metadata." });
      }

      const campaignRef = db.collection("emailCampaigns").doc(campaignId);
      const campaignDoc = await campaignRef.get();

      if (campaignDoc.exists) {
        await campaignRef.update({ paymentStatus: "paid" });
        console.log(`Campaign ${campaignId} payment status updated to Paid.`);
      } else {
        console.error(`Campaign ${campaignId} not found.`);
      }
    }

    res.status(200).send("Event received");
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

module.exports = router;
