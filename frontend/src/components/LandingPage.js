import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./styles/LandingPage.css";
import logo from "./images/logo.png";
import API_BASE_URL from "../config/api";

const LandingPage = () => {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [signupData, setSignupData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errorMessage, setErrorMessage] = useState(null);
  const navigate = useNavigate();

  // Handlers for modals
  const openLogin = () => setIsLoginOpen(true);
  const closeLogin = () => {
    setIsLoginOpen(false);
    setErrorMessage(null);
  };
  const openSignUp = () => setIsSignUpOpen(true);
  const closeSignUp = () => {
    setIsSignUpOpen(false);
    setErrorMessage(null);
  };

  // Input change handlers
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCredentials((prev) => ({ ...prev, [name]: value }));
  };

  const handleSignupChange = (e) => {
    const { name, value } = e.target;
    setSignupData((prev) => ({ ...prev, [name]: value }));
  };

  // Login handler
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        email: credentials.email,
        password: credentials.password,
      });
      localStorage.setItem("token", response.data.token); // Save JWT token
      alert("Login successful!");
      navigate("/dashboard"); // Redirect to dashboard
    } catch (error) {
      const message = error.response?.data?.error || "Login failed. Please try again.";
      setErrorMessage(message);
    }
  };

  // Signup handler
  const handleSignUpSubmit = async (e) => {
    e.preventDefault();
    if (signupData.password !== signupData.confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/register`, signupData);
      console.log(response.data);
      alert("Signup successful! Please log in.");
      closeSignUp(); // Close the signup modal
      setSignupData({
        username: "",
        email: "",
        password: "",
        confirmPassword: "",
      });
    } catch (error) {
      const message = error.response?.data?.error || "Signup failed. Please try again.";
      setErrorMessage(message);
    }
  };

  // Google OAuth handler
  const handleGoogleLogin = () => {
    // Redirect to backend Google OAuth endpoint
    window.location.href = `${API_BASE_URL}/api/auth/google`;
  };

  return (
    <div className="landing-page">
      <header className="landing-header">
        <img src={logo} alt="Musician Outreach Logo" className="logo" />
        <nav className="landing-nav">
          <span className="nav-link" onClick={openLogin}>
            Login
          </span>
          <span className="nav-link sign-up" onClick={openSignUp}>
            Sign Up
          </span>
        </nav>
      </header>

      <div className="landing-content">
        <h2>Reach Your Audience Like Never Before</h2>
        <p>
          Automate your email campaigns and connect with venues, fans, and promoters using tools tailored for musicians and artists.
        </p>
        <button className="get-started" onClick={openLogin}>
          Get Started
        </button>
      </div>

      <footer className="landing-footer">
         Musician Outreach Email. Built for creators.
        <a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
      </footer>

      {/* Login Modal */}
      {isLoginOpen && (
        <div className="modal">
          <div className="modal-content">
            <h2>Welcome Back!</h2>
            <form onSubmit={handleLoginSubmit}>
              {errorMessage && <p className="error-message">{errorMessage}</p>}
              <div className="input-group">
                <input
                  type="email"
                  name="email"
                  placeholder="Email"
                  value={credentials.email}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="input-group">
                <input
                  type="password"
                  name="password"
                  placeholder="Password"
                  value={credentials.password}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <button className="submit-button" type="submit">
                Log In
              </button>
            </form>
            <div className="divider">
              <span>or</span>
            </div>
            <button onClick={handleGoogleLogin} className="google-button">
              Sign in with Google
            </button>
            <button className="close-button" onClick={closeLogin}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Signup Modal */}
      {isSignUpOpen && (
        <div className="modal">
          <div className="modal-content form-container">
            <h2>Create Your Account</h2>
            <form onSubmit={handleSignUpSubmit}>
              {errorMessage && <p className="error-message">{errorMessage}</p>}
              <div className="input-group">
                <input
                  type="text"
                  name="username"
                  placeholder="Username"
                  value={signupData.username}
                  onChange={handleSignupChange}
                  required
                />
              </div>
              <div className="input-group">
                <input
                  type="email"
                  name="email"
                  placeholder="Email"
                  value={signupData.email}
                  onChange={handleSignupChange}
                  required
                />
              </div>
              <div className="input-group">
                <input
                  type="password"
                  name="password"
                  placeholder="Password"
                  value={signupData.password}
                  onChange={handleSignupChange}
                  required
                />
              </div>
              <div className="input-group">
                <input
                  type="password"
                  name="confirmPassword"
                  placeholder="Confirm Password"
                  value={signupData.confirmPassword}
                  onChange={handleSignupChange}
                  required
                />
              </div>
              <button className="submit-btn-here" type="submit">
                Sign Up
              </button>
            </form>
            <button className="close-button" onClick={closeSignUp}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
