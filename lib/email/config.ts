import nodemailer from "nodemailer";

/**
 * Email configuration for local development and production
 *
 * In development: Uses Mailpit SMTP server (http://localhost:8025)
 * In production: Configure with your actual SMTP provider
 */
export const emailConfig = {
  // SMTP settings for local development (Mailpit)
  development: {
    host: process.env.SMTP_HOST || "127.0.0.1",
    port: parseInt(process.env.SMTP_PORT || "1025"),
    secure: false,
    auth: undefined, // Mailpit doesn't require authentication
  },
  // SMTP settings for production
  production: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  },
  // Default sender information
  from: {
    name: process.env.EMAIL_FROM_NAME || "PoliTo Rocket Team",
    email: process.env.EMAIL_FROM_ADDRESS || "noreply@politorocketteam.it",
  },
};

/**
 * Creates and returns a nodemailer transporter based on the environment
 */
export function createEmailTransporter() {
  const isDevelopment = process.env.NODE_ENV !== "production";
  const config = isDevelopment
    ? emailConfig.development
    : emailConfig.production;

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });
}

/**
 * Gets the sender email address in the format "Name <email>"
 */
export function getSenderAddress() {
  return `${emailConfig.from.name} <${emailConfig.from.email}>`;
}
