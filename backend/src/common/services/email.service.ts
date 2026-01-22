import nodemailer from 'nodemailer';
import config from '../../config';
import logger from '../../config/logger';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // Create transporter with SMTP config
    this.transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure, // true for 465, false for other ports
      auth: {
        user: config.email.user,
        pass: config.email.password,
      },
    });

    // Verify connection configuration
    this.transporter.verify((error, _success) => {
      if (error) {
        logger.error('Email service connection error:', error);
      } else {
        logger.info('Email service ready to send messages');
      }
    });
  }

  /**
   * Send email
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const mailOptions = {
        from: `${config.email.fromName} <${config.email.fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html),
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent: ${info.messageId} to ${options.to}`);
      return true;
    } catch (error) {
      logger.error('Send email error:', error);
      return false;
    }
  }

  /**
   * Send notification email
   */
  async sendNotificationEmail(
    to: string,
    title: string,
    message: string,
    actionUrl?: string
  ): Promise<boolean> {
    const html = this.getNotificationTemplate(title, message, actionUrl);
    return this.sendEmail({
      to,
      subject: title,
      html,
    });
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(to: string, token: string): Promise<boolean> {
    const verificationUrl = `${config.frontendUrl}/verify-email?token=${token}`;
    const html = this.getVerificationTemplate(verificationUrl);
    
    return this.sendEmail({
      to,
      subject: 'Verify Your Email Address',
      html,
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(to: string, token: string): Promise<boolean> {
    const resetUrl = `${config.frontendUrl}/reset-password?token=${token}`;
    const html = this.getPasswordResetTemplate(resetUrl);
    
    return this.sendEmail({
      to,
      subject: 'Reset Your Password',
      html,
    });
  }

  /**
   * Send order notification email
   */
  async sendOrderNotificationEmail(
    to: string,
    orderType: string,
    symbol: string,
    quantity: string,
    price: string,
    status: string
  ): Promise<boolean> {
    const html = this.getOrderTemplate(orderType, symbol, quantity, price, status);
    
    return this.sendEmail({
      to,
      subject: `Order ${status}: ${orderType} ${symbol}`,
      html,
    });
  }

  /**
   * Send withdrawal notification email
   */
  async sendWithdrawalNotificationEmail(
    to: string,
    asset: string,
    amount: string,
    address: string,
    status: string
  ): Promise<boolean> {
    const html = this.getWithdrawalTemplate(asset, amount, address, status);
    
    return this.sendEmail({
      to,
      subject: `Withdrawal ${status}: ${amount} ${asset}`,
      html,
    });
  }

  /**
   * Send security alert email
   */
  async sendSecurityAlertEmail(
    to: string,
    action: string,
    ipAddress: string,
    location?: string
  ): Promise<boolean> {
    const html = this.getSecurityAlertTemplate(action, ipAddress, location);
    
    return this.sendEmail({
      to,
      subject: `Security Alert: ${action}`,
      html,
    });
  }

  /**
   * Strip HTML tags for plain text version
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '');
  }

  /**
   * Base email template
   */
  private getBaseTemplate(content: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Crypto Exchange</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .container {
      background-color: #f9f9f9;
      border-radius: 10px;
      padding: 30px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo {
      font-size: 28px;
      font-weight: bold;
      color: #4CAF50;
    }
    .content {
      background-color: white;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .button {
      display: inline-block;
      padding: 12px 30px;
      background-color: #4CAF50;
      color: white;
      text-decoration: none;
      border-radius: 5px;
      margin: 20px 0;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      font-size: 12px;
      color: #666;
    }
    .alert {
      background-color: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 15px 0;
    }
    .success {
      background-color: #d4edda;
      border-left: 4px solid #28a745;
      padding: 15px;
      margin: 15px 0;
    }
    .danger {
      background-color: #f8d7da;
      border-left: 4px solid #dc3545;
      padding: 15px;
      margin: 15px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🪙 Crypto Exchange</div>
    </div>
    ${content}
    <div class="footer">
      <p>© 2026 Crypto Exchange. All rights reserved.</p>
      <p>This is an automated email. Please do not reply to this message.</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Notification email template
   */
  private getNotificationTemplate(title: string, message: string, actionUrl?: string): string {
    const actionButton = actionUrl
      ? `<a href="${actionUrl}" class="button">View Details</a>`
      : '';

    const content = `
      <div class="content">
        <h2>${title}</h2>
        <p>${message}</p>
        ${actionButton}
      </div>
    `;

    return this.getBaseTemplate(content);
  }

  /**
   * Verification email template
   */
  private getVerificationTemplate(verificationUrl: string): string {
    const content = `
      <div class="content">
        <h2>Verify Your Email Address</h2>
        <p>Thank you for registering with Crypto Exchange!</p>
        <p>Please click the button below to verify your email address:</p>
        <div style="text-align: center;">
          <a href="${verificationUrl}" class="button">Verify Email</a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
        <p><strong>This link will expire in 24 hours.</strong></p>
      </div>
    `;

    return this.getBaseTemplate(content);
  }

  /**
   * Password reset email template
   */
  private getPasswordResetTemplate(resetUrl: string): string {
    const content = `
      <div class="content">
        <h2>Reset Your Password</h2>
        <p>We received a request to reset your password.</p>
        <p>Click the button below to reset your password:</p>
        <div style="text-align: center;">
          <a href="${resetUrl}" class="button">Reset Password</a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${resetUrl}</p>
        <p><strong>This link will expire in 1 hour.</strong></p>
        <div class="alert">
          <p><strong>Didn't request this?</strong></p>
          <p>If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</p>
        </div>
      </div>
    `;

    return this.getBaseTemplate(content);
  }

  /**
   * Order notification email template
   */
  private getOrderTemplate(
    orderType: string,
    symbol: string,
    quantity: string,
    price: string,
    status: string
  ): string {
    const statusClass = status === 'FILLED' ? 'success' : status === 'CANCELED' ? 'danger' : 'alert';
    
    const content = `
      <div class="content">
        <h2>Order Update</h2>
        <div class="${statusClass}">
          <p><strong>Status: ${status}</strong></p>
        </div>
        <table style="width: 100%; margin-top: 20px;">
          <tr>
            <td><strong>Order Type:</strong></td>
            <td>${orderType}</td>
          </tr>
          <tr>
            <td><strong>Symbol:</strong></td>
            <td>${symbol}</td>
          </tr>
          <tr>
            <td><strong>Quantity:</strong></td>
            <td>${quantity}</td>
          </tr>
          <tr>
            <td><strong>Price:</strong></td>
            <td>${price}</td>
          </tr>
        </table>
        <div style="text-align: center;">
          <a href="${config.frontendUrl}/orders" class="button">View Orders</a>
        </div>
      </div>
    `;

    return this.getBaseTemplate(content);
  }

  /**
   * Withdrawal notification email template
   */
  private getWithdrawalTemplate(
    asset: string,
    amount: string,
    address: string,
    status: string
  ): string {
    const statusClass = status === 'COMPLETED' ? 'success' : status === 'FAILED' ? 'danger' : 'alert';
    
    const content = `
      <div class="content">
        <h2>Withdrawal Update</h2>
        <div class="${statusClass}">
          <p><strong>Status: ${status}</strong></p>
        </div>
        <table style="width: 100%; margin-top: 20px;">
          <tr>
            <td><strong>Asset:</strong></td>
            <td>${asset}</td>
          </tr>
          <tr>
            <td><strong>Amount:</strong></td>
            <td>${amount}</td>
          </tr>
          <tr>
            <td><strong>Address:</strong></td>
            <td style="word-break: break-all;">${address}</td>
          </tr>
        </table>
        <div style="text-align: center;">
          <a href="${config.frontendUrl}/wallet" class="button">View Wallet</a>
        </div>
      </div>
    `;

    return this.getBaseTemplate(content);
  }

  /**
   * Security alert email template
   */
  private getSecurityAlertTemplate(
    action: string,
    ipAddress: string,
    location?: string
  ): string {
    const content = `
      <div class="content">
        <h2>🔒 Security Alert</h2>
        <div class="danger">
          <p><strong>New activity detected on your account</strong></p>
        </div>
        <table style="width: 100%; margin-top: 20px;">
          <tr>
            <td><strong>Action:</strong></td>
            <td>${action}</td>
          </tr>
          <tr>
            <td><strong>IP Address:</strong></td>
            <td>${ipAddress}</td>
          </tr>
          ${location ? `
          <tr>
            <td><strong>Location:</strong></td>
            <td>${location}</td>
          </tr>
          ` : ''}
          <tr>
            <td><strong>Time:</strong></td>
            <td>${new Date().toLocaleString()}</td>
          </tr>
        </table>
        <div class="alert">
          <p><strong>Was this you?</strong></p>
          <p>If you didn't perform this action, please secure your account immediately by changing your password and enabling 2FA.</p>
        </div>
        <div style="text-align: center;">
          <a href="${config.frontendUrl}/security" class="button">Security Settings</a>
        </div>
      </div>
    `;

    return this.getBaseTemplate(content);
  }
}

export default new EmailService();
