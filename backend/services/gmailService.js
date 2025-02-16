const { google } = require('googleapis');
const { oauth2Client } = require('../config/google');

class GmailService {
  constructor(accessToken) {
    oauth2Client.setCredentials({ access_token: accessToken });
    this.gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  }

  async sendEmail(to, subject, body) {
    try {
      // Create email content in base64 format
      const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
      const messageParts = [
        `To: ${to}`,
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: ${utf8Subject}`,
        '',
        body,
      ];
      const message = messageParts.join('\n');
      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      // Send email using Gmail API
      const res = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });

      return res.data;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  async sendBulkEmails(recipients, subject, body) {
    const results = [];
    for (const recipient of recipients) {
      try {
        const result = await this.sendEmail(recipient, subject, body);
        results.push({ email: recipient, success: true, messageId: result.id });
      } catch (error) {
        results.push({ email: recipient, success: false, error: error.message });
      }
    }
    return results;
  }
}

module.exports = GmailService;
