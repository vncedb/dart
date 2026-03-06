import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import nodemailer from "npm:nodemailer@6.9.7";

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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

const nl2br = (value: unknown) => escapeHtml(value).replace(/\n/g, "<br/>");

const buildEmailHtml = (params: {
  title: string;
  intro: string;
  code?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  danger?: boolean;
  detailHtml?: string;
}) => {
  const {
    title,
    intro,
    code,
    ctaLabel,
    ctaUrl,
    danger = false,
    detailHtml,
  } = params;

  const brandColor = danger ? "#dc2626" : "#4f46e5";
  const softBg = danger ? "#fef2f2" : "#f8fafc";
  const softBorder = danger ? "#fecaca" : "#e2e8f0";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0; padding:0; background:#f1f5f9; font-family:Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9; padding:30px 0;">
    <tr>
      <td align="center">
        <img src="${LOGO_URL}" alt="DART" style="width:74px; height:auto; margin-bottom:16px;" />

        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px; background:#ffffff; border:1px solid #e2e8f0; border-radius:18px; overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 20px; text-align:left;">
              <h1 style="margin:0 0 12px; font-size:24px; line-height:1.3; color:#0f172a;">${escapeHtml(title)}</h1>
              <p style="margin:0; font-size:15px; line-height:24px; color:#475569;">${escapeHtml(intro)}</p>
            </td>
          </tr>

          ${code ? `
          <tr>
            <td style="padding:0 28px 18px;">
              <div style="background:${softBg}; border:1px solid ${softBorder}; border-radius:12px; padding:18px; text-align:center;">
                <div style="font-size:12px; color:#64748b; margin-bottom:6px; letter-spacing:0.6px; text-transform:uppercase;">Verification Code</div>
                <div style="font-family:'Courier New', monospace; font-size:34px; font-weight:700; color:${brandColor}; letter-spacing:8px;">${escapeHtml(code)}</div>
              </div>
              <p style="margin:10px 0 0; font-size:12px; line-height:18px; color:#94a3b8;">For your security, this code expires in 10 minutes.</p>
            </td>
          </tr>
          ` : ""}

          ${detailHtml ? `
          <tr>
            <td style="padding:0 28px 18px;">
              <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:14px; font-size:14px; line-height:22px; color:#334155;">
                ${detailHtml}
              </div>
            </td>
          </tr>
          ` : ""}

          ${ctaLabel && ctaUrl ? `
          <tr>
            <td style="padding:0 28px 24px; text-align:left;">
              <a href="${escapeHtml(ctaUrl)}" style="display:inline-block; text-decoration:none; background:${brandColor}; color:#ffffff; font-weight:600; font-size:14px; line-height:14px; padding:14px 22px; border-radius:999px;">${escapeHtml(ctaLabel)}</a>
            </td>
          </tr>
          ` : ""}
        </table>

        <p style="margin:16px 0 0; font-size:12px; color:#94a3b8; line-height:18px;">
          © ${new Date().getFullYear()} DART. All rights reserved.<br/>
          If you did not request this email, you can safely ignore it.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
`;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, type, data, otp } = await req.json();

    if (!email || !type) {
      throw new Error("Missing required fields: email and type");
    }

    let subject = "";
    let html = "";

    const codeValue = String(otp || data?.code || "").trim();

    switch (type) {
      case "DELETE_ACCOUNT": {
        subject = "Confirm your DART account deletion request";
        html = buildEmailHtml({
          title: "Confirm Account Deletion",
          intro: "We received a request to permanently delete your DART account. Enter the code below to continue.",
          code: codeValue,
          danger: true,
        });
        break;
      }

      case "WELCOME": {
        subject = "Welcome to DART";
        html = buildEmailHtml({
          title: "Your Account Is Ready",
          intro: "Welcome to DART. You can now track attendance, manage accomplishments, and generate your reports in one place.",
          ctaLabel: "Open DART",
          ctaUrl: "dartapp://home",
        });
        break;
      }

      case "VERIFICATION_CODE": {
        subject = `Your DART verification code: ${escapeHtml(codeValue)}`;
        html = buildEmailHtml({
          title: "Verification Required",
          intro: "Use the code below to complete your request.",
          code: codeValue,
        });
        break;
      }

      case "SUBSCRIPTION": {
        subject = "Your DART Pro subscription is active";
        html = buildEmailHtml({
          title: "Subscription Confirmed",
          intro: "Thank you for subscribing to DART Pro. Premium features are now active on your account.",
          ctaLabel: "View My Plan",
          ctaUrl: "dartapp://settings",
        });
        break;
      }

      case "FEEDBACK": {
        const categoryLabel = escapeHtml(data?.category || "General Feedback");
        const senderLabel = escapeHtml(data?.sender || email);
        const messageHtml = nl2br(data?.message || "No message provided.");

        subject = `DART Feedback: ${categoryLabel}`;
        html = buildEmailHtml({
          title: "New Feedback Received",
          intro: "A new feedback submission was received from the app.",
          detailHtml: `
            <strong>Sender:</strong> ${senderLabel}<br/>
            <strong>Category:</strong> ${categoryLabel}<br/><br/>
            <strong>Message:</strong><br/>
            <div style="margin-top:8px; padding:12px; background:#ffffff; border:1px solid #dbe4ef; border-radius:8px;">${messageHtml}</div>
          `,
        });
        break;
      }

      default:
        throw new Error("Invalid email type");
    }

    await transporter.sendMail({
      from: `"DART Support" <${GMAIL_USER}>`,
      to: email,
      subject,
      html,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});