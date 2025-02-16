import React, { useState } from "react";
import { message, Input, Button } from "antd";
import { MailOutlined } from "@ant-design/icons";
import axios from "axios"; // Import Axios for API requests
import Sidebar from "./Sidebar";
import "./styles/Help.css";

const Help = () => {
  const [feedback, setFeedback] = useState("");
  const [isFeedbackSubmitted, setIsFeedbackSubmitted] = useState(false);

  const handleFeedbackSubmit = async () => {
    if (feedback.trim()) {
      try {
        // Send feedback to the backend
        await axios.post("http://localhost:5000/help/submit-feedback", {
          feedback,
        });
        message.success("Thank you for your feedback!");
        setIsFeedbackSubmitted(true);
        setFeedback("");
      } catch (error) {
        console.error("Error submitting feedback:", error);
        message.error("Failed to submit feedback. Please try again.");
      }
    } else {
      message.error("Feedback cannot be empty.");
    }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-main">
        <div className="dashboard-header">
          <h2 className="dashboard-logo">Help</h2>
        </div>
        <div className="dashboard-content help-page">
          {/* Contact Information */}
          <div className="help-contact">
            <div className="contact-card">
              <MailOutlined className="contact-icon" />
              <h3>Need Assistance?</h3>
              <p>If you have questions or need help, email us:</p>
              <Button type="link" href="mailto:support@musicianoutreach.com">
                support@musicianoutreach.com
              </Button>
            </div>
          </div>

          {/* Feedback Section */}
          <div className="help-feedback">
            <h3>Send Us Feedback</h3>
            <p>We value your feedback to improve our platform.</p>
            <Input.TextArea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Write your feedback here..."
              className="feedback-textarea"
              disabled={isFeedbackSubmitted}
            />
            <Button
              className="feedback-submit-btn"
              onClick={handleFeedbackSubmit}
              disabled={isFeedbackSubmitted}
            >
              Submit Feedback
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Help;
