const express = require("express");
const router = express.Router();
const db = require("../db/connect");

// Helper function to calculate response rate
const calculateResponseRate = (campaign) => {
  if (!campaign.recipients || campaign.recipients.length === 0) return 0;
  const responses = campaign.responses || 0;
  return (responses / campaign.recipients.length) * 100;
};

// Route to get analytics summary
router.get("/", async (req, res) => {
  try {
    // Get all campaigns from Firestore
    const campaignsSnapshot = await db.collection("emailCampaigns").get();
    const campaigns = [];
    campaignsSnapshot.forEach(doc => {
      campaigns.push({ id: doc.id, ...doc.data() });
    });

    // Calculate email metrics
    const emailMetrics = campaigns.reduce((metrics, campaign) => {
      const recipientCount = campaign.recipients ? campaign.recipients.length : 0;
      return {
        sent: metrics.sent + (campaign.status === "Sent" ? recipientCount : 0),
        opened: metrics.opened + (campaign.opened || 0),
        clicked: metrics.clicked + (campaign.clicked || 0),
        responded: metrics.responded + (campaign.responses || 0)
      };
    }, { sent: 0, opened: 0, clicked: 0, responded: 0 });

    // Find best performing campaign
    let bestCampaign = null;
    let highestResponseRate = 0;

    campaigns.forEach(campaign => {
      const responseRate = calculateResponseRate(campaign);
      if (responseRate > highestResponseRate) {
        highestResponseRate = responseRate;
        bestCampaign = campaign;
      }
    });

    // Calculate average response rate
    const totalResponseRate = campaigns.reduce((sum, campaign) => {
      return sum + calculateResponseRate(campaign);
    }, 0);
    const averageResponseRate = campaigns.length > 0 ? 
      (totalResponseRate / campaigns.length).toFixed(1) : 0;

    // Calculate total leads (for now, we'll count responses as leads)
    const totalLeads = emailMetrics.responded;

    // Get performance over time (last 6 months)
    const performanceOverTime = await getPerformanceOverTime();

    const analyticsData = {
      emailMetrics,
      campaignPerformance: {
        bestPerforming: bestCampaign ? bestCampaign.name : "No campaigns yet",
        averageResponse: `${averageResponseRate}%`,
        totalLeads
      },
      performanceOverTime
    };

    res.json(analyticsData);
  } catch (error) {
    console.error("Error fetching analytics data:", error);
    res.status(500).json({ error: "Failed to fetch analytics data." });
  }
});

// Helper function to get performance over time
async function getPerformanceOverTime() {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  try {
    const campaignsSnapshot = await db.collection("emailCampaigns")
      .where("createdAt", ">=", sixMonthsAgo)
      .orderBy("createdAt")
      .get();

    const monthlyData = {};

    campaignsSnapshot.forEach(doc => {
      const campaign = doc.data();
      const date = campaign.createdAt.toDate();
      const monthYear = `${date.getFullYear()}-${date.getMonth() + 1}`;

      if (!monthlyData[monthYear]) {
        monthlyData[monthYear] = {
          month: new Date(date.getFullYear(), date.getMonth(), 1).toLocaleString('default', { month: 'short' }),
          openRate: 0,
          clickRate: 0,
          totalEmails: 0
        };
      }

      const recipientCount = campaign.recipients ? campaign.recipients.length : 0;
      monthlyData[monthYear].totalEmails += recipientCount;
      monthlyData[monthYear].openRate += (campaign.opened || 0);
      monthlyData[monthYear].clickRate += (campaign.clicked || 0);
    });

    // Convert rates to percentages
    return Object.values(monthlyData).map(data => ({
      month: data.month,
      openRate: data.totalEmails > 0 ? Math.round((data.openRate / data.totalEmails) * 100) : 0,
      clickRate: data.totalEmails > 0 ? Math.round((data.clickRate / data.totalEmails) * 100) : 0
    }));
  } catch (error) {
    console.error("Error getting performance over time:", error);
    return [];
  }
}

module.exports = router;
