import { Resend } from 'resend';

function isProduction(): boolean {
  return String(process.env.NODE_ENV || '').toLowerCase() === 'production';
}

// Get Resend client - uses RESEND_API_KEY environment variable
const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    const msg = 'Email not configured: RESEND_API_KEY missing';
    if (isProduction()) console.error(msg);
    else console.warn(msg);
    return null;
  }
  return new Resend(apiKey);
};

// Default from address - Resend requires a verified domain
// WARNING: onboarding@resend.dev only delivers to the Resend account owner's email
// Set EMAIL_FROM to a verified domain address e.g. "Sahla4Eco <noreply@sahla4eco.com>"
const getFromAddress = () => {
  const from = process.env.EMAIL_FROM;
  if (!from) {
    if (isProduction()) {
      console.error('[EMAIL] ⚠️  EMAIL_FROM env var not set! Using onboarding@resend.dev which only delivers to the Resend account owner. Set EMAIL_FROM to a verified domain address.');
    }
    return 'Sahla4Eco <onboarding@resend.dev>';
  }
  return from;
};

export async function sendPasswordResetEmail(email: string, resetToken: string, resetUrl: string): Promise<boolean> {
  const resend = getResendClient();
  if (!resend) {
    console.log(`[EMAIL] Would send password reset to ${email} with URL: ${resetUrl}`);
    return !isProduction();
  }
  
  try {
    const { data, error } = await resend.emails.send({
      from: getFromAddress(),
      to: email,
      subject: 'Reset Your Password - Sahla4Eco',
      html: `
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
      `
    });

    if (error) {
      console.error(`[EMAIL] Resend rejected password reset to ${email}:`, JSON.stringify(error));
      return false;
    }

    console.log(`[EMAIL] Password reset email sent to ${email}, id: ${data?.id}`);
    return true;
  } catch (error) {
    console.error(`[EMAIL] Failed to send password reset to ${email}:`, (error as any)?.message || error);
    return false;
  }
}

export async function sendWelcomeEmail(email: string, name: string): Promise<boolean> {
  const resend = getResendClient();
  if (!resend) {
    console.log(`[EMAIL] Would send welcome email to ${email}`);
    return !isProduction();
  }
  
  try {
    const { data, error } = await resend.emails.send({
      from: getFromAddress(),
      to: email,
      subject: 'Welcome to Sahla4Eco!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to Sahla4Eco!</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 16px; color: #374151;">
              Hi ${name || 'there'},
            </p>
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
      `
    });

    if (error) {
      console.error('[EMAIL] Resend error:', error);
      return false;
    }

    console.log(`[EMAIL] Welcome email sent to ${email}, id: ${data?.id}`);
    return true;
  } catch (error) {
    console.error('[EMAIL] Failed to send welcome email:', error);
    return false;
  }
}
