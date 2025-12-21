import { createEmailTransporter, getSenderAddress } from "./config";
import {
  getVerificationEmailHtml,
  getVerificationEmailText,
} from "./templates/verification";
import {
  getPasswordResetEmailHtml,
  getPasswordResetEmailText,
} from "./templates/password-reset";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Sends an email using the configured transporter
 */
export async function sendEmail(options: SendEmailOptions) {
  const transporter = createEmailTransporter();

  try {
    const info = await transporter.sendMail({
      from: getSenderAddress(),
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    //! todo remove console log
    console.log("Email sent successfully:", {
      messageId: info.messageId,
      to: options.to,
      subject: options.subject,
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Failed to send email:", error);
    throw new Error(
      `Failed to send email: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Sends a verification email to a user
 */
export async function sendVerificationEmail(options: {
  to: string;
  name: string;
  verificationUrl: string;
}) {
  const html = getVerificationEmailHtml({
    name: options.name,
    verificationUrl: options.verificationUrl,
  });

  const text = getVerificationEmailText({
    name: options.name,
    verificationUrl: options.verificationUrl,
  });

  return sendEmail({
    to: options.to,
    subject: "Verify Your Email - PoliTo Rocket Team",
    html,
    text,
  });
}

/**
 * Sends a password reset email to a user
 */
export async function sendPasswordResetEmail(options: {
  to: string;
  name: string;
  resetUrl: string;
}) {
  const html = getPasswordResetEmailHtml({
    name: options.name,
    resetUrl: options.resetUrl,
  });

  const text = getPasswordResetEmailText({
    name: options.name,
    resetUrl: options.resetUrl,
  });

  return sendEmail({
    to: options.to,
    subject: "Reset Your Password - PoliTo Rocket Team",
    html,
    text,
  });
}
