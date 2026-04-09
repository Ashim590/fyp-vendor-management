import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import User from '../models/User';

let transporter: Transporter | null = null;
let transporterResolved = false;

function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getTransporter(): Transporter | null {
  if (transporterResolved) return transporter;
  transporterResolved = true;

  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from = process.env.SMTP_FROM?.trim() || process.env.MAIL_FROM?.trim();

  if (process.env.NOTIFICATION_EMAIL === '0' || process.env.NOTIFICATION_EMAIL === 'false') {
    transporter = null;
    return null;
  }

  if (!host || !from) {
    transporter = null;
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || '587'),
    secure:
      process.env.SMTP_SECURE === 'true' ||
      String(process.env.SMTP_PORT || '') === '465',
    auth: user && pass != null && pass !== '' ? { user, pass: pass } : undefined,
  });

  return transporter;
}

function buildOpenUrl(link: string): string {
  const raw = String(link || '').trim();
  if (!raw) {
    return (process.env.FRONTEND_URL || process.env.CLIENT_BASE_URL || 'http://localhost:5173').replace(
      /\/$/,
      '',
    );
  }
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = (
    process.env.FRONTEND_URL ||
    process.env.CLIENT_BASE_URL ||
    'http://localhost:5173'
  ).replace(/\/$/, '');
  return `${base}${raw.startsWith('/') ? '' : '/'}${raw}`;
}

export type NotificationEmailPayload = {
  user: unknown;
  title: string;
  body?: string;
  link?: string;
  type?: string;
};

/**
 * Fire-and-forget email mirror of in-app notifications.
 * Never throws to callers — logs only. Safe to call from payment/notifications code.
 */
export async function maybeSendNotificationEmail(
  doc: NotificationEmailPayload,
): Promise<void> {
  try {
    const transport = getTransporter();
    if (!transport) return;

    const fromAddr =
      process.env.SMTP_FROM?.trim() ||
      process.env.MAIL_FROM?.trim();
    if (!fromAddr) return;

    const uid =
      doc.user && typeof doc.user === 'object' && '_id' in (doc.user as object)
        ? String((doc.user as { _id: unknown })._id)
        : String(doc.user || '');
    if (!uid) return;

    const u = await User.findById(uid).select('email name isActive').lean();
    if (!u?.email || !u.isActive) return;

    const fromName = process.env.MAIL_FROM_NAME?.trim() || 'Paropakar VendorNet';
    const url = buildOpenUrl(String(doc.link || ''));
    const subject = String(doc.title || 'Notification').slice(0, 250);
    const bodyText = String(doc.body || '').trim();

    await transport.sendMail({
      from: `"${fromName}" <${fromAddr}>`,
      to: u.email,
      subject,
      text: `${bodyText}\n\nOpen in app: ${url}`,
      html: `<p>${escapeHtml(bodyText).replace(/\n/g, '<br/>')}</p><p><a href="${escapeHtml(url)}">Open in VendorNet</a></p>`,
    });
  } catch (e) {
    console.warn('[notify-email]', (e as Error)?.message || e);
  }
}
