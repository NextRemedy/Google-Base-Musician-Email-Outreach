import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { message } from 'antd';

const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleAuth = async () => {
      try {
        const params = new URLSearchParams(location.search);
        const token = params.get('token');
        const email = params.get('email');
        const error = params.get('error');
    
        if (error) {
          console.error("Authentication error:", error);
          message.error('Authentication failed. Please try again.');
          navigate('/');
          return;
        }
    
        if (!token) {
          console.error("No token received");
          message.error('No authentication token received. Please try again.');
          navigate('/');
          return;
        }
    
        // Store the authentication data
        localStorage.setItem('token', token);
        if (email) localStorage.setItem('userEmail', email);
        
        message.success('Successfully logged in!');
        
        // Small delay to ensure token is stored
        setTimeout(() => {
          navigate('/dashboard');
        }, 100);
      } catch (error) {
        console.error("Error in auth callback:", error);
        message.error('An error occurred during authentication.');
        navigate('/');
      }
    };

    handleAuth();
  }, [navigate, location]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      backgroundColor: '#f0f2f5'
    }}>
      <div style={{ textAlign: 'center' }}>
        <h2>Completing authentication...</h2>
        <p>Please wait while we redirect you.</p>
      </div>
    </div>
  );
};

export default AuthCallback;
