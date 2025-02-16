import React, { useState } from 'react';
import { Card, Button, Row, Col, Typography, List, Modal, Form, Input, message } from 'antd';
import { CheckOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import axios from "axios";
import './styles/SubscribePage.css';

const { Title, Text } = Typography;

// Initialize Stripe with your publishable key
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

const SubscribeForm = () => {
  const navigate = useNavigate();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const stripe = useStripe();
  const elements = useElements();

  const handleSubscribe = (plan) => {
    if (plan.title === 'Pay Per Campaign') {
      navigate('/email-campaigns');
    } else {
      setIsModalVisible(true);
    }
  };

  const handleReturn = () => {
    navigate('/email-campaigns');
  };

  const handlePayment = async (values) => {
    setLoading(true);
    try {
      if (!stripe || !elements) {
        throw new Error("Stripe is not properly loaded. Please try again.");
      }

      const token = localStorage.getItem('token');
      if (!token) {
        message.error('Please log in to make a payment');
        navigate('/login');
        return;
      }

      // Get email from token
      const tokenPayload = JSON.parse(atob(token.split('.')[1]));
      const userEmail = tokenPayload.email;

      if (!userEmail) {
        throw new Error("User email not found in token");
      }

      const { data } = await axios.post(
        "http://localhost:5000/api/subscribe",
        {
          name: values.name,
          email: userEmail,
          amount: 8000,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const { clientSecret } = data;
      if (!clientSecret) {
        throw new Error("Failed to create payment intent. Please try again.");
      }

      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement),
          billing_details: {
            name: values.name,
            email: userEmail,
          },
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (paymentIntent.status === "succeeded") {
        // Update subscription status
        await axios.post(
          "http://localhost:5000/api/subscribe/confirm",
          { email: userEmail },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        message.success('Payment successful! Redirecting to Email Campaigns...');
        setIsModalVisible(false);
        form.resetFields();
        setTimeout(() => {
          navigate('/email-campaigns');
        }, 2000);
      }
    } catch (error) {
      console.error('Payment error:', error);
      message.error(error.message || 'Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    form.resetFields();
  };

  // Handle ZIP code input to only allow numbers
  const handleZipCodeChange = (e) => {
    const { value } = e.target;
    const numericValue = value.replace(/[^0-9]/g, '');
    form.setFieldsValue({ zipCode: numericValue });
  };

  const plans = [
    {
      title: 'Unlimited Plan',
      price: '£80',
      period: '/month',
      features: [
        'Unlimited email campaigns',
        'Priority support',
        'Advanced analytics',
        'Custom templates',
        'API access',
        'Team collaboration'
      ],
      buttonText: 'Subscribe Now',
      recommended: true
    },
    {
      title: 'Pay Per Campaign',
      price: '£10',
      period: '/campaign/month',
      features: [
        'Pay as you go',
        'Basic analytics',
        'Standard templates',
        'Email support',
        'Single user access',
        'Basic features'
      ],
      buttonText: 'Get Started',
      recommended: false
    }
  ];

  return (
    <div className="subscribe-container">
      <Button 
        className="return-button"
        type="primary"
        icon={<ArrowLeftOutlined />}
        onClick={handleReturn}
      >
        Back to Email Campaigns
      </Button>

      <div className="subscribe-header">
        <Title level={1}>Choose Your Plan</Title>
        <Text className="subtitle">
          Select the perfect plan for your email campaign needs
        </Text>
      </div>

      <Row gutter={[24, 24]} justify="center" className="pricing-row">
        {plans.map((plan) => (
          <Col xs={24} md={12} lg={8} key={plan.title}>
            <Card 
              className={`pricing-card ${plan.recommended ? 'recommended' : ''}`}
              title={
                <div className="card-header">
                  {plan.recommended && <div className="recommended-badge">RECOMMENDED</div>}
                  <Title level={2}>{plan.title}</Title>
                  <div className="price">
                    <span className="amount">{plan.price}</span>
                    <span className="period">{plan.period}</span>
                  </div>
                </div>
              }
            >
              <List
                className="features-list"
                dataSource={plan.features}
                renderItem={feature => (
                  <List.Item>
                    <CheckOutlined className="check-icon" /> {feature}
                  </List.Item>
                )}
              />
              <Button
                type="primary"
                size="large"
                block
                className={`subscribe-button ${plan.recommended ? 'recommended-button' : ''}`}
                onClick={() => handleSubscribe(plan)}
              >
                {plan.buttonText}
              </Button>
            </Card>
          </Col>
        ))}
      </Row>

      <Modal
        title="Payment Details"
        visible={isModalVisible}
        onCancel={handleCancel}
        footer={null}
        className="payment-modal"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handlePayment}
        >
          <Form.Item
            label={<span style={{ color: '#000000' }}>Name</span>}
            name="name"
            rules={[{ required: true, message: 'Please enter your name' }]}
          >
            <Input placeholder="Enter your full name" />
          </Form.Item>

          <Form.Item
            label={<span style={{ color: '#000000' }}>Email</span>}
            name="email"
            rules={[
              { required: true, message: 'Please enter your email' },
              { type: 'email', message: 'Please enter a valid email' }
            ]}
          >
            <Input placeholder="Enter your email" />
          </Form.Item>

          <Form.Item
            label={<span style={{ color: '#000000' }}>Price</span>}
            name="price"
            initialValue="£80"
          >
            <Input disabled className="price-input" />
          </Form.Item>

          <Form.Item label={<span style={{ color: '#000000' }}>Card Details</span>} required>
            <CardElement
              options={{
                style: {
                  base: {
                    fontSize: '16px',
                    color: '#424770',
                    '::placeholder': {
                      color: '#aab7c4',
                    },
                  },
                  invalid: {
                    color: '#9e2146',
                  },
                },
              }}
            />
          </Form.Item>

          <Form.Item
            label={<span style={{ color: '#000000' }}>ZIP Code</span>}
            name="zipCode"
            rules={[
              { required: true, message: 'Please enter your ZIP code' },
              { pattern: /^[0-9]+$/, message: 'ZIP code must contain only numbers' }
            ]}
          >
            <Input 
              placeholder="Enter ZIP code" 
              maxLength={8}
              onChange={handleZipCodeChange}
            />
          </Form.Item>

          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              block 
              size="large"
              loading={loading}
              disabled={!stripe}
            >
              Pay Now
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

const SubscribePage = () => (
  <Elements stripe={stripePromise}>
    <SubscribeForm />
  </Elements>
);

export default SubscribePage;