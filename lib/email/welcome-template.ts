import { BRAND, SOCIAL } from '@/lib/site'

export type WelcomeEmailContent = {
  subject: string
  html: string
  text: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function siteBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    'https://aira-landing-page-elite.vercel.app'
  return raw.replace(/\/$/, '')
}

/**
 * Branded first-time welcome email — table layout + inline styles for clients.
 */
export function buildWelcomeEmail(name: string): WelcomeEmailContent {
  const base = siteBaseUrl()
  const logoUrl = `${base}${BRAND.iconSrc}`
  const ctaUrl = `${base}/student/mode-selection`
  const loginUrl = `${base}/login`
  const displayName = (name || 'Learner').trim() || 'Learner'
  const safeName = escapeHtml(displayName)
  const subject = `Welcome to ${BRAND.name} — your AI learning companion`

  const text = [
    `Welcome to ${BRAND.name}, ${displayName}!`,
    '',
    BRAND.tagline,
    '',
    'Here is what you can explore right away:',
    '• Curriculum teaching — grades 6–12 lessons with an AI tutor that explains step by step',
    '• Competitive Mode — JEE, NEET, and other exam prep with live panels, analytics, and AI explanations',
    '• Studio tools — quizzes, notes, flashcards, and mind maps generated from what you are learning',
    '• 24/7 AI support — ask doubts whenever you study',
    '',
    `Open your learning hub: ${ctaUrl}`,
    `Or sign in anytime: ${loginUrl}`,
    '',
    `Instagram: ${SOCIAL.instagram.href}`,
    `X: ${SOCIAL.x.href}`,
    '',
    `— The ${BRAND.name} team`,
    'You received this because you just created an AIra account.',
  ].join('\n')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="background:linear-gradient(135deg,#1d4ed8 0%,#0f766e 100%);padding:28px 32px;text-align:center;">
              <img src="${logoUrl}" width="56" height="56" alt="${escapeHtml(BRAND.name)}" style="display:block;margin:0 auto 14px;border-radius:14px;border:0;" />
              <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.78);">
                Welcome aboard
              </div>
              <h1 style="margin:10px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:28px;line-height:1.2;font-weight:800;color:#ffffff;">
                ${escapeHtml(BRAND.name)}
              </h1>
              <p style="margin:10px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.5;color:rgba(255,255,255,0.9);">
                ${escapeHtml(BRAND.tagline)}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
              <p style="margin:0 0 16px;font-size:17px;line-height:1.5;">
                Hi <strong>${safeName}</strong>,
              </p>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:#334155;">
                Thanks for joining ${escapeHtml(BRAND.name)}. Your account is ready — here is what you can do from day one.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:14px 16px;margin-bottom:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;">
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;font-weight:700;color:#1d4ed8;">Curriculum teaching</div>
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;line-height:1.55;color:#475569;margin-top:4px;">Grades 6–12 lessons with an AI tutor that explains concepts step by step.</div>
                  </td>
                </tr>
                <tr><td style="height:10px;font-size:0;line-height:0;">&nbsp;</td></tr>
                <tr>
                  <td style="padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;">
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;font-weight:700;color:#0f766e;">Competitive Mode</div>
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;line-height:1.55;color:#475569;margin-top:4px;">JEE, NEET, and more — live exam panels, analytics, and AI question explanations.</div>
                  </td>
                </tr>
                <tr><td style="height:10px;font-size:0;line-height:0;">&nbsp;</td></tr>
                <tr>
                  <td style="padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;">
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;font-weight:700;color:#1d4ed8;">Studio tools</div>
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;line-height:1.55;color:#475569;margin-top:4px;">Quizzes, notes, flashcards, and mind maps generated from what you are learning.</div>
                  </td>
                </tr>
                <tr><td style="height:10px;font-size:0;line-height:0;">&nbsp;</td></tr>
                <tr>
                  <td style="padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;">
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;font-weight:700;color:#0f766e;">24/7 AI support</div>
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;line-height:1.55;color:#475569;margin-top:4px;">Raise doubts whenever you study — guidance is always available.</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:28px;">
              <a href="${ctaUrl}" style="display:inline-block;background:#1d4ed8;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:999px;">
                Open your learning hub
              </a>
              <p style="margin:14px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#64748b;">
                Or <a href="${loginUrl}" style="color:#1d4ed8;text-decoration:underline;">sign in</a> anytime with this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 28px;border-top:1px solid #e2e8f0;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
              <p style="margin:0 0 8px;font-size:13px;color:#334155;">Follow ${escapeHtml(BRAND.name)}</p>
              <p style="margin:0;font-size:13px;">
                <a href="${SOCIAL.instagram.href}" style="color:#0f766e;text-decoration:none;margin:0 8px;">Instagram</a>
                <span style="color:#cbd5e1;">·</span>
                <a href="${SOCIAL.x.href}" style="color:#0f766e;text-decoration:none;margin:0 8px;">X</a>
              </p>
              <p style="margin:16px 0 0;font-size:11px;line-height:1.5;color:#94a3b8;">
                You received this because you created an ${escapeHtml(BRAND.name)} account.<br />
                © ${new Date().getFullYear()} ${escapeHtml(BRAND.name)}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject, html, text }
}
