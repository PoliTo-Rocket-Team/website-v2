/**
 * Email template for email verification
 */
export function getVerificationEmailHtml(options: {
  name: string;
  verificationUrl: string;
}): string {
  const { name, verificationUrl } = options;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
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
      <h2>Verify Your Email Address</h2>
      <p>Hi ${name},</p>
      <p>Thank you for signing up! Please verify your email address by clicking the button below:</p>
      
      <div class="button-container">
        <a href="${verificationUrl}" class="button">Verify Email Address</a>
      </div>
      
      <p>Or copy and paste this link into your browser:</p>
      <p class="link">${verificationUrl}</p>
      
      <p>This verification link will expire in 24 hours.</p>
      
      <p>If you didn't create an account with PoliTo Rocket Team, you can safely ignore this email.</p>
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
 * Plain text version of verification email
 */
export function getVerificationEmailText(options: {
  name: string;
  verificationUrl: string;
}): string {
  const { name, verificationUrl } = options;

  return `
Hi ${name},

Thank you for signing up for PoliTo Rocket Team!

Please verify your email address by clicking the following link:

${verificationUrl}

This verification link will expire in 24 hours.

If you didn't create an account with PoliTo Rocket Team, you can safely ignore this email.

© ${new Date().getFullYear()} PoliTo Rocket Team. All rights reserved.
  `.trim();
}
