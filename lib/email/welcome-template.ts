import { SOCIAL } from '@/lib/site'

/** ASCII brand for email clients — never use the special-i wordmark (many inboxes show “Aria”). */
export const EMAIL_BRAND_NAME = 'AIra'

export const WELCOME_EMAIL_SUBJECT =
  'Welcome to AIra — your AI learning companion'

const PREHEADER =
  "Meet AIra's main features — AI teaching, curriculum, competitive exams, Live Q&A, and Study Studio."

function siteOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    'https://aira-landing-page-elite.vercel.app'
  return raw.replace(/\/$/, '')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export type WelcomeTemplateInput = {
  name: string
}

export type WelcomeTemplate = {
  subject: string
  html: string
  text: string
}

type FeatureCard = {
  n: number
  title: string
  body: string
  accent: string
}

const FEATURES: FeatureCard[] = [
  {
    n: 1,
    title: 'AI Teaching',
    body: 'Personalized lessons powered by AIra that adapt to how you learn — clear explanations, practice, and guidance at your pace.',
    accent: '#0B6E99',
  },
  {
    n: 2,
    title: 'Smart Curriculum',
    body: 'A structured Grades 6–12 boards path with curated topics so you always know what to study next.',
    accent: '#0D8A7B',
  },
  {
    n: 3,
    title: 'Competitive Mode',
    body: 'Timed JEE and NEET practice with focused feedback so you can build speed, accuracy, and exam confidence.',
    accent: '#C47A12',
  },
  {
    n: 4,
    title: 'Live Q&A',
    body: 'Stuck on a concept? Get instant answers from AIra anytime — day or night — without waiting for a class.',
    accent: '#1B6FBF',
  },
  {
    n: 5,
    title: 'Study Studio',
    body: 'Turn any lesson into notes, flashcards, and quizzes you can revise later — your personal study toolkit.',
    accent: '#5B4FC7',
  },
]

export function buildWelcomeEmail(input: WelcomeTemplateInput): WelcomeTemplate {
  const origin = siteOrigin()
  const displayName = (input.name.trim() || 'there').slice(0, 80)
  const safeName = escapeHtml(displayName)
  const logoUrl = `${origin}/aira-mark.png`
  const iconUrl = `${origin}/brand/aira-icon.png`
  const ctaUrl = `${origin}/login`
  const year = new Date().getFullYear()
  const brand = EMAIL_BRAND_NAME

  const text = [
    `Welcome to ${brand}, ${displayName}!`,
    '',
    PREHEADER,
    '',
    `${brand} is your AI learning companion for school curriculum, competitive exams, and study tools.`,
    '',
    `What you can do with ${brand}:`,
    ...FEATURES.flatMap((f) => [`${f.n}. ${f.title}`, `   ${f.body}`, '']),
    `Start learning with ${brand}: ${ctaUrl}`,
    '',
    `Instagram: ${SOCIAL.instagram.href}`,
    `X: ${SOCIAL.x.href}`,
    '',
    `— The ${brand} team`,
  ].join('\n')

  const featureRows = FEATURES.map(
    (f) => `
      <tr>
        <td style="padding:0 0 14px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E4EBF2;border-radius:12px;background:#FFFFFF;overflow:hidden;">
            <tr>
              <td width="6" style="width:6px;background-color:${f.accent};font-size:0;line-height:0;">&nbsp;</td>
              <td style="padding:16px 18px 16px 14px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td width="32" valign="top" style="padding-right:12px;">
                      <div style="width:28px;height:28px;border-radius:8px;background-color:${f.accent};color:#ffffff;font-size:13px;font-weight:700;line-height:28px;text-align:center;">${f.n}</div>
                    </td>
                    <td valign="top">
                      <p style="margin:0 0 6px 0;font-size:16px;font-weight:700;color:#0F2740;line-height:1.3;">${escapeHtml(f.title)}</p>
                      <p style="margin:0;font-size:14px;line-height:1.6;color:#4A5D73;">${escapeHtml(f.body)}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>`,
  ).join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${WELCOME_EMAIL_SUBJECT}</title>
</head>
<body style="margin:0;padding:0;background:#EEF3F8;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0F2740;">
  <!-- Preheader (hidden inbox preview) -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
    ${escapeHtml(PREHEADER)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF3F8;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #E4EBF2;">

          <!-- Header / logo -->
          <tr>
            <td style="background:#FFFFFF;padding:28px 28px 20px 28px;text-align:center;border-bottom:1px solid #E4EBF2;">
              <img src="${logoUrl}" alt="${brand}" width="88" height="88" style="display:block;margin:0 auto 12px auto;border:0;width:88px;height:auto;" />
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td valign="middle" style="padding-right:8px;">
                    <img src="${iconUrl}" alt="" width="22" height="22" style="display:block;border:0;border-radius:6px;width:22px;height:22px;" />
                  </td>
                  <td valign="middle">
                    <p style="margin:0;font-size:22px;font-weight:800;letter-spacing:-0.02em;color:#0B6E99;line-height:1;">${brand}</p>
                  </td>
                </tr>
              </table>
              <p style="margin:10px 0 0 0;font-size:14px;line-height:1.5;color:#4A5D73;">Your AI learning companion</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:28px 28px 8px 28px;">
              <p style="margin:0 0 12px 0;font-size:20px;font-weight:700;color:#0F2740;line-height:1.3;">Welcome, ${safeName}</p>
              <p style="margin:0 0 18px 0;font-size:15px;line-height:1.65;color:#4A5D73;">
                Thanks for creating your ${brand} account. ${brand} helps you learn with an AI tutor — from school boards to JEE and NEET — with tools that explain, practice, and revise with you.
              </p>
              <p style="margin:0 0 14px 0;font-size:13px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#0B6E99;">
                What you can do with ${brand}
              </p>
            </td>
          </tr>

          <!-- Feature cards -->
          <tr>
            <td style="padding:0 28px 8px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${featureRows}
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:12px 28px 28px 28px;" align="center">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" bgcolor="#0B6E99" style="border-radius:999px;background-color:#0B6E99;">
                    <a href="${ctaUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:999px;">
                      Start learning with ${brand}
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:16px 0 0 0;font-size:12px;line-height:1.5;color:#7A8FA3;">
                If the button does not work, open<br />
                <a href="${ctaUrl}" style="color:#0B6E99;word-break:break-all;">${ctaUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F7FAFC;padding:20px 28px;border-top:1px solid #E4EBF2;text-align:center;">
              <p style="margin:0 0 8px 0;font-size:13px;color:#4A5D73;">Follow ${brand}</p>
              <p style="margin:0;font-size:13px;">
                <a href="${SOCIAL.instagram.href}" style="color:#0B6E99;text-decoration:none;margin:0 8px;">${SOCIAL.instagram.label}</a>
                ·
                <a href="${SOCIAL.x.href}" style="color:#0B6E99;text-decoration:none;margin:0 8px;">${SOCIAL.x.label}</a>
              </p>
              <p style="margin:14px 0 0 0;font-size:11px;color:#8A9BB0;">
                © ${year} ${brand}. You received this because you created an account.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject: WELCOME_EMAIL_SUBJECT, html, text }
}
