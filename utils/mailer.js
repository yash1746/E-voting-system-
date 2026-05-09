const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Send OTP email styled as official govt communication
 */
async function sendOTPEmail(toEmail, voterName, otp, expiryMinutes = 10) {
  const mailOptions = {
    from: `"National Electoral Commission" <${process.env.EMAIL_FROM || 'noreply@evoting.gov.in'}>`,
    to: toEmail,
    subject: `[SECURE] Your Voter Verification Code — NEC`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background: #0a0f1a; margin: 0; padding: 20px; }
    .container { max-width: 520px; margin: 0 auto; background: #111827; border-radius: 12px; overflow: hidden; border: 1px solid #1e3a5f; }
    .header { background: linear-gradient(135deg, #1a3a6b, #0d2146); padding: 24px; text-align: center; border-bottom: 2px solid #2563eb; }
    .emblem { font-size: 48px; display: block; margin-bottom: 8px; }
    .header h1 { color: #fff; margin: 0; font-size: 18px; letter-spacing: 1px; }
    .header p { color: #93c5fd; margin: 4px 0 0; font-size: 12px; letter-spacing: 2px; }
    .body { padding: 32px 28px; color: #e2e8f0; }
    .greeting { font-size: 15px; margin-bottom: 20px; }
    .otp-box { background: #0a1628; border: 2px solid #2563eb; border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0; }
    .otp-label { font-size: 12px; color: #93c5fd; letter-spacing: 3px; margin-bottom: 12px; }
    .otp-code { font-size: 42px; font-weight: bold; color: #60a5fa; letter-spacing: 12px; font-family: 'Courier New', monospace; }
    .expiry { font-size: 13px; color: #f59e0b; margin-top: 12px; }
    .warning { background: #1a0a0a; border-left: 4px solid #ef4444; padding: 14px; border-radius: 4px; font-size: 13px; color: #fca5a5; margin-top: 20px; }
    .footer { background: #0d1525; padding: 16px 28px; text-align: center; font-size: 11px; color: #4b5563; border-top: 1px solid #1e293b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="emblem">🏛️</span>
      <h1>NATIONAL ELECTORAL COMMISSION</h1>
      <p>SECURE VOTER VERIFICATION SYSTEM</p>
    </div>
    <div class="body">
      <p class="greeting">Dear <strong>${voterName}</strong>,</p>
      <p>You have initiated a voter identity verification request. Please use the following secure verification code to complete your authentication:</p>
      <div class="otp-box">
        <div class="otp-label">SECURE VERIFICATION CODE</div>
        <div class="otp-code">${otp}</div>
        <div class="expiry">⏱ Valid for ${expiryMinutes} minutes only</div>
      </div>
      <div class="warning">
        ⚠️ <strong>Security Notice:</strong> Never share this code with anyone. Government officials will never ask for your verification code. If you did not request this, please ignore this message.
      </div>
    </div>
    <div class="footer">
      National Electoral Commission of India &bull; This is an automated message &bull; Do not reply
    </div>
  </div>
</body>
</html>
    `,
    text: `Your NEC Voter Verification Code: ${otp}. Valid for ${expiryMinutes} minutes. Never share this code.`,
  };

  await transporter.sendMail(mailOptions);
}

/**
 * Demo mode — log OTP to console when email is not configured
 */
async function sendOTPDemo(voterName, otp) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📧 [DEMO MODE] OTP for ${voterName}: ${otp}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

async function sendOTP(email, voterName, otp) {
  if (!process.env.EMAIL_USER || process.env.EMAIL_USER === 'your-email@gmail.com') {
    await sendOTPDemo(voterName, otp);
    return;
  }
  try {
    await sendOTPEmail(email, voterName, otp);
  } catch (err) {
    console.error('Email send failed, using demo mode:', err.message);
    await sendOTPDemo(voterName, otp);
  }
}

module.exports = { sendOTP };
