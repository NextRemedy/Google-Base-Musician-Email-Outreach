import React, { useState, useEffect, useCallback } from "react";
import { Table, Button, Modal, Form, Input, message, Space, Select } from "antd";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../utils/axios";
import Sidebar from "./Sidebar"; 
import "./styles/EmailCampaigns.css";
import { convertToSpintax, generateSpintaxVariations } from '../utils/spintax';
import moment from 'moment';

const { TextArea } = Input;

const EmailCampaigns = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isDetailsModalVisible, setIsDetailsModalVisible] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [isGmailModalVisible, setIsGmailModalVisible] = useState(false);
  const [gmailAccounts, setGmailAccounts] = useState([]);
  const [selectedGmailAccount, setSelectedGmailAccount] = useState(null);
  const [cities, setCities] = useState([]);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [spintaxPreview, setSpintaxPreview] = useState([]);
  const [isSpintaxModalVisible, setIsSpintaxModalVisible] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);

  // Check subscription status
  const checkSubscriptionStatus = useCallback(async () => {
    try {
      const response = await axiosInstance.get("/api/subscribe/status");
      setIsSubscribed(response.data.isSubscribed);
    } catch (error) {
      console.error("Error checking subscription status:", error);
    }
  }, []);

  useEffect(() => {
    checkSubscriptionStatus();
  }, [checkSubscriptionStatus]);

  // Fetch campaigns from backend
  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get("/api/email-campaigns");
      setCampaigns(response.data.campaigns || []);
    } catch (error) {
      console.error("Error fetching campaigns:", error.response?.data || error.message);
      message.error(error.response?.data?.error || "Failed to fetch campaigns");
      if (error.response?.status === 401) {
        navigate("/login");
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  // Fetch cities from backend
  const fetchCities = useCallback(async () => {
    try {
      const response = await axiosInstance.get("/api/venues/cities");
      console.log('Cities response:', response.data);
      setCities(response.data.cities || []);
    } catch (error) {
      console.error('Error fetching cities:', error);
      message.error("Failed to fetch cities");
    }
  }, []);

  // Fetch venues when city is selected
  const fetchVenuesByCity = useCallback(async (city) => {
    try {
      const response = await axiosInstance.get(`/api/venues/by-city/${encodeURIComponent(city)}`);
      const venueEmails = response.data.venues.map(venue => venue.email).filter(Boolean);
      form.setFieldsValue({
        recipients: venueEmails.join(", ")
      });
    } catch (error) {
      message.error("Failed to fetch venues");
    }
  }, [form]);

  // Handle city selection
  const handleCityChange = (value) => {
    if (value) {
      fetchVenuesByCity(value);
    } else {
      form.setFieldsValue({
        recipients: ""
      });
    }
  };

  // Load Gmail accounts
  const loadGmailAccounts = useCallback(() => {
    const savedAccounts = localStorage.getItem('gmailAccounts');
    if (savedAccounts) {
      setGmailAccounts(JSON.parse(savedAccounts));
    }
  }, []);

  useEffect(() => {
    fetchCities();
    fetchCampaigns();
    checkSubscriptionStatus();
    loadGmailAccounts();
  }, [fetchCities, fetchCampaigns, checkSubscriptionStatus, loadGmailAccounts]);

  // Create new campaign
  const handleCreateCampaign = async (values) => {
    try {
      const { name, city, emailContent, recipients } = values;
      
      // Validate email content
      if (!emailContent || emailContent.trim() === '') {
        message.error('Please input email content');
        return;
      }

      // Convert recipients string to array if it's not already
      const recipientsArray = typeof recipients === 'string' 
        ? recipients.split(',').map(email => email.trim())
        : recipients;

      const response = await axiosInstance.post(
        "/api/email-campaigns",
        {
          name,
          city,
          emailContent: emailContent.trim(),
          recipients: recipientsArray
        }
      );

      if (response.data) {
        message.success("Campaign created successfully");
        setIsModalVisible(false);
        form.resetFields();
        fetchCampaigns(); // Refresh the campaigns list
      }
    } catch (error) {
      console.error('Error creating campaign:', error.response?.data || error.message);
      message.error(error.response?.data?.error || "Failed to create campaign");
      if (error.response?.status === 401) {
        navigate("/login");
      }
    }
  };
  const handleRunCampaign = async (campaignId) => {
    try {
      // Fetch campaign details
      const { data: campaign } = await axiosInstance.get(`/api/email-campaigns/${campaignId}`);
  
      console.log("Campaign Details:", campaign);
  
      // ✅ Fix: Check if user is subscribed (req.isSubscribed should be in the API response)
      if (!campaign.isSubscribed && campaign.paymentStatus !== 'paid') {
        // If the user is not subscribed and the campaign is not paid, show the payment page
        navigate(`/payment?campaignId=${campaignId}&amount=10`);
        return;
      }
  
      // ✅ If the user is subscribed OR the campaign is already paid, show Gmail account selection modal
      setIsGmailModalVisible(true);
      setSelectedCampaignId(campaignId);
    } catch (error) {
      console.error('Error:', error);
      message.error('Failed to run campaign');
    }
  };
  
  const handleGmailAccountSelect = async () => {
    if (!selectedGmailAccount) {
      message.error("Please select a Gmail account");
      return;
    }

    try {
      setLoading(true);
      
      const response = await axiosInstance.post(`/api/email-campaigns/run/${selectedCampaignId}`, {
        gmailAccount: selectedGmailAccount
      });
      
      if (response.data.success) {
        message.success("Campaign started successfully!");
        fetchCampaigns(); // Refresh the campaigns list
      }
    } catch (error) {
      console.error("Error running campaign:", error);
      message.error(error.response?.data?.error || "Failed to run campaign");
    } finally {
      setLoading(false);
      setIsGmailModalVisible(false);
      setSelectedCampaignId(null);
    }
  };

  // Handle deleting a campaign
  const handleDeleteCampaign = async (campaignId) => {
    try {
      await axiosInstance.delete(`/api/email-campaigns/${campaignId}`);
      message.success("Campaign deleted successfully!");
      fetchCampaigns();
    } catch (error) {
      message.error(error.response?.data?.error || "Failed to delete campaign");
      if (error.response?.status === 401) {
        navigate("/login");
      }
    }
  };

  const handleSpintaxConvert = () => {
    const currentText = form.getFieldValue('emailContent');
    const spintaxText = convertToSpintax(currentText);
    const variations = generateSpintaxVariations(spintaxText, 5);
    setSpintaxPreview(variations);
    setIsSpintaxModalVisible(true);
  };

// Handle showing campaign details
const showCampaignDetails = (campaign) => {
  let createdAtFormatted = 'N/A';

  if (campaign.createdAt) {
    if (campaign.createdAt.toDate) {
      // If it's a Firestore Timestamp, convert it
      createdAtFormatted = moment(campaign.createdAt.toDate()).format('MMMM D, YYYY h:mm A');
    } else {
      // If it's already a Date or string, convert it properly
      createdAtFormatted = moment(new Date(campaign.createdAt)).format('MMMM D, YYYY h:mm A');
    }
  }

  const formattedCampaign = {
    ...campaign,
    createdAt: createdAtFormatted
  };

  setSelectedCampaign(formattedCampaign);
  setIsDetailsModalVisible(true);
};


  // Define table columns
  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "Recipients",
      dataIndex: "recipients",
      key: "recipients",
      render: (recipients) => recipients.length,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
    },
    {
      title: "Payment Status",
      dataIndex: "paymentStatus",
      key: "paymentStatus",
      render: (paymentStatus) => (
        <span className={`payment-status-${paymentStatus}`}>
          {paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
        </span>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            onClick={() => handleRunCampaign(record.id)}
            disabled={record.status === "Sent"}
          >
            Run Campaign
          </Button>
          {record.paymentStatus === "unpaid" && (
            <Button
              onClick={() =>
                navigate(`/payment?campaignId=${record.id}&amount=10`)
              }
            >
              Pay Now
            </Button>
          )}
          <Button
            type="default"
            onClick={() => showCampaignDetails(record)}
          >
            Details
          </Button>
          <Button
            type="primary"
            danger
            onClick={() => handleDeleteCampaign(record.id)}
          >
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  const handleSubscribeClick = () => {
    navigate('/subscribe');
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-main">
        <div className="campaigns-header">
          <h1>Email Campaigns</h1>
          {isSubscribed ? (
            <Button className="subscription-status-btn" disabled>
              Already Subscribed
            </Button>
          ) : (
            <Button
              type="primary"
              className="subscribe-btn"
              onClick={handleSubscribeClick}
            >
              Subscribe Now!
            </Button>
          )}
          <Button
            type="primary"
            onClick={() => setIsModalVisible(true)}
            className="create-campaign-btn"
          >
            Create Campaign
          </Button>
        </div>

        <Table
          dataSource={campaigns}
          columns={columns}
          loading={loading}
          rowKey="id"
        />

        {/* Create Campaign Modal */}
        <Modal
          title="Create New Campaign"
          visible={isModalVisible}
          onCancel={() => {
            setIsModalVisible(false);
            form.resetFields();
          }}
          footer={null}
        >
          <Form 
            form={form} 
            onFinish={handleCreateCampaign} 
            layout="vertical"
            initialValues={{
              emailContent: '',
              recipients: ''
            }}
          >
            <Form.Item
              name="name"
              label={<span style={{ color: '#000000' }}>Campaign Name/Subject</span>}
              rules={[{ required: true, message: "Please input campaign name!" }]}
            >
              <Input placeholder="Enter your campaign name" />
            </Form.Item>

            <Form.Item
              name="city"
              label={<span style={{ color: '#000000' }}>Select City</span>}
              rules={[{ required: true, message: "Please select a city!" }]}
            >
              <Select
                onChange={handleCityChange}
                placeholder="Select a city"
                allowClear
              >
                {cities.map((city) => (
                  <Select.Option key={city} value={city}>
                    {city}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="recipients"
              label={<span style={{ color: '#000000' }}>Recipients</span>}
              rules={[{ required: true, message: "Please input recipients!" }]}
            >
              <TextArea rows={4} placeholder="Enter recipients (separated by commas)" />
            </Form.Item>

            <Form.Item
              name="emailContent"
              label={<span style={{ color: '#000000' }}>Email Content</span>}
              rules={[
                { 
                  required: true, 
                  message: "Please input email content!",
                  validator: (_, value) => {
                    if (!value || value.trim() === '') {
                      return Promise.reject('Please input email content!');
                    }
                    return Promise.resolve();
                  }
                }
              ]}
            >
              <TextArea 
                rows={6} 
                placeholder="Enter email content"
                onChange={(e) => {
                  form.setFieldsValue({ emailContent: e.target.value });
                }}
              />
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                Change your words with Spintax?
              </div>
            </Form.Item>

            <Space>
              <Button onClick={handleSpintaxConvert} type="default">
                Preview with Spintax
              </Button>
              <Button 
                type="primary" 
                htmlType="submit"
                onClick={() => {
                  const content = form.getFieldValue('emailContent');
                  if (!content || content.trim() === '') {
                    message.error('Please input email content');
                    return;
                  }
                }}
              >
                Create Campaign
              </Button>
            </Space>
          </Form>
        </Modal>

        {/* Campaign Details Modal */}
        <Modal
          title="Campaign Details"
          visible={isDetailsModalVisible}
          onCancel={() => setIsDetailsModalVisible(false)}
          footer={null}
        >
          {selectedCampaign && (
            <div>
              <p><strong>Name:</strong> {selectedCampaign.name}</p>
              <p><strong>Status:</strong> {selectedCampaign.status}</p>
              <p><strong>Created At:</strong> {selectedCampaign.createdAt}</p>
              <p><strong>Recipients:</strong></p>
              <TextArea
                value={selectedCampaign.recipients.join(", ")}
                readOnly
                rows={4}
              />
              <p><strong>Email Content:</strong></p>
              <TextArea
                value={selectedCampaign.emailContent}
                readOnly
                rows={6}
              />
            </div>
          )}
        </Modal>

        <Modal
          title="Spintax Preview"
          visible={isSpintaxModalVisible}
          onCancel={() => setIsSpintaxModalVisible(false)}
          width={800}
          footer={[
            <Button key="back" onClick={() => setIsSpintaxModalVisible(false)}>
              Cancel
            </Button>,
    <Button
    key="submit"
    type="primary"
    onClick={() => {
      if (spintaxPreview.length > 0) {
        const randomVariation = spintaxPreview[Math.floor(Math.random() * spintaxPreview.length)];
        form.setFieldsValue({ emailContent: randomVariation });
        message.success("Email content updated with Spintax!");
        setIsSpintaxModalVisible(false);
      } else {
        message.error("No Spintax variations found.");
      }
    }}
  >
    Use Spintax Template
  </Button>,
          ]}
        >
          <div>
            <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
              <h4 style={{ marginBottom: '10px' }}>Two options:</h4>
              <ol style={{ paddingLeft: '20px' }}>
                <li>Click any variation below to use that specific version</li>
                <li>Or click "Use Spintax Template" to get random variations for each recipient</li>
              </ol>
            </div>
            
            {spintaxPreview.map((variation, index) => (
              <div 
                key={index} 
                style={{ 
                  marginBottom: '20px', 
                  padding: '15px',
                  border: '1px solid #e8e8e8',
                  borderRadius: '4px',
                  position: 'relative'
                }}
              >
                <div style={{ marginBottom: '10px' }}>
                  <strong>Variation {index + 1}:</strong>
                </div>
                <div style={{ 
                  whiteSpace: 'pre-wrap',
                  marginBottom: '10px',
                  paddingRight: '80px' // Make room for the button
                }}>
                  {variation}
                </div>
                <Button
                  type="primary"
                  size="small"
                  style={{
                    position: 'absolute',
                    right: '15px',
                    top: '15px'
                  }}
                  onClick={() => {
                    form.setFieldsValue({ emailContent: variation });
                    message.success('Email content updated!');
                    setIsSpintaxModalVisible(false);
                  }}
                >
                  Click to Use
                </Button>
              </div>
            ))}
          </div>
        </Modal>

        {/* Gmail Account Selection Modal */}
        <Modal
          title="Select Gmail Account"
          visible={isGmailModalVisible}
          onOk={handleGmailAccountSelect}
          onCancel={() => {
            setIsGmailModalVisible(false);
            setSelectedGmailAccount(null);
          }}
          okText="Run Campaign"
          cancelText="Cancel"
        >
          <div className="gmail-account-selection">
            <p>Select the Gmail account to use for sending this campaign:</p>
            <Select
              style={{ width: '100%' }}
              placeholder="Select Gmail Account"
              value={selectedGmailAccount}
              onChange={(value) => setSelectedGmailAccount(value)}
            >
              {gmailAccounts.map((email) => (
                <Select.Option key={email} value={email}>
                  {email}
                </Select.Option>
              ))}
            </Select>
          </div>
        </Modal>
        
      </div>
    </div>
  );
};

export default EmailCampaigns;
