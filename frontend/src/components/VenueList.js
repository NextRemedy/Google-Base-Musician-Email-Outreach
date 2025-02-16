import React, { useState, useEffect, useCallback } from "react";

const VenueList = () => {
  const [venues, setVenues] = useState([]);
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchVenues = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`http://localhost:5000/venues?city=${city}`);
      if (!response.ok) {
        throw new Error("Failed to fetch venues");
      }

      const data = await response.json();
      setVenues(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [city]); // Dependency array includes `city`

  useEffect(() => {
    fetchVenues();
  }, [fetchVenues]);

  return (
    <div>
      <h2>Venue List</h2>
      <label>
        Filter by City:
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Enter city name"
        />
      </label>
      <button onClick={fetchVenues}>Search</button>

      {loading && <p>Loading venues...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      <ul>
        {venues.map((venue) => (
          <li key={venue.id}>
            {venue.name} ({venue.city}) - {venue.email}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default VenueList;
