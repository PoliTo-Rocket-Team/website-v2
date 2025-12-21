# Email System

This directory contains the complete email infrastructure for the application, built with **Nodemailer** and integrated with **Better Auth** for authentication-related emails.

## Overview

The email system provides:

- **Automated emails** - Verification and password reset emails sent automatically by Better Auth
- **Manual sending** - Utilities for sending custom emails
- **HTML & text templates** - Professional, branded email templates
- **Environment-based config** - Different settings for development and production
- **Type-safe** - Full TypeScript support

## Quick Start

For local development setup with Mailpit, see the [main EMAIL_SETUP.md](../../EMAIL_SETUP.md) in the project root.

## Architecture

```
lib/email/
├── config.ts              # SMTP configuration and transporter creation
├── sender.ts              # Email sending utilities
├── index.ts               # Public API exports
└── templates/
    ├── verification.ts    # Email verification templates
    └── password-reset.ts  # Password reset templates
```

## Configuration

### Email Transporter (`config.ts`)

The email transporter is configured differently based on environment:

```typescript
// Development: Uses local Mailpit (port 1025)
// Production: Uses configured SMTP provider

export const emailConfig = {
  development: {
    host: "127.0.0.1",
    port: 1025,
    secure: false,
    auth: undefined, // No auth needed for Mailpit
  },
  production: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  },
};
```

### Environment Variables

Required environment variables:

```env
# Development (defaults work with Mailpit)
SMTP_HOST="127.0.0.1"
SMTP_PORT="1025"
SMTP_SECURE="false"

# Production (configure your SMTP provider)
SMTP_HOST="smtp.your-provider.com"
SMTP_PORT="587"
SMTP_SECURE="true"
SMTP_USER="your-username"
SMTP_PASS="your-password"

# Email sender info
EMAIL_FROM_NAME="PoliTo Rocket Team"
EMAIL_FROM_ADDRESS="noreply@politorocketteam.it"

# Better Auth
BETTER_AUTH_URL="http://localhost:3000"
```

## Better Auth Integration

The email system is integrated with Better Auth in `lib/auth.ts`:

### Email Verification

Automatically sends verification emails when users sign up:

```typescript
emailVerification: {
  sendOnSignUp: true,
  autoSignInAfterVerification: true,
  sendVerificationEmail: async ({ user, url }) => {
    await sendVerificationEmail({
      to: user.email,
      name: user.name || user.email,
      verificationUrl: url,
    });
  },
}
```

**Flow:**

1. User signs up with email/password
2. Better Auth generates verification token and URL
3. `sendVerificationEmail()` is called automatically
4. Email sent with verification link
5. User clicks link → email verified → auto signed in

### Password Reset

Sends password reset emails when users request them:

```typescript
emailAndPassword: {
  enabled: true,
  requireEmailVerification: true,
  sendResetPassword: async ({ user, url }) => {
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name || user.email,
      resetUrl: url,
    });
  },
}
```

**Flow:**

1. User requests password reset
2. Better Auth generates reset token and URL
3. `sendPasswordResetEmail()` is called automatically
4. Email sent with reset link
5. User clicks link → sets new password

## Usage

### Sending Emails

Import from the email module:

```typescript
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendEmail,
} from "@/lib/email";
```

#### Verification Email

```typescript
await sendVerificationEmail({
  to: "user@example.com",
  name: "John Doe",
  verificationUrl: "https://example.com/verify?token=abc123",
});
```

#### Password Reset Email

## Email Templates

Templates are located in `templates/` directory and follow a consistent structure.

### Current Templates

#### Verification Email (`templates/verification.ts`)

- **Purpose**: Confirm user's email address after signup
- **Features**: Call-to-action button, branded design, expiration notice (24 hours)
- **Functions**: `getVerificationEmailHtml()`, `getVerificationEmailText()`

#### Password Reset Email (`templates/password-reset.ts`)

- **Purpose**: Allow users to reset forgotten passwords
- **Features**: Call-to-action button, security warning, expiration notice (1 hour)
- **Functions**: `getPasswordResetEmailHtml()`, `getPasswordResetEmailText()`

### Template Structure

Each template includes:

- **HTML version** - Rich formatted email with inline CSS
- **Plain text version** - Fallback for email clients without HTML support
- **Responsive design** - Works on desktop and mobile
- **Brand colors** - PoliTo Rocket Team red (#e74c3c)
- **Professional layout** - Logo, content, footer with copyright

### Creating Custom Templates

To add new email templates:

1. Create a new file in `templates/` directory
2. Export HTML and text generator functions
3. Use the same pattern as existing templates

Example:

```typescript
// lib/email/templates/welcome.ts
export function getWelcomeEmailHtml(options: { name: string }): string {
  return `
    <!DOCTYPE html>
    <html>
      <body>
        <h1>Welcome ${options.name}!</h1>
      </body>
    </html>
  `;
}

export function getWelcomeEmailText(options: { name: string }): string {
  return `Welcome ${options.name}!`;
}
````

Then create a sender function in `sender.ts`:

````typescript
export async function sendWelcomeEmail(options: { to: string; name: string }) {
## Production Setup

## API Reference

### `createEmailTransporter()`

Creates a Nodemailer transporter based on environment.

```typescript
const transporter = createEmailTransporter();
```

### `getSenderAddress()`

Returns formatted sender address: "Name <email@domain.com>"

```typescript
const from = getSenderAddress();
// Returns: "PoliTo Rocket Team <noreply@politorocketteam.it>"
```

### `sendEmail(options)`

Core function for sending emails.

```typescript
await sendEmail({
  to: string;
  subject: string;
  html: string;
  text: string;
});
```

### `sendVerificationEmail(options)`

Sends email verification email.

```typescript
await sendVerificationEmail({
  to: string;
  name: string;
  verificationUrl: string;
});
```

### `sendPasswordResetEmail(options)`

Sends password reset email.

```typescript
await sendPasswordResetEmail({
  to: string;
  name: string;
  resetUrl: string;
});
```