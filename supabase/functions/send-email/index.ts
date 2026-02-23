import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import nodemailer from "npm:nodemailer@6.9.7";

// --- CONFIGURATION ---
const LOGO_URL = "https://ytvfitmcwpyjbklrquyi.supabase.co/storage/v1/object/public/assets/dart-logo.png";
const GMAIL_USER = Deno.env.get("GMAIL_USER");
const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD,
  },
});

// --- REUSABLE HTML GENERATOR ---
const generateHtml = (title: string, message: string, code?: string, buttonText?: string, buttonUrl?: string, isDanger = false) => {
  const brandColor = isDanger ? "#ef4444" : "#4f46e5"; // Red for danger, Indigo for normal
  const bgSoft = isDanger ? "#fef2f2" : "#F8FAFC";
  const borderSoft = isDanger ? "#fee2e2" : "#E2E8F0";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0; padding:0; background-color:#F1F5F9; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;">
  <table style="width:100%; background-color:#F1F5F9; padding-bottom:40px;">
    <tr>
      <td align="center">
        <div style="padding:40px 0 24px;">
          <img src="${LOGO_URL}" alt="DART" style="width:80px; height:auto; display:block;">
        </div>
        
        <div style="max-width:480px; width:90%; background-color:#ffffff; border-radius:24px; overflow:hidden; box-shadow:0 4px 6px rgba(0,0,0,0.05); text-align:center; padding:40px;">
          <h1 style="font-size:24px; font-weight:700; color:#0f172a; margin:0 0 16px;">${title}</h1>
          <p style="font-size:16px; color:#64748b; line-height:24px; margin:0 0 24px;">
            ${message}
          </p>
          
          ${code ? `
          <div style="background-color:${bgSoft}; border:1px solid ${borderSoft}; border-radius:12px; padding:20px; margin:0 0 24px;">
            <span style="font-family:'Courier New', monospace; font-size:32px; font-weight:700; color:${brandColor}; letter-spacing:8px;">${code}</span>
          </div>
          <p style="font-size:13px; color:#94a3b8; margin:0;">
            This code expires in 10 minutes.
          </p>
          ` : ''}

          ${buttonText && buttonUrl ? `
          <div style="margin:24px 0;">
             <a href="${buttonUrl}" style="display:inline-block; background-color:${brandColor}; color:#ffffff; padding:14px 32px; border-radius:50px; text-decoration:none; font-weight:600; font-size:16px;">${buttonText}</a>
          </div>
          ` : ''}

        </div>

        <div style="padding:24px; color:#94a3b8; font-size:12px; text-align:center;">
          <p style="margin:0;">&copy; ${new Date().getFullYear()} DART (Beta). All rights reserved.</p>
          <p style="margin:8px 0 0;">Powered by Project Vdb</p>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
`;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });

  try {
    const { email, type, data, otp } = await req.json();
    let subject = '';
    let html = '';

    const codeValue = otp || (data && data.code);

    switch (type) {
      case 'DELETE_ACCOUNT':
        subject = "Confirm Account Deletion";
        html = generateHtml(
          "Delete Account Request",
          "We received a request to permanently delete your DART account. This action cannot be undone. Enter the code below to confirm.",
          codeValue, 
          undefined, 
          undefined,
          true 
        );
        break;

      case 'WELCOME':
        subject = "Welcome to DART Beta!";
        html = generateHtml(
          "Welcome Aboard",
          "Your account is ready. Thanks for joining our Beta program. You can now track your attendance and help us improve.",
          undefined,
          "Open App",
          "dartapp://home"
        );
        break;

      case 'VERIFICATION_CODE':
        subject = `${codeValue} is your verification code`;
        html = generateHtml(
          "Verify Action",
          "Please use the code below to complete your request.",
          codeValue
        );
        break;

      case 'SUBSCRIPTION':
        subject = "You're now a Pro!";
        html = generateHtml(
          "Upgrade Complete",
          "Thank you for subscribing! Your premium features have been unlocked.",
          undefined,
          "View My Plan",
          "dartapp://settings"
        );
        break;

      // --- NEW: FEEDBACK TYPE ---
      case 'FEEDBACK':
        subject = `DART App Feedback / Bug Report`;
        html = generateHtml(
          "New Feedback Received",
          `<strong>Sender:</strong> ${data?.sender || email}<br/><br/><strong>Message:</strong><br/><p>${data?.message}</p>`
        );
        break;

      default:
        throw new Error("Invalid email type");
    }

    await transporter.sendMail({
      from: `"DART Support" <${GMAIL_USER}>`,
      to: email,
      subject,
      html,
    });

    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
});