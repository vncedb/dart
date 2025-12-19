import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

// CONSTANTS
const LOGO_URL = "https://ytvfitmcwpyjbklrquyi.supabase.co/storage/v1/object/public/assets/dart-logo.png";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// --- 1. HTML HEAD & STYLES (Shared) ---
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
    .otp-box { background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 20px; margin: 0 0 24px; }
    .otp-code { font-family: 'Courier New', monospace; font-size: 32px; font-weight: 700; color: #4f46e5; letter-spacing: 8px; }
    .delete-box { background-color: #FEF2F2; border: 1px solid #FECACA; border-radius: 12px; padding: 20px; margin: 0 0 24px; }
    .delete-code { font-family: 'Courier New', monospace; font-size: 32px; font-weight: 700; color: #EF4444; letter-spacing: 8px; }
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

// --- 2. HTML FOOTER (Shared) ---
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

// --- 3. TEMPLATE BUILDERS ---

// A. OTP Templates (Delete Account, Verify Identity)
const buildOtpTemplate = (type: string, token: string, year: number) => {
  const isDelete = type === 'DELETE_ACCOUNT';
  const title = isDelete ? 'Delete Account' : 'Verify Identity';
  const desc = isDelete 
    ? 'You have requested to <strong>permanently delete</strong> your account. This action cannot be undone. Please confirm with the code below.'
    : 'We received a request to update your security settings. Please verify your identity to continue.';
  
  const codeBox = isDelete 
    ? `<div class="delete-box"><span class="delete-code">${token}</span></div>`
    : `<div class="otp-box"><span class="otp-code">${token}</span></div>`;

  return `
    ${getHtmlHead(title)}
    <div class="content">
      <h1 class="title">${title}</h1>
      <p class="text">${desc}</p>
      ${codeBox}
    </div>
    ${getHtmlFooter(year)}
  `;
};

// B. Notification Templates (Welcome, Subscription, Password Changed)
const buildNotifTemplate = (type: string, siteUrl: string, year: number) => {
  let title = '', desc = '', btnText = 'Open App', icon = '&#10003;'; // Checkmark

  if (type === 'WELCOME') {
    title = 'Account Ready!';
    desc = 'Your DART account has been successfully created. You can now access all features and start managing your reports.';
  } else if (type === 'SUBSCRIPTION') {
    title = 'Upgrade Complete';
    desc = 'Thank you for subscribing! Your premium features have been unlocked and are ready to use.';
    icon = '&#9733;'; // Star
    btnText = 'View Plan';
  } else if (type === 'PASSWORD_CHANGED') {
    title = 'Password Updated';
    desc = 'Your account password has been successfully changed. If you did not perform this action, please contact support immediately.';
    icon = '&#128274;'; // Lock
    btnText = 'Login Now';
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

// --- 4. MAIN HANDLER ---

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } })
  }

  try {
    const { email, type, token, siteUrl = 'https://your-app-scheme://' } = await req.json();
    const year = new Date().getFullYear();
    let html = '';
    let subject = '';

    // Logic Switch
    switch (type) {
      case 'DELETE_ACCOUNT':
        subject = 'Confirm Account Deletion';
        html = buildOtpTemplate('DELETE_ACCOUNT', token, year);
        break;
      case 'VERIFY_IDENTITY':
        subject = 'Verify Identity';
        html = buildOtpTemplate('VERIFY_IDENTITY', token, year);
        break;
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
        throw new Error('Invalid email type');
    }

    // Send via Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'DART <noreply@dart.com>', // UPDATE THIS
        to: email,
        subject: subject,
        html: html,
      }),
    });

    const data = await res.json();

    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
      status: res.ok ? 200 : 400,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});