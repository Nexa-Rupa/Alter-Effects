import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/* Transactional email over SMTP (works with Resend, Postmark, SES, Mailgun, Gmail…).
   Without SMTP_URL, emails are printed to the server log so local development still works. */

let transport: Transporter | null = null;
const from = () => process.env.MAIL_FROM || "Alter Effects <no-reply@localhost>";
export const mailConfigured = () => !!process.env.SMTP_URL;

export async function sendMail(to: string, subject: string, text: string, html?: string) {
  if (!process.env.SMTP_URL) {
    console.log(`[mail] SMTP_URL not set — would send to ${to}\nSubject: ${subject}\n${text}\n`);
    return;
  }
  transport ??= nodemailer.createTransport(process.env.SMTP_URL);
  await transport.sendMail({ from: from(), to, subject, text, html });
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Minimal, client-safe HTML email with one call-to-action button. */
export function actionEmail(title: string, intro: string, cta: string, url: string, outro: string) {
  const text = `${title}\n\n${intro}\n\n${cta}: ${url}\n\n${outro}`;
  const html = `<!doctype html><html><body style="margin:0;background:#f4f4f8;font-family:Inter,Arial,sans-serif;color:#0e0e1a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px">
<tr><td style="font-size:20px;font-weight:700;padding-bottom:12px">${esc(title)}</td></tr>
<tr><td style="font-size:15px;line-height:1.6;color:#3b3b52;padding-bottom:24px">${esc(intro)}</td></tr>
<tr><td style="padding-bottom:24px"><a href="${esc(url)}" style="display:inline-block;background:#f43f5e;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px">${esc(cta)}</a></td></tr>
<tr><td style="font-size:13px;line-height:1.6;color:#6b6b80">${esc(outro)}<br><br>If the button doesn't work, paste this link into your browser:<br><span style="word-break:break-all">${esc(url)}</span></td></tr>
</table><p style="font-size:12px;color:#8a8aa0">Alter Effects</p></td></tr></table></body></html>`;
  return { text, html };
}
