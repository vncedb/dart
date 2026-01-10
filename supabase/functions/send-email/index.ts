import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import nodemailer from "npm:nodemailer@6.9.7";

// --- CONFIGURATION ---
const LOGO_URL = "https://ytvfitmcwpyjbklrquyi.supabase.co/storage/v1/object/public/assets/dart-logo.png";
const GMAIL_USER = Deno.env.get("GMAIL_USER");
const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD");

// --- NODEMAILER SETUP ---
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD,
  },
});

// --- HTML TEMPLATES ---
const getHtmlHead = (title: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #F1F5F9; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
    .wrapper { width: 100%; background-color: #F1F5F9; padding-bottom: 40px; }
    .content { max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); text-align: center; padding: 40px; }
    .logo { width: 80px; height: auto; display: block; margin: 0 auto; }
    .header { padding: 40px 0 24px; text-align: center; }
    .title { font-size: 24px; font-weight: 700; color: #0f172a; margin: 0 0 16px; }
    .text { font-size: 16px; color: #64748b; line-height: 24px; margin: 0 0 24px; }
    .btn { display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px; }
    .footer { padding: 24px; color: #94a3b8; font-size: 12px; text-align: center; }
    .icon { font-size: 32px; color: #4f46e5; }
    .icon-container { width: 64px; height: 64px; background-color: #EEF2FF; border-radius: 50%; margin: 0 auto 20px auto; line-height: 64px; }
  </style>
</head>
<body>
  <table class="wrapper">
    <tr>
      <td align="center">
        <div class="header">
          <img src="${LOGO_URL}" alt="DART" class="logo">
        </div>
`;

const getHtmlFooter = (year: number) => `
        <div class="footer">
          <p>&copy; ${year} DART. All rights reserved.</p>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const buildNotifTemplate = (type: string, siteUrl: string, year: number) => {
  let title = '', desc = '', btnText = 'Open App', icon = '&#10003;'; // Checkmark

  switch (type) {
    case 'WELCOME':
      title = 'Account Ready!';
      desc = 'Your DART account has been successfully created. You can now access all features and start managing your reports.';
      break;
    case 'SUBSCRIPTION':
      title = 'Upgrade Complete';
      desc = 'Thank you for subscribing! Your premium features have been unlocked and are ready to use.';
      icon = '&#9733;'; // Star
      btnText = 'View Plan';
      break;
    case 'PASSWORD_CHANGED':
      title = 'Password Updated';
      desc = 'Your account password has been successfully changed. If you did not perform this action, please contact support immediately.';
      icon = '&#128274;'; // Lock
      btnText = 'Login Now';
      break;
    default:
      title = 'Notification';
      desc = 'You have a new notification from DART.';
  }

  return `
    ${getHtmlHead(title)}
    <div class="content">
      <div class="icon-container"><span class="icon">${icon}</span></div>
      <h1 class="title">${title}</h1>
      <p class="text">${desc}</p>
      <a href="${siteUrl}" class="btn">${btnText}</a>
    </div>
    ${getHtmlFooter(year)}
  `;
};

// --- MAIN HANDLER ---
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } });
  }

  try {
    const { email, type, siteUrl = 'https://dartapp.com' } = await req.json();
    const year = new Date().getFullYear();
    let html = '';
    let subject = '';

    console.log(`Sending email type: ${type} to ${email}`);

    switch (type) {
      case 'WELCOME':
        subject = "You're all set!";
        html = buildNotifTemplate('WELCOME', siteUrl, year);
        break;
      case 'SUBSCRIPTION':
        subject = 'Subscription Confirmed';
        html = buildNotifTemplate('SUBSCRIPTION', siteUrl, year);
        break;
      case 'PASSWORD_CHANGED':
        subject = 'Security Alert: Password Changed';
        html = buildNotifTemplate('PASSWORD_CHANGED', siteUrl, year);
        break;
      default:
        // Supabase now handles OTP/Delete/Recovery internally via Dashboard SMTP.
        // We throw here to prevent this function from sending duplicate or unstyled emails if called by mistake.
        throw new Error(`Type "${type}" is handled by Supabase Dashboard or is invalid.`);
    }

    // Send via Gmail SMTP
    const info = await transporter.sendMail({
      from: `"DART App" <${GMAIL_USER}>`,
      to: email,
      subject: subject,
      html: html,
    });

    console.log("Email sent: %s", info.messageId);

    return new Response(JSON.stringify({ success: true, messageId: info.messageId }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error("Email error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});