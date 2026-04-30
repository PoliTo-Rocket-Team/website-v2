/**
 * Email template for password reset
 */
export function getPasswordResetEmailHtml(options: {
  name: string;
  resetUrl: string;
}): string {
  const { name, resetUrl } = options;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .logo {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo h1 {
      color: #e74c3c;
      margin: 0;
      font-size: 28px;
    }
    .content {
      margin-bottom: 30px;
    }
    .button {
      display: inline-block;
      padding: 12px 30px;
      background-color: #e74c3c;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 5px;
      font-weight: 600;
      text-align: center;
    }
    .button-container {
      text-align: center;
      margin: 30px 0;
    }
    .warning {
      background-color: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 12px;
      margin: 20px 0;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eeeeee;
      font-size: 14px;
      color: #666;
    }
    .link {
      color: #e74c3c;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <h1>🚀 PoliTo Rocket Team</h1>
    </div>
    
    <div class="content">
      <h2>Reset Your Password</h2>
      <p>Hi ${name},</p>
      <p>We received a request to reset your password. Click the button below to create a new password:</p>
      
      <div class="button-container">
        <a href="${resetUrl}" class="button">Reset Password</a>
      </div>
      
      <p>Or copy and paste this link into your browser:</p>
      <p class="link">${resetUrl}</p>
      
      <div class="warning">
        <strong>⚠️ Security Notice:</strong> This password reset link will expire in 1 hour for security reasons.
      </div>
      
      <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns about your account security.</p>
    </div>
    
    <div class="footer">
      <p>© ${new Date().getFullYear()} PoliTo Rocket Team. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Plain text version of password reset email
 */
export function getPasswordResetEmailText(options: {
  name: string;
  resetUrl: string;
}): string {
  const { name, resetUrl } = options;

  return `
Hi ${name},

We received a request to reset your password for your PoliTo Rocket Team account.

Click the following link to create a new password:

${resetUrl}

This password reset link will expire in 1 hour for security reasons.

If you didn't request a password reset, please ignore this email or contact support if you have concerns about your account security.

© ${new Date().getFullYear()} PoliTo Rocket Team. All rights reserved.
  `.trim();
}
