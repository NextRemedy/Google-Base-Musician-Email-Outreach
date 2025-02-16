import React, { useState, useEffect } from "react";
import { Switch, Select, Button, message, Tooltip } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import axios from "axios"; // Import axios for API requests
import Sidebar from "./Sidebar";
import "./styles/Settings.css";

const { Option } = Select;

const Settings = () => {
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState("en");
  const [loading, setLoading] = useState(false); // Loading state for save button

  // Fetch settings from backend
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const token = localStorage.getItem("authToken");
        console.log("Token:", token); 
        const response = await axios.get("http://localhost:5000/api/settings", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        console.log("Settings response:", response); 
        const { emailNotifications, darkMode, language } = response.data.settings;
        setEmailNotifications(emailNotifications);
        setDarkMode(darkMode);
        setLanguage(language);
      } catch (error) {
        console.error("Error fetching settings:", error);
        message.error("Failed to fetch settings!");
      }
    };

    fetchSettings();
  }, []);

  // Handle Save Changes button click
  const handleSaveChanges = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("authToken");
      const updatedSettings = { emailNotifications, darkMode, language };
      await axios.put("http://localhost:5000/api/settings", updatedSettings, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      message.success("Settings saved successfully!");
    } catch (error) {
      console.error("Error saving settings:", error);
      message.error("Failed to save settings!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-main">
        <div className="dashboard-header">
          <h2 className="dashboard-logo">Settings</h2>
        </div>
        <div className="dashboard-content settings-page">
          <h3 className="settings-title">Application Settings</h3>
          <p>Customize your preferences below:</p>
          <div className="settings-options">
            {/* Enable Email Notifications */}
            <div className="settings-item">
              <span>
                Enable Email Notifications{" "}
                <Tooltip title="Receive email updates for campaigns">
                  <InfoCircleOutlined />
                </Tooltip>
              </span>
              <Switch
                checked={emailNotifications}
                onChange={setEmailNotifications}
              />
            </div>

            {/* Dark Mode */}
            <div className="settings-item">
              <span>
                Dark Mode{" "}
                <Tooltip title="Switch between light and dark themes">
                  <InfoCircleOutlined />
                </Tooltip>
              </span>
              <Switch checked={darkMode} onChange={setDarkMode} />
            </div>

            {/* Language Selection */}
            <div className="settings-item">
              <span>
                Language{" "}
                <Tooltip title="Change application language">
                  <InfoCircleOutlined />
                </Tooltip>
              </span>
              <Select
                value={language}
                onChange={setLanguage}
                style={{ width: 120 }}
              >
                <Option value="en">English</Option>
                <Option value="es">Spanish</Option>
                <Option value="fr">French</Option>
              </Select>
            </div>

            {/* Save Changes Button */}
            <Button
              className="save-settings-btn"
              onClick={handleSaveChanges}
              loading={loading} // Show loading spinner when saving
            >
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
