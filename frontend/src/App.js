import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LandingPage from "./components/LandingPage";
import Dashboard from "./components/Dashboard";
import EmailCampaigns from "./components/EmailCampaigns";
import Analytics from "./components/Analytics";
import Tasks from "./components/Tasks";
import Profile from "./components/Profile";
import Settings from "./components/Settings";
import Help from "./components/Help";
import PaymentPage from "./components/PaymentPage";
import AuthCallback from "./components/AuthCallback";
import ManageAccounts from "./components/ManageAccounts";
import SubscribePage from './components/SubscribePage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth-callback" element={<AuthCallback />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/email-campaigns" element={<EmailCampaigns />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/help" element={<Help />} />
        <Route path="/payment" element={<PaymentPage />} />
        <Route path="/manage-accounts" element={<ManageAccounts />} />
        <Route path="/subscribe" element={<SubscribePage />} />
      </Routes>
    </Router>
  );
}

export default App;
