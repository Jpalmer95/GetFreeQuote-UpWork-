import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM_EMAIL = process.env.EMAIL_FROM || 'BidFlow <notifications@bidflow.app>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:5000');

export type EmailNotificationType =
    | 'quote_ready'
    | 'quote_accepted'
    | 'quote_rejected'
    | 'job_match'
    | 'agent_approval'
    | 'new_message';

export interface EmailPreferences {
    quote_ready: boolean;
    quote_accepted: boolean;
    quote_rejected: boolean;
    job_match: boolean;
    agent_approval: boolean;
    new_message: boolean;
}

export const DEFAULT_EMAIL_PREFERENCES: EmailPreferences = {
    quote_ready: true,
    quote_accepted: true,
    quote_rejected: true,
    job_match: true,
    agent_approval: true,
    new_message: false,
};

const NOTIFICATION_TYPE_TO_EMAIL_TYPE: Record<string, EmailNotificationType> = {
    quote_ready: 'quote_ready',
    milestone: 'quote_accepted',
    negotiation_update: 'quote_rejected',
    job_match: 'job_match',
    scope_change: 'agent_approval',
    approval_needed: 'agent_approval',
    agent_summary: 'agent_approval',
    new_message: 'new_message',
};

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buildEmailHtml(params: {
    title: string;
    preheader: string;
    body: string;
    ctaText?: string;
    ctaUrl?: string;
    unsubscribeUrl: string;
}): string {
    const title = escapeHtml(params.title);
    const preheader = escapeHtml(params.preheader);
    const body = escapeHtml(params.body).replace(/\n/g, '<br />');
    const ctaText = params.ctaText ? escapeHtml(params.ctaText) : undefined;
    const { ctaUrl, unsubscribeUrl } = params;
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<style>
body { margin: 0; padding: 0; background: #0d1117; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
.container { max-width: 560px; margin: 0 auto; padding: 24px 16px; }
.header { text-align: center; padding: 24px 0 16px; }
.logo-text { font-size: 24px; font-weight: 800; color: #9b6dff; letter-spacing: -0.5px; }
.logo-sub { font-size: 11px; color: #6e7681; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 2px; }
.card { background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 28px 24px; margin: 16px 0; }
.card h2 { color: #e6edf3; font-size: 18px; margin: 0 0 12px; font-weight: 600; }
.card p { color: #8b949e; font-size: 14px; line-height: 1.6; margin: 0 0 16px; }
.cta { display: inline-block; background: linear-gradient(135deg, #9b6dff, #6366f1); color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px; margin-top: 8px; }
.footer { text-align: center; padding: 24px 0; }
.footer p { color: #484f58; font-size: 12px; margin: 4px 0; }
.footer a { color: #6e7681; text-decoration: underline; }
.preheader { display: none !important; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #0d1117; }
</style>
</head>
<body>
<div class="preheader">${preheader}</div>
<div class="container">
<div class="header">
<div class="logo-text">BidFlow</div>
<div class="logo-sub">AI-Native Estimate Marketplace</div>
</div>
<div class="card">
<h2>${title}</h2>
<p>${body}</p>
${ctaText && ctaUrl ? `<a href="${ctaUrl}" class="cta">${ctaText}</a>` : ''}
</div>
<div class="footer">
<p>You received this because you have email notifications enabled.</p>
<p><a href="${unsubscribeUrl}">Manage notification preferences</a></p>
<p>&copy; ${new Date().getFullYear()} BidFlow. All rights reserved.</p>
</div>
</div>
</body>
</html>`;
}

interface SendEmailNotificationParams {
    recipientEmail: string;
    recipientUserId: string;
    notificationType: string;
    title: string;
    message: string;
    actionUrl?: string;
    emailPreferences?: EmailPreferences | null;
}

export async function sendEmailNotification(params: SendEmailNotificationParams): Promise<boolean> {
    if (!resend) {
        console.log('[EmailService] Resend not configured (missing RESEND_API_KEY), skipping email');
        return false;
    }

    const { recipientEmail, recipientUserId, notificationType, title, message, actionUrl, emailPreferences } = params;

    if (!recipientEmail) {
        console.log('[EmailService] No recipient email, skipping');
        return false;
    }

    const emailType = NOTIFICATION_TYPE_TO_EMAIL_TYPE[notificationType];
    if (!emailType) {
        console.log(`[EmailService] No email mapping for notification type: ${notificationType}`);
        return false;
    }

    const prefs = emailPreferences || DEFAULT_EMAIL_PREFERENCES;
    if (!prefs[emailType]) {
        console.log(`[EmailService] User ${recipientUserId} has ${emailType} emails disabled`);
        return false;
    }

    const fullActionUrl = actionUrl ? `${APP_URL}${actionUrl.startsWith('/') ? actionUrl : `/${actionUrl}`}` : undefined;
    const unsubscribeUrl = `${APP_URL}/settings/notifications`;

    const ctaLabels: Record<EmailNotificationType, string> = {
        quote_ready: 'Review Quote',
        quote_accepted: 'View Project',
        quote_rejected: 'View Details',
        job_match: 'View Project',
        agent_approval: 'Review & Respond',
        new_message: 'View Messages',
    };

    const html = buildEmailHtml({
        title,
        preheader: message.substring(0, 120),
        body: message,
        ctaText: ctaLabels[emailType] || 'View on BidFlow',
        ctaUrl: fullActionUrl,
        unsubscribeUrl,
    });

    try {
        const { error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: recipientEmail,
            subject: `${title} — BidFlow`,
            html,
        });

        if (error) {
            console.error('[EmailService] Send failed:', error);
            return false;
        }

        console.log(`[EmailService] Email sent to ${recipientEmail}: ${title}`);
        return true;
    } catch (err) {
        console.error('[EmailService] Unexpected error:', err);
        return false;
    }
}
