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

type Feature = {
  title: string
  body: string
  accent: string
  badge: string
}

const FEATURES: Feature[] = [
  {
    title: 'Curriculum teaching',
    body: 'Grades 6–12 lessons with an AI tutor that explains every concept clearly, step by step.',
    accent: '#2563eb',
    badge: '01',
  },
  {
    title: 'Competitive Mode',
    body: 'JEE, NEET, and more — live exam panels, performance analytics, and AI question walkthroughs.',
    accent: '#0891b2',
    badge: '02',
  },
  {
    title: 'Studio tools',
    body: 'Quizzes, notes, flashcards, and mind maps generated from exactly what you are learning.',
    accent: '#1d4ed8',
    badge: '03',
  },
  {
    title: '24/7 AI support',
    body: 'Raise a doubt whenever you study. Guidance is always available when you need it.',
    accent: '#0e7490',
    badge: '04',
  },
]

function featureRows(features: Feature[]): string {
  return features
    .map(
      (feature, index) => `
                <tr>
                  <td style="padding:0 0 ${index === features.length - 1 ? '0' : '12px'} 0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e8eef7;border-radius:16px;">
                      <tr>
                        <td width="5" style="background:${feature.accent};border-radius:16px 0 0 16px;font-size:0;line-height:0;">&nbsp;</td>
                        <td style="padding:18px 18px 18px 16px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td width="42" valign="top" style="padding-right:14px;">
                                <div style="width:40px;height:40px;border-radius:12px;background:${feature.accent}14;text-align:center;line-height:40px;font-family:Georgia,'Times New Roman',serif;font-size:14px;font-weight:700;color:${feature.accent};">
                                  ${feature.badge}
                                </div>
                              </td>
                              <td valign="top">
                                <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;color:#0f172a;line-height:1.3;">
                                  ${escapeHtml(feature.title)}
                                </div>
                                <div style="margin-top:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#475569;">
                                  ${escapeHtml(feature.body)}
                                </div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`,
    )
    .join('')
}

/**
 * Branded first-time welcome email — premium table layout for major clients.
 */
export function buildWelcomeEmail(name: string): WelcomeEmailContent {
  const base = siteBaseUrl()
  const logoUrl = `${base}${BRAND.iconSrc}`
  const ctaUrl = `${base}/student/mode-selection`
  const loginUrl = `${base}/login`
  const year = new Date().getFullYear()
  const displayName = (name || 'Learner').trim() || 'Learner'
  const safeName = escapeHtml(displayName)
  const brand = escapeHtml(BRAND.name)
  const tagline = escapeHtml(BRAND.tagline)
  const subject = `Welcome to ${BRAND.name} — your AI learning companion`

  const text = [
    `Welcome to ${BRAND.name}, ${displayName}!`,
    '',
    BRAND.tagline,
    '',
    'Your account is ready. Here is what you can explore right away:',
    ...FEATURES.map((f) => `• ${f.title} — ${f.body}`),
    '',
    `Open your learning hub: ${ctaUrl}`,
    `Sign in anytime: ${loginUrl}`,
    '',
    `Instagram: ${SOCIAL.instagram.href}`,
    `X: ${SOCIAL.x.href}`,
    '',
    `— The ${BRAND.name} team`,
    'You received this because you just created an AIra account.',
  ].join('\n')

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeHtml(subject)}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background:#eef3fb;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
    Welcome to ${brand}. Your AI learning companion for curriculum, JEE &amp; NEET, and studio tools is ready.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef3fb;margin:0;padding:0;width:100%;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;width:100%;">

          <!-- Top brand strip -->
          <tr>
            <td align="center" style="padding:0 0 18px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle" style="padding-right:10px;">
                    <img src="${logoUrl}" width="36" height="36" alt="${brand}" style="display:block;border:0;border-radius:10px;outline:none;" />
                  </td>
                  <td valign="middle" style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;letter-spacing:-0.02em;color:#0f172a;">
                    ${brand}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main card -->
          <tr>
            <td style="background:#ffffff;border:1px solid #dbe5f4;border-radius:28px;overflow:hidden;box-shadow:0 18px 40px rgba(15,23,42,0.08);">

              <!-- Hero -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="background-color:#0b1f4a;background-image:linear-gradient(160deg,#071833 0%,#123a8a 48%,#0e7490 100%);padding:42px 28px 36px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.18);border-radius:22px;padding:14px;">
                          <img src="${logoUrl}" width="72" height="72" alt="${brand}" style="display:block;border:0;border-radius:16px;outline:none;" />
                        </td>
                      </tr>
                    </table>
                    <div style="margin:22px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#7dd3fc;">
                      Welcome to ${brand}
                    </div>
                    <h1 style="margin:12px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.18;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">
                      Your AI learning<br />companion is ready
                    </h1>
                    <p style="margin:14px 0 0;max-width:420px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:rgba(226,232,240,0.92);">
                      ${tagline}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Greeting -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:36px 36px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                    <p style="margin:0 0 10px;font-size:20px;line-height:1.4;font-weight:700;color:#0f172a;">
                      Hello ${safeName},
                    </p>
                    <p style="margin:0;font-size:15px;line-height:1.7;color:#475569;">
                      Thank you for joining ${brand}. Your account is set up — start with a personalised learning path for school, competitive exams, or both.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Features -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:24px 36px 8px;">
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#64748b;margin:0 0 14px;">
                      What you can explore
                    </div>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      ${featureRows(FEATURES)}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding:28px 36px 12px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" bgcolor="#1d4ed8" style="border-radius:999px;background:#1d4ed8;">
                          <!--[if mso]>
                          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${ctaUrl}" style="height:52px;v-text-anchor:middle;width:260px;" arcsize="50%" fillcolor="#1d4ed8" stroke="f">
                            <w:anchorlock/>
                            <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">Open your learning hub</center>
                          </v:roundrect>
                          <![endif]-->
                          <!--[if !mso]><!-- -->
                          <a href="${ctaUrl}" style="display:inline-block;padding:16px 34px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;background:#1d4ed8;letter-spacing:0.01em;">
                            Open your learning hub
                          </a>
                          <!--<![endif]-->
                        </td>
                      </tr>
                    </table>
                    <p style="margin:16px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:#64748b;">
                      Prefer to start later? <a href="${loginUrl}" style="color:#1d4ed8;font-weight:600;text-decoration:none;">Sign in with this email</a> anytime.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Closing note -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:8px 36px 34px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f9ff;border:1px solid #e0ebfb;border-radius:18px;">
                      <tr>
                        <td style="padding:20px 22px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                          <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#0f172a;">A note from the ${brand} team</p>
                          <p style="margin:0;font-size:14px;line-height:1.65;color:#475569;">
                            We built ${brand} to make serious learning feel clear, personal, and always available. If you ever need help, just reply to this email — we read every message.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:28px 12px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#334155;">
                Follow ${brand}
              </p>
              <p style="margin:0 0 18px;font-size:13px;line-height:1.5;">
                <a href="${SOCIAL.instagram.href}" style="color:#0369a1;text-decoration:none;font-weight:600;">Instagram</a>
                <span style="color:#cbd5e1;">&nbsp;&nbsp;·&nbsp;&nbsp;</span>
                <a href="${SOCIAL.x.href}" style="color:#0369a1;text-decoration:none;font-weight:600;">X</a>
              </p>
              <p style="margin:0;font-size:12px;line-height:1.7;color:#94a3b8;">
                You received this email because you created an ${brand} account.<br />
                © ${year} ${brand}. All rights reserved.
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
