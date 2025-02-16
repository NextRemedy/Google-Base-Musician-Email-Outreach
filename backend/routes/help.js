const express = require("express");
const { body, validationResult } = require("express-validator");

const router = express.Router();

// In-memory feedback storage (for now)
let feedbacks = [];

// Route to submit feedback
router.post(
  "/submit-feedback",
  [
    body("feedback")
      .notEmpty()
      .withMessage("Feedback cannot be empty")
      .isLength({ max: 500 })
      .withMessage("Feedback cannot exceed 500 characters"),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { feedback } = req.body;
    const timestamp = new Date();

    // Add feedback to the mock storage
    feedbacks.push({ feedback, timestamp });
    res.status(201).json({ message: "Feedback submitted successfully", feedbacks });
  }
);

// Route to get all feedback
router.get("/all-feedbacks", (req, res) => {
  res.status(200).json(feedbacks);
});

// Route to delete all feedbacks (for cleanup/testing)
router.delete("/clear-feedbacks", (req, res) => {
  feedbacks = [];
  res.status(200).json({ message: "All feedbacks cleared successfully" });
});

module.exports = router;
