# Quick Start: Email Setup with Mailpit

## What's Been Set Up

✅ **Nodemailer** - Email sending library
✅ **Mailpit** - Local email testing (Docker container)
✅ **Email templates** - Verification and password reset emails
✅ **Better Auth integration** - Automatic email sending

## Getting Started

### 1. Start Mailpit

```bash
pnpm mailpit:start
```

This will start the Mailpit container and show you the connection details.

### 2. Start Your Dev Server

```bash
pnpm dev
```

### 3. View Emails

Open **http://localhost:8025** in your browser

## Available Commands

- `pnpm mailpit:start` - Start Mailpit container for email testing
- `pnpm mailpit:stop` - Stop Mailpit container
- `pnpm mailpit:restart` - Restart Mailpit container
- `pnpm mailpit:logs` - View Mailpit container logs (live tail)

## Quick Test

Test the email system manually:

```bash
pnpm test:email
```

Then check http://localhost:8025 to see the test emails!

## How It Works

When a user:

- **Signs up** → Verification email sent automatically
- **Requests password reset** → Reset email sent automatically

All emails are captured by Mailpit and viewable at http://localhost:8025

## Configuration

Default settings (already configured in code):

- SMTP Host: `127.0.0.1`
- SMTP Port: `1025`
- Web UI: http://localhost:8025

## File Structure

```
lib/email/
├── config.ts              # SMTP configuration
├── sender.ts              # Email sending functions
├── templates/
│   ├── verification.ts    # Verification email template
│   └── password-reset.ts  # Password reset template
└── index.ts               # Exports
```

## Troubleshooting

**Emails not showing?**

```bash
# Check if Mailpit is running
docker ps | grep mailpit

# Restart Mailpit
pnpm mailpit:restart

# View Mailpit logs
pnpm mailpit:logs
```

**Can't connect to SMTP?**

- Ensure Mailpit is running: `pnpm mailpit:start`
- Check port 1025 is available

## Production Setup

For production, update these environment variables:

```env
SMTP_HOST="smtp.your-provider.com"
SMTP_PORT="587"
SMTP_SECURE="true"
SMTP_USER="your-username"
SMTP_PASS="your-password"
```

Recommended providers: Resend, SendGrid, AWS SES, Mailgun
