export {
  createEmailTransporter,
  getSenderAddress,
  emailConfig,
} from "./config";
export {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "./sender";
export {
  getVerificationEmailHtml,
  getVerificationEmailText,
} from "./templates/verification";
export {
  getPasswordResetEmailHtml,
  getPasswordResetEmailText,
} from "./templates/password-reset";
