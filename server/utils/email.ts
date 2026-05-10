import { Resend } from 'resend';
import nodemailer from 'nodemailer';

function isProduction(): boolean {
  return String(process.env.NODE_ENV || '').toLowerCase() === 'production';
}

// ─── Gmail transporter (primary) ────────────────────────────────────────────
// Uses GMAIL_USER + GMAIL_APP_PASSWORD — already set in Render env
function getGmailTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
}

// ─── Resend client (fallback) ────────────────────────────────────────────────
// Requires EMAIL_FROM to be set to a verified domain address
const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
};

const getFromAddress = () => {
  return process.env.EMAIL_FROM || `Sahla4Eco <${process.env.GMAIL_USER || 'onboarding@resend.dev'}>`;
};

// ─── Generic send helper ─────────────────────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  // 1. Try Gmail first — always configured in production
  const gmail = getGmailTransporter();
  if (gmail) {
    try {
      await gmail.sendMail({
        from: `Sahla4Eco <${process.env.GMAIL_USER}>`,
        to,
        subject,
        html,
      });
      console.log(`[EMAIL] Sent via Gmail to ${to}`);
      return true;
    } catch (err) {
      console.error(`[EMAIL] Gmail failed for ${to}:`, (err as any)?.message || err);
      // Fall through to Resend
    }
  }

  // 2. Fallback to Resend
  const resend = getResendClient();
  if (!resend) {
    console.error('[EMAIL] No email provider configured (GMAIL_USER or RESEND_API_KEY required)');
    return false;
  }
  try {
    const { data, error } = await resend.emails.send({ from: getFromAddress(), to, subject, html });
    if (error) {
      console.error(`[EMAIL] Resend rejected to ${to}:`, JSON.stringify(error));
      return false;
    }
    console.log(`[EMAIL] Sent via Resend to ${to}, id: ${data?.id}`);
    return true;
  } catch (err) {
    console.error(`[EMAIL] Resend threw for ${to}:`, (err as any)?.message || err);
    return false;
  }
}

// ─── Password reset email ────────────────────────────────────────────────────
export async function sendPasswordResetEmail(email: string, _resetToken: string, resetUrl: string): Promise<boolean> {
  if (!isProduction()) {
    console.log(`[EMAIL] DEV — password reset URL for ${email}: ${resetUrl}`);
  }
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Password Reset</h1>
      </div>
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          You requested to reset your password. Click the button below to create a new password:
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
          This link will expire in 1 hour. If you didn't request this, please ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">
          © ${new Date().getFullYear()} Sahla4Eco. All rights reserved.
        </p>
      </div>
    </div>
  `;
  return sendEmail(email, 'Reset Your Password - Sahla4Eco', html);
}

// ─── Welcome email ───────────────────────────────────────────────────────────
export async function sendWelcomeEmail(email: string, name: string): Promise<boolean> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to Sahla4Eco!</h1>
      </div>
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
        <p style="font-size: 16px; color: #374151;">Hi ${name || 'there'},</p>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Your Sahla4Eco account has been created successfully. You can now create your online store and start selling!
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.BASE_URL || 'https://sahla4eco.com'}/dashboard" style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
            Go to Dashboard
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">
          © ${new Date().getFullYear()} Sahla4Eco. All rights reserved.
        </p>
      </div>
    </div>
  `;
  return sendEmail(email, 'Welcome to Sahla4Eco!', html);
}
