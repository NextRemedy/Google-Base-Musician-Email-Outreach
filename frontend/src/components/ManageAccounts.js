import React, { useState, useEffect, useCallback } from "react";
import { message } from "antd";
import { ArrowLeftOutlined, PlusOutlined } from "@ant-design/icons";
import { auth } from "../firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import "./styles/ManageAccounts.css";
import Sidebar from "./Sidebar";
import axiosInstance from "../utils/axios";

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const ManageAccounts = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [authorizedAccounts, setAuthorizedAccounts] = useState([]);
  const [quotas, setQuotas] = useState({});
  const [loadingQuotas, setLoadingQuotas] = useState(false);
  const [totalRemainingQuota, setTotalRemainingQuota] = useState(0);
  const navigate = useNavigate();

  // Load accounts from localStorage and check authorization status
  const loadAccounts = useCallback(async () => {
    try {
      const savedAccounts = localStorage.getItem("gmailAccounts");
      if (savedAccounts) {
        const parsedAccounts = JSON.parse(savedAccounts);
        setAccounts(parsedAccounts);
      }

      const response = await axiosInstance.get("/api/auth/accounts/gmail");
      if (response.data && response.data.accounts) {
        const authorizedEmails = response.data.accounts
          .filter((account) => account.isAuthorized)
          .map((account) => account.email);
        setAuthorizedAccounts(authorizedEmails);
      }
    } catch (error) {
      console.error("Error loading accounts:", error);
      if (error.response?.status === 401) {
        // Handle unauthorized error
        return;
      }
      message.error("Failed to load accounts. Please try again.");
    }
  }, []);

  // Fetch quotas for all accounts
  const fetchQuotas = useCallback(async () => {
    if (!accounts.length) return;
  
    setLoadingQuotas(true);
    try {
      const quotaPromises = accounts
        .filter((account) => authorizedAccounts.includes(account))
        .map((account) =>
          axiosInstance.get(`/api/emailCampaigns/quota/${encodeURIComponent(account)}`)
        );
  
      const results = await Promise.all(quotaPromises);
      const newQuotas = {};
      let totalRemaining = 0;
  
      results.forEach((result, index) => {
        if (result?.data) {
          newQuotas[accounts[index]] = result.data;
          totalRemaining += result.data.remainingQuota;
        } else {
          console.error(`No data for account: ${accounts[index]}`);
        }
      });
  
      setQuotas(newQuotas);
      setTotalRemainingQuota(totalRemaining);
    } catch (error) {
      console.error("Error fetching quotas:", error);
      message.error("Failed to fetch quotas. Please try again.");
    } finally {
      setLoadingQuotas(false);
    }
  }, [accounts, authorizedAccounts]);

  // Initialize data and set up polling
  useEffect(() => {
    const initializeData = async () => {
      await loadAccounts();
    };

    initializeData();

    // Set up polling interval
    const accountsInterval = setInterval(initializeData, 30000); // Poll every 30 seconds
    return () => clearInterval(accountsInterval);
  }, [loadAccounts]);

  // Separate useEffect for quota polling
  useEffect(() => {
    if (accounts.length > 0) {
      fetchQuotas();
      const quotasInterval = setInterval(fetchQuotas, 30000); // Poll every 30 seconds
      return () => clearInterval(quotasInterval);
    }
  }, [accounts, fetchQuotas]);

  // Check URL parameters for OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success");
    const error = params.get("error");
    const token = params.get("token");

    if (success === "true") {
      if (token) {
        localStorage.setItem("token", token);
      }
      message.success("Account successfully authorized!");
      loadAccounts();
      window.history.replaceState({}, "", window.location.pathname);
    } else if (error) {
      message.error("Failed to authorize account. Please try again.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [loadAccounts]);

  const handleBack = () => {
    navigate(-1);
  };

  const authorizeAccount = async (email) => {
    try {
      localStorage.setItem("authorizingEmail", email);
      window.location.href = `http://localhost:5000/api/auth/google?email=${encodeURIComponent(email)}&isNewAccount=true`;
    } catch (error) {
      console.error("Error authorizing account:", error);
      message.error("Failed to authorize account. Please try again.");
    }
  };

  const addAccount = async () => {
    if (loading) return;

    try {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      const result = await signInWithPopup(auth, provider);
      if (!result.user?.email) {
        throw new Error("No email provided");
      }

      const email = result.user.email;
      if (accounts.includes(email)) {
        message.warning("This account is already added");
        return;
      }

      setAccounts((prev) => {
        const newAccounts = [...prev, email];
        localStorage.setItem("gmailAccounts", JSON.stringify(newAccounts));
        return newAccounts;
      });

      await authorizeAccount(email);
    } catch (error) {
      console.error("Error adding account:", error);
      if (error.code === "auth/popup-closed-by-user") {
        message.info("Account addition cancelled");
      } else {
        message.error("Failed to add account. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const removeAccount = async (email) => {
    try {
      setAccounts((prev) => {
        const newAccounts = prev.filter((acc) => acc !== email);
        localStorage.setItem("gmailAccounts", JSON.stringify(newAccounts));
        return newAccounts;
      });

      await axiosInstance.delete(`/api/auth/revoke-access/${encodeURIComponent(email)}`);
      message.success("Account removed successfully");
    } catch (error) {
      console.error("Error removing account:", error);
      message.error("Failed to remove account. Please try again.");
    }
  };

  const getInitials = (email) => {
    return email.charAt(0).toUpperCase();
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-main">
        <div className="manage-accounts-container">
          <div className="manage-accounts-header">
            <button className="back-button" onClick={handleBack}>
              <ArrowLeftOutlined /> Back
            </button>
            <h1>Manage Gmail Accounts</h1>
            <p className="quota-info">
            Quota: 4{totalRemainingQuota} / 40 per day
            </p>
          </div>

          <div className="accounts-section">
            <div className="accounts-section-header">
              <div className="accounts-section-title">
                Gmail Accounts
                <span className="account-count">{accounts.length}</span>
              </div>
            </div>

            <div className="accounts-list">
              {loadingQuotas ? (
                <div className="loading-spinner">Fetching quotas...</div>
              ) : (
                accounts.map((email) => (
                  <div key={email} className="account-item">
                    <div className="account-info">
                      <div className="account-avatar">{getInitials(email)}</div>
                      <span className="account-email">{email}</span>
                    </div>
                    <div className="account-actions">
                      {authorizedAccounts.includes(email) ? (
                        <span className="account-status authorized">Authorized ✓</span>
                      ) : (
                        <button
                          className="authorize-button"
                          onClick={() => authorizeAccount(email)}
                        >
                          Active ✓
                        </button>
                      )}
                      <button
                        className="remove-button"
                        onClick={() => removeAccount(email)}
                      >
                        ×
                      </button>
                    </div>
                    {quotas[email] && (
                      <div className="quota-info">
                        <span>Emails remaining today: {quotas[email].remainingQuota}</span>
                        <span>Resets: {quotas[email].nextReset}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="add-account-section">
            <div className="add-account-form">
              <button
                className="add-button"
                onClick={addAccount}
                disabled={loading}
              >
                <PlusOutlined /> Add Account
              </button>
            </div>
          </div>

          <div className="notes-card">
            <div className="notes-list">
            <div className="notes-list-item">
                • You can use the added account to send Campaigns emails
              </div>
              <div className="notes-list-item">
                • (Optional) Switch account if you hit the daily limit (Click "Active ✓" to switch Account)
              </div>
              <div className="notes-list-item">
                • Check the profile in the sidebar to ensure the correct account is selected
              </div>
              <div className="notes-list-item">
                • All email campaigns will be sent from the selected account
              </div>
              <div className="notes-list-item">
                • Make sure the account has Gmail API access enabled
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageAccounts;
