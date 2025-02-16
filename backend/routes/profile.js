const express = require("express");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const multer = require("multer");
const db = require("../db/connect"); // Firestore connection

const router = express.Router();
const SECRET_KEY = process.env.SECRET_KEY || "default_secret_key";

// Configure multer for file uploads
const upload = multer({ dest: "uploads/" });

// 1. Fetch User Profile
router.get("/", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1]; // Extract token from Authorization header
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Decode the token to get the user's email
    const decoded = jwt.verify(token, SECRET_KEY);
    const email = decoded.email;

    // Fetch user profile from Firestore
    const userDoc = await db.collection("users").doc(email).get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: "User profile not found" });
    }

    const userProfile = userDoc.data();

    // Exclude sensitive information like the password
    const { password, ...profileData } = userProfile;
    res.status(200).json(profileData);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

// 2. Update User Profile
router.put(
  "/",
  [
    body("email").isEmail().withMessage("Invalid email format"),
    body("username").isLength({ min: 3 }).withMessage("Username must be at least 3 characters long"),
    body("role").notEmpty().withMessage("Role is required"),
  ],
  async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1]; // Extract token from Authorization header
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      // Decode the token to get the user's email
      const decoded = jwt.verify(token, SECRET_KEY);
      const email = decoded.email;

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, role } = req.body;

      // Update the user's profile in Firestore
      const userRef = db.collection("users").doc(email);
      await userRef.update({ username, role });

      // Fetch updated user profile
      const updatedProfile = (await userRef.get()).data();

      res.status(200).json({ message: "Profile updated successfully", userProfile: updatedProfile });
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ error: "Failed to update user profile" });
    }
  }
);

// 3. Upload Profile Picture
router.post("/upload", upload.single("profilePicture"), async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1]; // Extract token from Authorization header
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Decode the token to get the user's email
    const decoded = jwt.verify(token, SECRET_KEY);
    const email = decoded.email;

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const profilePicturePath = req.file.path;

    // Update the user's profile picture in Firestore
    const userRef = db.collection("users").doc(email);
    await userRef.update({ profilePicture: profilePicturePath });

    res.status(200).json({
      message: "Profile picture uploaded successfully",
      profilePicturePath,
    });
  } catch (error) {
    console.error("Error uploading profile picture:", error);
    res.status(500).json({ error: "Failed to upload profile picture" });
  }
});

// 4. Delete User Profile
router.delete("/", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1]; // Extract token from Authorization header
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Decode the token to get the user's email
    const decoded = jwt.verify(token, SECRET_KEY);
    const email = decoded.email;

    // Delete the user's profile from Firestore
    await db.collection("users").doc(email).delete();

    res.status(200).json({ message: "User profile deleted successfully" });
  } catch (error) {
    console.error("Error deleting profile:", error);
    res.status(500).json({ error: "Failed to delete user profile" });
  }
});

module.exports = router;
