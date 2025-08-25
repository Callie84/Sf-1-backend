import nodemailer from 'nodemailer';
import { logger } from './logger';

interface EmailOptions {
  to: string;
  subject: string;
  template?: string;
  data?: Record<string, any>;
  html?: string;
  text?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      const { to, subject, template, data, html, text } = options;

      let emailHtml = html;
      let emailText = text;

      // Generate content from template if provided
      if (template && data) {
        const templateContent = this.getTemplate(template, data);
        emailHtml = templateContent.html;
        emailText = templateContent.text;
      }

      const mailOptions = {
        from: `SF-1 <${process.env.SMTP_USER}>`,
        to,
        subject,
        html: emailHtml,
        text: emailText,
      };

      await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent successfully to ${to}`);
    } catch (error) {
      logger.error('Failed to send email:', error);
      throw error;
    }
  }

  private getTemplate(templateName: string, data: Record<string, any>): { html: string; text: string } {
    switch (templateName) {
      case 'emailVerification':
        return {
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Verify Your Email Address</h2>
              <p>Thank you for registering with SF-1. Please click the link below to verify your email address:</p>
              <a href="${data.verificationUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Verify Email</a>
              <p>If the button doesn't work, copy and paste this link into your browser:</p>
              <p>${data.verificationUrl}</p>
              <p>This link will expire in 24 hours.</p>
              <p>If you didn't create an account with SF-1, please ignore this email.</p>
            </div>
          `,
          text: `
            Verify Your Email Address
            
            Thank you for registering with SF-1. Please visit the following link to verify your email address:
            
            ${data.verificationUrl}
            
            This link will expire in 24 hours.
            
            If you didn't create an account with SF-1, please ignore this email.
          `,
        };

      case 'passwordReset':
        return {
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Password Reset Request</h2>
              <p>You requested a password reset for your SF-1 account. Click the link below to reset your password:</p>
              <a href="${data.resetUrl}" style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Reset Password</a>
              <p>If the button doesn't work, copy and paste this link into your browser:</p>
              <p>${data.resetUrl}</p>
              <p>This link will expire in 10 minutes for security reasons.</p>
              <p>If you didn't request a password reset, please ignore this email.</p>
            </div>
          `,
          text: `
            Password Reset Request
            
            You requested a password reset for your SF-1 account. Please visit the following link to reset your password:
            
            ${data.resetUrl}
            
            This link will expire in 10 minutes for security reasons.
            
            If you didn't request a password reset, please ignore this email.
          `,
        };

      case 'welcomeEmail':
        return {
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Welcome to SF-1!</h2>
              <p>Hi ${data.firstName},</p>
              <p>Welcome to SF-1! Your account has been successfully verified and you can now access all features.</p>
              <p>Here are some things you can do to get started:</p>
              <ul>
                <li>Complete your profile</li>
                <li>Explore our features</li>
                <li>Join channels and start messaging</li>
                <li>Upload and share files</li>
              </ul>
              <a href="${data.dashboardUrl}" style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Go to Dashboard</a>
              <p>If you have any questions, feel free to contact our support team.</p>
              <p>Best regards,<br>The SF-1 Team</p>
            </div>
          `,
          text: `
            Welcome to SF-1!
            
            Hi ${data.firstName},
            
            Welcome to SF-1! Your account has been successfully verified and you can now access all features.
            
            Here are some things you can do to get started:
            - Complete your profile
            - Explore our features
            - Join channels and start messaging
            - Upload and share files
            
            Visit your dashboard: ${data.dashboardUrl}
            
            If you have any questions, feel free to contact our support team.
            
            Best regards,
            The SF-1 Team
          `,
        };

      case 'subscriptionConfirmation':
        return {
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Subscription Confirmed</h2>
              <p>Hi ${data.firstName},</p>
              <p>Thank you for subscribing to SF-1 ${data.planName}!</p>
              <p>Your subscription details:</p>
              <ul>
                <li>Plan: ${data.planName}</li>
                <li>Amount: ${data.amount}</li>
                <li>Billing Cycle: ${data.billingCycle}</li>
                <li>Next Billing Date: ${data.nextBillingDate}</li>
              </ul>
              <p>You now have access to all premium features. Enjoy!</p>
              <a href="${data.dashboardUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Access Dashboard</a>
            </div>
          `,
          text: `
            Subscription Confirmed
            
            Hi ${data.firstName},
            
            Thank you for subscribing to SF-1 ${data.planName}!
            
            Your subscription details:
            - Plan: ${data.planName}
            - Amount: ${data.amount}
            - Billing Cycle: ${data.billingCycle}
            - Next Billing Date: ${data.nextBillingDate}
            
            You now have access to all premium features. Enjoy!
            
            Access Dashboard: ${data.dashboardUrl}
          `,
        };

      default:
        return {
          html: '<p>No template found</p>',
          text: 'No template found',
        };
    }
  }
}

const emailService = new EmailService();

export const sendEmail = (options: EmailOptions) => emailService.sendEmail(options);