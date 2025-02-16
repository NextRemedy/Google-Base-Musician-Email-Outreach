import React, { useState, useEffect } from "react";
import { Form, Input, Button, Upload, message } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import axios from "axios"; // For API requests
import Sidebar from "./Sidebar";
import "./styles/Profile.css";

const Profile = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState(null); // Holds user profile data
  const [form] = Form.useForm();

  // Fetch profile data from the backend
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("token"); // Get token from localStorage
        if (!token) {
          message.error("You are not logged in!");
          return;
        }

        const response = await axios.get("http://localhost:5000/api/profile", {
          headers: {
            Authorization: `Bearer ${token}`, // Attach token in Authorization header
          },
        });
        setProfileData(response.data);
      } catch (error) {
        console.error("Error fetching profile:", error);
        if (error.response?.status === 401) {
          message.error("Session expired. Please log in again.");
          // Optionally redirect to login page
        } else {
          message.error("Failed to fetch profile data!");
        }
      }
    };
    fetchProfile();
  }, []);

  // Handle edit mode
  const handleEdit = () => setIsEditing(true);
  const handleCancel = () => {
    setIsEditing(false);
    form.resetFields(); // Reset form fields when canceling
  };

  // Handle form submission to update profile
  const handleFinish = async (values) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        message.error("You are not logged in!");
        return;
      }

      const response = await axios.put("http://localhost:5000/api/profile", values, {
        headers: {
          Authorization: `Bearer ${token}`, // Attach token in Authorization header
        },
      });

      message.success("Profile updated successfully!");
      setProfileData(response.data.userProfile);
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      message.error("Failed to update profile!");
    }
  };

  // Handle profile picture upload
  const handleUpload = async ({ file }) => {
    const formData = new FormData();
    formData.append("profilePicture", file);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        message.error("You are not logged in!");
        return;
      }

      const response = await axios.post("http://localhost:5000/profile/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`, // Attach token in Authorization header
        },
      });

      message.success("Profile picture uploaded successfully!");
      setProfileData((prevData) => ({
        ...prevData,
        profilePicture: response.data.profilePicturePath,
      }));
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      message.error("Failed to upload profile picture!");
    }
  };

  if (!profileData) {
    return <p>Loading...</p>;
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-main">
        <div className="dashboard-header">
          <h2 className="dashboard-logo">Profile</h2>
        </div>
        <div className="dashboard-content profile-page">
          <h3 className="profile-title">User Profile</h3>
          <div className="profile-info">
            {!isEditing ? (
              <>
                <div className="profile-picture">
                  <img
                    src={
                      profileData.profilePicture
                        ? `http://localhost:5000/api/${profileData.profilePicture}`
                        : "https://via.placeholder.com/100"
                    }
                    alt="Profile"
                    className="profile-img"
                  />
                </div>
                <p>
                  <strong>Username:</strong> {profileData.username}
                </p>
                <p>
                  <strong>Email:</strong> {profileData.email}
                </p>
                <p>
                  <strong>Role:</strong> {profileData.role}
                </p>
                <Button className="update-profile-btn" onClick={handleEdit}>
                  Edit Profile
                </Button>
              </>
            ) : (
              <Form
                form={form}
                onFinish={handleFinish}
                layout="vertical"
                initialValues={{
                  username: profileData.username,
                  email: profileData.email,
                  role: profileData.role,
                }}
              >
                <Form.Item
                  name="username"
                  label="Username"
                  rules={[{ required: true, message: "Please enter your username!" }]}
                >
                  <Input />
                </Form.Item>
                <Form.Item
                  name="email"
                  label="Email"
                  rules={[
                    { required: true, message: "Please enter your email!" },
                    { type: "email", message: "Please enter a valid email!" },
                  ]}
                >
                  <Input />
                </Form.Item>
                <Form.Item
                  name="role"
                  label="Role"
                  rules={[{ required: true, message: "Please enter your role!" }]}
                >
                  <Input />
                </Form.Item>
                <Form.Item label="Profile Picture">
                  <Upload
                    customRequest={handleUpload}
                    showUploadList={false}
                    maxCount={1}
                  >
                    <Button icon={<UploadOutlined />}>Upload Picture</Button>
                  </Upload>
                </Form.Item>
                <Form.Item>
                  <div className="form-actions">
                    <Button type="primary" htmlType="submit">
                      Save Changes
                    </Button>
                    <Button onClick={handleCancel} style={{ marginLeft: "10px" }}>
                      Cancel
                    </Button>
                  </div>
                </Form.Item>
              </Form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
