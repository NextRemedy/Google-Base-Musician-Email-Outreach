const express = require("express");
const router = express.Router();

// Mock settings data
let userSettings = {
  emailNotifications: false,
  darkMode: false,
  language: "English",
};

// Get user settings
router.get("/", (req, res) => {
  res.status(200).json(userSettings);
});

// Update user settings
router.put("/", (req, res) => {
  const { emailNotifications, darkMode, language } = req.body;

  if (emailNotifications !== undefined) {
    userSettings.emailNotifications = emailNotifications;
  }
  if (darkMode !== undefined) {
    userSettings.darkMode = darkMode;
  }
  if (language) {
    userSettings.language = language;
  }

  res.status(200).json({
    message: "Settings updated successfully",
    userSettings,
  });
});

module.exports = router;
