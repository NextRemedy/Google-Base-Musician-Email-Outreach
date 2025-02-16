import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import Sidebar from "./Sidebar"; // Import your sidebar
import "./styles/Analytics.css"; // Import your styles

const Analytics = () => {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await axios.get("http://localhost:5000/api/analytics");
        setAnalyticsData(response.data);
        setError(null);
      } catch (err) {
        console.error("Error fetching analytics:", err);
        setError("Unable to fetch data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="analytics-layout">
        <Sidebar />
        <div className="analytics-main">
          <p>Loading analytics data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-layout">
        <Sidebar />
        <div className="analytics-main">
          <div className="error-message">{error}</div>
        </div>
      </div>
    );
  }

  const emailMetricsData = [
    { name: "Sent", value: analyticsData.emailMetrics.sent },
    { name: "Opened", value: analyticsData.emailMetrics.opened },
    { name: "Clicked", value: analyticsData.emailMetrics.clicked },
    { name: "Responded", value: analyticsData.emailMetrics.responded },
  ];

  return (
    <div className="analytics-layout">
      <Sidebar />
      <div className="analytics-main">
        <div className="analytics-header">
          <h2>Analytics Dashboard</h2>
        </div>

        <div className="analytics-grid">
          <div className="analytics-card">
            <h3>Email Performance Metrics</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={emailMetricsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#8884d8" name="Count" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="analytics-card">
            <h3>Campaign Performance</h3>
            <div className="metrics-grid">
              <div className="metric-item">
                <h4>Best Performing Campaign</h4>
                <p>{analyticsData.campaignPerformance.bestPerforming}</p>
              </div>
              <div className="metric-item">
                <h4>Average Response Rate</h4>
                <p>{analyticsData.campaignPerformance.averageResponse}</p>
              </div>
              <div className="metric-item">
                <h4>Total Leads Generated</h4>
                <p>{analyticsData.campaignPerformance.totalLeads}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
