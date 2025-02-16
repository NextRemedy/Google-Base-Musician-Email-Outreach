const express = require("express");
const router = express.Router();
const db = require("../db/connect");
const { body, validationResult } = require("express-validator");

// Default cities if no venues exist
const defaultCities = [
  "New York",
  "Los Angeles",
  "Chicago",
  "Austin",
  "Nashville",
  "Seattle",
  "San Francisco",
  "Miami",
  "Boston",
  "Portland"
];

// Get all cities
router.get("/cities", async (req, res) => {
  try {
    console.log("Fetching cities...");
    const cities = new Set(defaultCities); // Start with default cities
    
    // Get cities from venues collection
    const venuesSnapshot = await db.collection("venues")
      .select("city")
      .get();
    
    venuesSnapshot.forEach(doc => {
      const venue = doc.data();
      if (venue.city) {
        cities.add(venue.city);
      }
    });

    const sortedCities = Array.from(cities).sort();
    console.log("Available cities:", sortedCities);
    
    res.json({ cities: sortedCities });
  } catch (error) {
    console.error("Error fetching cities:", error);
    res.status(500).json({ error: "Failed to fetch cities" });
  }
});

// Get venues by city
router.get("/by-city/:city", async (req, res) => {
  try {
    const { city } = req.params;
    console.log("Fetching venues for city:", city);
    
    const venuesSnapshot = await db.collection("venues")
      .where("city", "==", city)
      .get();
    
    const venues = [];
    venuesSnapshot.forEach(doc => {
      venues.push({
        id: doc.id,
        ...doc.data()
      });
    });

    console.log(`Found ${venues.length} venues for ${city}`);
    res.json({ venues });
  } catch (error) {
    console.error("Error fetching venues:", error);
    res.status(500).json({ error: "Failed to fetch venues" });
  }
});

// Add a new venue
router.post("/", 
  body("name").notEmpty().trim(),
  body("email").isEmail().normalizeEmail(),
  body("city").notEmpty().trim(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { name, email, city, address = "", phone = "" } = req.body;
      
      const venueRef = await db.collection("venues").add({
        name,
        email,
        city,
        address,
        phone,
        createdAt: new Date()
      });

      res.status(201).json({
        id: venueRef.id,
        name,
        email,
        city,
        address,
        phone
      });
    } catch (error) {
      console.error("Error creating venue:", error);
      res.status(500).json({ error: "Failed to create venue" });
    }
});

module.exports = router;
